import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import path from "path"
import { promises as fs } from "fs"
import { KnowledgeBase } from "./core/knowledge-base.js"
import { Validator } from "./core/validator.js"
import { EvolutionEngine } from "./core/evolution-engine.js"
import { ensureCommands } from "./utils/command-installer.js"
import { fileExists, listFiles } from "./utils/file-utils.js"
import type { EvolutionConfig, KnowledgeGraph, FileWatcherInput, FileWatcherOutput } from "./types/index.js"

const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  enabled: true,
  watchPatterns: [
    "src/**/*.ts",
    "src/**/*.js",
    "src/**/*.tsx",
    "src/**/*.jsx",
    "docs/**/*.md",
    "README.md",
  ],
  ignorePatterns: [
    "**/*.test.ts",
    "**/*.test.js",
    "**/*.spec.ts",
    "**/*.spec.js",
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
  ],
  updateThreshold: 10,
  scheduleTime: "daily",
  requireApproval: true,
}

let knowledgeBase: KnowledgeBase | null = null
let evolutionEngine: EvolutionEngine | null = null

export const OhMemoryPlugin: Plugin = async (context: PluginInput) => {
  const { project, client, $, directory, worktree } = context

  await client.app.log({
    body: {
      service: "oh-memory",
      level: "info",
      message: "Plugin initialized",
      extra: {
        directory,
        worktree,
      },
    },
  })

  // Ensure commands are installed
  await ensureCommands(directory)

  if (!knowledgeBase) {
    knowledgeBase = new KnowledgeBase(directory)
  }

  const evolutionConfig = await loadEvolutionConfig(directory)
  evolutionEngine = new EvolutionEngine(evolutionConfig, knowledgeBase, context)
  
  if (evolutionConfig.enabled) {
    await evolutionEngine.start()
  }

  return {
    "file.watcher.updated": async (input: FileWatcherInput, output: FileWatcherOutput) => {
      if (evolutionConfig.enabled && shouldTriggerUpdate(input.path, evolutionConfig)) {
        await client.app.log({
          body: {
            service: "oh-memory",
            level: "info",
            message: `File changed: ${input.path}, triggering knowledge update`,
          },
        })

        if (!evolutionConfig.requireApproval && knowledgeBase) {
          await knowledgeBase.ingestFiles([input.path])
        }
      }
    },

    tool: {
      "memory-init-kb": tool({
        description: "Initialize the knowledge base directory structure and configuration",
        args: {
          projectPath: tool.schema.string().describe("Project root directory path"),
        },
        async execute(args, context) {
          try {
            const kb = new KnowledgeBase(args.projectPath)
            await kb.initialize()

            const result = {
              success: true,
              message: "Knowledge base initialized successfully",
              structure: {
                entities: ".memory/entities/",
                concepts: ".memory/concepts/",
                sources: ".memory/sources/",
                synthesis: ".memory/synthesis/",
                pending: ".memory/pending/",
                index: ".memory/index.md",
                log: ".memory/log.md",
                schema: ".memory/SCHEMA.md",
                graph: ".memory/graph.json",
                graphHtml: ".memory/graph.html",
              },
            }

            return JSON.stringify(result, null, 2)
          } catch (error) {
            return JSON.stringify(
              {
                success: false,
                error: (error as Error).message,
              },
              null,
              2
            )
          }
        },
      }),

      "memory-status": tool({
        description: "Get comprehensive knowledge base status including page counts, graph stats, health score, and evolution engine status",
        args: {
          projectPath: tool.schema.string().describe("Project root directory path"),
        },
        async execute(args, context) {
          try {
            if (!knowledgeBase) {
              return JSON.stringify({
                success: false,
                error: "Knowledge base not initialized. Run /memory-init first.",
              }, null, 2)
            }
            
            const basePath = knowledgeBase.getBasePath()
            const graph = knowledgeBase.getGraph()
            
            // 页面计数
            const pageCounts = await getPageCounts(basePath)
            
            // 图谱统计
            const connectedNodes = new Set<string>()
            if (graph?.edges) {
              for (const edge of graph.edges) {
                connectedNodes.add(edge.from)
                connectedNodes.add(edge.to)
              }
            }
            const graphStats = {
              nodes: graph?.nodes.length ?? 0,
              edges: graph?.edges.length ?? 0,
              connectionRate: graph?.nodes && graph.nodes.length > 0 
                ? Math.round((connectedNodes.size / graph.nodes.length) * 100) 
                : 0,
            }
            
            // 健康检查
            const validator = new Validator(basePath, graph ?? null)
            const lintResult = await validator.validate(false)
            const errorCount = lintResult.issues.filter(i => i.severity === 'error').length
            const warningCount = lintResult.issues.filter(i => i.severity === 'warning').length
            const healthScore = Math.max(0, 100 - errorCount * 10 - warningCount * 2)
            const health = {
              score: healthScore,
              errors: errorCount,
              warnings: warningCount,
              level: healthScore >= 90 ? 'healthy' : healthScore >= 70 ? 'warning' : 'critical',
            }
            
            // 进化状态
            let pendingChanges: string[] = []
            if (evolutionEngine) {
              pendingChanges = await evolutionEngine.scanForChanges()
            }
            const evolutionStatus = {
              running: evolutionEngine?.isRunning?.() ?? false,
              watchedFiles: evolutionEngine?.getWatchedFileCount?.() ?? 0,
              pendingChanges: pendingChanges.length,
              pendingFiles: pendingChanges.slice(0, 10),
            }
            
            // 最后更新时间
            let lastUpdate = 'Never'
            try {
              const logPath = path.join(basePath, 'log.md')
              if (await fileExists(logPath)) {
                const stats = await fs.stat(logPath)
                lastUpdate = formatTimeAgo(stats.mtime)
              }
            } catch {
              lastUpdate = 'Never'
            }
            
            return JSON.stringify({
              success: true,
              basePath,
              pages: pageCounts,
              graph: graphStats,
              health,
              evolution: evolutionStatus,
              lastUpdate,
              initialized: true,
            }, null, 2)
          } catch (error) {
            return JSON.stringify({
              success: false,
              error: (error as Error).message,
            }, null, 2)
          }
        },
      }),

      "memory-diff": tool({
        description: "Preview changes before ingesting files into the knowledge base",
        args: {
          projectPath: tool.schema.string().describe("Project root directory path"),
          files: tool.schema.array(tool.schema.string()).optional().describe("Files to preview (optional, will scan for changes if not provided)"),
        },
        async execute(args, context) {
          try {
            if (!knowledgeBase) {
              return JSON.stringify({
                success: false,
                error: "Knowledge base not initialized. Run /memory-init first.",
              }, null, 2)
            }
            
            let filesToCheck = args.files ?? []
            
            if (filesToCheck.length === 0 && evolutionEngine) {
              filesToCheck = await evolutionEngine.scanForChanges()
            }
            
            if (filesToCheck.length === 0) {
              return JSON.stringify({
                success: true,
                message: "No changes detected",
                newPages: [],
                updatedPages: [],
                deletedPages: [],
                unchangedPages: [],
              }, null, 2)
            }
            
            const result = await knowledgeBase.previewChanges(filesToCheck)
            
            return JSON.stringify({
              success: true,
              ...result,
            }, null, 2)
          } catch (error) {
            return JSON.stringify({
              success: false,
              error: (error as Error).message,
            }, null, 2)
          }
        },
      }),

      "memory-evolve": tool({
        description: "View and control the evolution engine (auto-update)",
        args: {
          projectPath: tool.schema.string().describe("Project root directory path"),
          action: tool.schema.enum(["status", "pause", "resume", "history"]).describe("Action to perform"),
        },
        async execute(args, context) {
          try {
            if (!evolutionEngine) {
              return JSON.stringify({ 
                success: false, 
                error: "Evolution engine not available" 
              }, null, 2)
            }
            
            switch (args.action) {
              case 'status': {
                const pendingChanges = await evolutionEngine.scanForChanges()
                return JSON.stringify({
                  success: true,
                  running: evolutionEngine.isRunning(),
                  watchedFiles: evolutionEngine.getWatchedFileCount(),
                  pendingChanges: pendingChanges.length,
                  pendingFiles: pendingChanges.slice(0, 10),
                  config: {
                    enabled: evolutionEngine.getConfig().enabled,
                    watchPatterns: evolutionEngine.getConfig().watchPatterns,
                    ignorePatterns: evolutionEngine.getConfig().ignorePatterns,
                    requireApproval: evolutionEngine.getConfig().requireApproval,
                  },
                }, null, 2)
              }
              
              case 'pause':
                evolutionEngine.stop()
                return JSON.stringify({ 
                  success: true, 
                  message: "Evolution engine paused",
                  running: false,
                }, null, 2)
              
              case 'resume':
                await evolutionEngine.start()
                return JSON.stringify({ 
                  success: true, 
                  message: "Evolution engine resumed",
                  running: true,
                }, null, 2)
              
              case 'history':
                return JSON.stringify({
                  success: true,
                  history: evolutionEngine.getUpdateHistory(20).map(h => ({
                    timestamp: h.timestamp.toISOString(),
                    files: h.files,
                    createdPages: h.createdPages,
                    updatedPages: h.updatedPages,
                  })),
                }, null, 2)
              
              default:
                return JSON.stringify({ 
                  success: false, 
                  error: "Unknown action" 
                }, null, 2)
            }
          } catch (error) {
            return JSON.stringify({ 
              success: false, 
              error: (error as Error).message 
            }, null, 2)
          }
        },
      }),

      "memory-ingest-files": tool({
        description:
          "Ingest source files into the knowledge base and generate wiki pages. By default, only files tracked by git are processed. Use includeUntracked option to include untracked files.",
        args: {
          files: tool.schema.array(tool.schema.string()).describe("List of file paths to ingest"),
          projectPath: tool.schema.string().describe("Project root directory path"),
          includeUntracked: tool.schema.boolean().optional().describe("Include files not tracked by git (default: false)"),
        },
        async execute(args, context) {
          try {
            if (!knowledgeBase) {
              return JSON.stringify(
                {
                  success: false,
                  error: "Knowledge base not initialized. Please run memory-init-kb first.",
                },
                null,
                2
              )
            }
            const result = await knowledgeBase.ingestFiles(args.files, { 
              includeUntracked: args.includeUntracked || false 
            })

            return JSON.stringify(result, null, 2)
          } catch (error) {
            return JSON.stringify(
              {
                success: false,
                error: (error as Error).message,
              },
              null,
              2
            )
          }
        },
      }),

      "memory-query-kb": tool({
        description: "Query the knowledge base. Modes: quick=IDs only, detailed=with summaries, content=full-text search with context",
        args: {
          query: tool.schema.string().describe("Search query string"),
          projectPath: tool.schema.string().describe("Project root directory path"),
          type: tool.schema.enum(["entity", "concept", "source", "synthesis", "all"]).optional().describe("Type of knowledge to search"),
          mode: tool.schema.enum(["quick", "detailed", "content"]).optional().describe("Query mode: quick=IDs, detailed=summaries, content=full-text"),
        },
        async execute(args, context) {
          try {
            if (!knowledgeBase) {
              return JSON.stringify(
                {
                  success: false,
                  error: "Knowledge base not initialized. Please run memory-init-kb first.",
                },
                null,
                2
              )
            }
            
            if (args.mode === 'content') {
              const result = await knowledgeBase.searchContent(args.query, {
                limit: 10,
                contextLength: 200,
              })
              return JSON.stringify(result, null, 2)
            }
            
            const includeSummaries = args.mode !== 'quick'
            const result = await knowledgeBase.query(args.query, { 
              type: args.type,
              includeSummaries,
              maxSummaryLength: 500,
            })

            return JSON.stringify(result, null, 2)
          } catch (error) {
            return JSON.stringify(
              {
                success: false,
                error: (error as Error).message,
              },
              null,
              2
            )
          }
        },
      }),

      "memory-lint-kb": tool({
        description: "Validate the knowledge base and check for issues",
        args: {
          projectPath: tool.schema.string().describe("Project root directory path"),
          autoFix: tool.schema.boolean().optional().describe("Automatically fix issues when possible"),
        },
        async execute(args, context) {
          try {
            if (!knowledgeBase) {
              return JSON.stringify(
                {
                  success: false,
                  error: "Knowledge base not initialized. Please run memory-init-kb first.",
                },
                null,
                2
              )
            }
            await knowledgeBase.initialize()
            
            const graph = knowledgeBase.getGraph()
            const validator = new Validator(knowledgeBase.getBasePath(), graph)
            const result = await validator.validate(args.autoFix || false)

            return JSON.stringify(result, null, 2)
          } catch (error) {
            return JSON.stringify(
              {
                success: false,
                error: (error as Error).message,
              },
              null,
              2
            )
          }
        },
      }),
    },
  }
}

function shouldTriggerUpdate(
  filePath: string,
  config: EvolutionConfig
): boolean {
  for (const pattern of config.ignorePatterns) {
    if (filePath.includes(pattern.replace(/\*\*/g, ""))) {
      return false
    }
  }

  const matchesWatchPattern = config.watchPatterns.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp(pattern.replace(/\*/g, ".*"))
      return regex.test(filePath)
    }
    return filePath.includes(pattern)
  })

  return matchesWatchPattern
}

async function getPageCounts(basePath: string): Promise<{
  total: number
  entities: number
  concepts: number
  sources: number
  synthesis: number
}> {
  const categories = ['entities', 'concepts', 'sources', 'synthesis']
  const counts: Record<string, number> = {}
  
  for (const category of categories) {
    const categoryPath = path.join(basePath, category)
    if (await fileExists(categoryPath)) {
      const files = await listFiles(categoryPath, ['.md'])
      counts[category] = files.length
    } else {
      counts[category] = 0
    }
  }
  
  return {
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    entities: counts.entities ?? 0,
    concepts: counts.concepts ?? 0,
    sources: counts.sources ?? 0,
    synthesis: counts.synthesis ?? 0,
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffDays > 0) return `${diffDays} day(s) ago`
  if (diffHours > 0) return `${diffHours} hour(s) ago`
  return 'Just now'
}

async function loadEvolutionConfig(directory: string): Promise<EvolutionConfig> {
  try {
    const { fileExists, readMarkdownFile } = await import("./utils/file-utils")
    const path = await import("path")

    const configPath = path.join(directory, ".memory", "config.json")

    if (await fileExists(configPath)) {
      const content = await readMarkdownFile(configPath)
      if (content) {
        const config = JSON.parse(content.content)
        return { ...DEFAULT_EVOLUTION_CONFIG, ...config }
      }
    }
  } catch (error) {
    // Use default config if loading fails
  }

  return DEFAULT_EVOLUTION_CONFIG
}

export default OhMemoryPlugin
