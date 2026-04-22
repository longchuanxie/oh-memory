import type { Plugin, PluginInput } from '@opencode-ai/plugin'
import { tool } from '@opencode-ai/plugin'
import path from 'path'
import { promises as fs } from 'fs'

import { KnowledgeBase } from './core/knowledge-base.js'
import { QueryEngine } from './core/query-engine.js'
import { GraphIndexBuilder } from './core/graph-index-builder.js'
import { GraphCache } from './core/graph-cache.js'
import { GraphVisualizer } from './core/graph-visualizer.js'
import { EvolutionEngine } from './core/evolution-engine.js'
import { ensureCommands } from './utils/command-installer.js'
import { fileExists, writeMarkdownFile } from './utils/file-utils.js'
import { getLanguage, isSupportedExtension, getFileType, PAGE_TYPE_TO_DIR } from './utils/language-map.js'
import { loadPrompt } from './utils/prompt-loader.js'

import type { EvolutionConfig, FileWatcherInput, FileWatcherOutput, PageFrontmatter } from './types/index.js'

const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  enabled: true,
  watchPatterns: [
    'src/**/*.ts',
    'src/**/*.js',
    'src/**/*.tsx',
    'src/**/*.jsx',
    'docs/**/*.md',
    'README.md',
  ],
  ignorePatterns: [
    '**/*.test.ts',
    '**/*.test.js',
    '**/*.spec.ts',
    '**/*.spec.js',
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
  ],
  updateThreshold: 10,
  scheduleTime: 'daily',
  requireApproval: true,
}

let knowledgeBase: KnowledgeBase | null = null
let queryEngine: QueryEngine | null = null
let graphIndexBuilder: GraphIndexBuilder | null = null
let graphCache: GraphCache | null = null
let evolutionEngine: EvolutionEngine | null = null

export const OhMemoryPlugin: Plugin = async (context: PluginInput) => {
  const { client, directory } = context

  await client.app.log({
    body: {
      service: 'oh-memory',
      level: 'info',
      message: 'Plugin initialized',
      extra: { directory },
    },
  })

  await ensureCommands(directory)

  knowledgeBase = new KnowledgeBase(directory)
  queryEngine = new QueryEngine()
  graphIndexBuilder = new GraphIndexBuilder()
  graphCache = new GraphCache(path.join(directory, '.memory'))

  const evolutionConfig = await loadEvolutionConfig(directory)
  evolutionEngine = new EvolutionEngine(evolutionConfig, knowledgeBase, context)

  if (evolutionConfig.enabled) {
    await evolutionEngine.start()
  }

  return {
    'file.watcher.updated': async (input: FileWatcherInput, output: FileWatcherOutput) => {
      if (evolutionConfig.enabled && shouldTriggerUpdate(input.path, evolutionConfig)) {
        await client.app.log({
          body: {
            service: 'oh-memory',
            level: 'info',
            message: `File changed: ${input.path}, triggering knowledge update`,
          },
        })

        if (!evolutionConfig.requireApproval && knowledgeBase) {
          await knowledgeBase.ingestFiles([input.path])
        }
      }
    },

    tool: {
      'memory-init': tool({
        description: 'Initialize the knowledge base directory structure. Creates .memory/ with modules/, concepts/, configs/, synthesis/ subdirectories.',
        args: {
          projectPath: tool.schema.string().describe('Project root directory path'),
        },
        async execute(args) {
          try {
            const memoryDir = path.join(args.projectPath, '.memory')
            const dirs = ['modules', 'concepts', 'configs', 'synthesis', 'pending']

            for (const dir of dirs) {
              await fs.mkdir(path.join(memoryDir, dir), { recursive: true })
            }

            const kb = new KnowledgeBase(args.projectPath)
            await kb.initialize()

            return JSON.stringify({
              success: true,
              message: 'Knowledge base initialized',
              structure: dirs.map(d => `.memory/${d}/`),
            }, null, 2)
          } catch (error) {
            return JSON.stringify({ success: false, error: (error as Error).message }, null, 2)
          }
        },
      }),

      'memory-status': tool({
        description: 'Get knowledge base status: graph stats, evolution engine state, and pending changes.',
        args: {},
        async execute() {
          try {
            if (!knowledgeBase || !graphCache) {
              return JSON.stringify({
                success: false,
                error: 'Knowledge base not initialized. Run memory-init first.',
              }, null, 2)
            }

            const cachedGraph = await graphCache.loadGraph()
            const pendingChanges = evolutionEngine
              ? await evolutionEngine.scanForChanges()
              : []

            return JSON.stringify({
              success: true,
              graph: cachedGraph
                ? {
                    nodes: cachedGraph.nodes.length,
                    edges: cachedGraph.edges.length,
                  }
                : null,
              evolution: {
                running: evolutionEngine?.isRunning() ?? false,
                watchedFiles: evolutionEngine?.getWatchedFileCount() ?? 0,
                pendingChanges: pendingChanges.length,
              },
            }, null, 2)
          } catch (error) {
            return JSON.stringify({ success: false, error: (error as Error).message }, null, 2)
          }
        },
      }),

      'memory-read-context': tool({
        description: `Read file contents as LLM-ready context. Returns filtered (sensitive data redacted) file content with metadata.

Use this to gather context before generating wiki pages. You can then pass the context to @wiki-generator sub-agent.

Workflow:
1. Call this tool with file paths
2. Pass returned context to @wiki-generator
3. (Optional) Call @wiki-validator to verify quality`,
        args: {
          files: tool.schema.array(tool.schema.string()).describe('File paths (relative to project root) to read'),
        },
        async execute(args) {
          try {
            if (!knowledgeBase) {
              return JSON.stringify({ success: false, error: 'Knowledge base not initialized' }, null, 2)
            }

            const context = await knowledgeBase.generateLLMContext(args.files)
            return context
          } catch (error) {
            return JSON.stringify({ success: false, error: (error as Error).message }, null, 2)
          }
        },
      }),

      'memory-project-snapshot': tool({
        description: 'Get a project overview: file counts by language, directory structure, and file list. Useful for understanding project scope before ingestion.',
        args: {},
        async execute() {
          try {
            if (!knowledgeBase) {
              return JSON.stringify({ success: false, error: 'Knowledge base not initialized' }, null, 2)
            }

            const snapshot = await knowledgeBase.getProjectSnapshot()

            return JSON.stringify({
              projectPath: snapshot.projectPath,
              totalFiles: snapshot.totalFiles,
              languages: snapshot.languages,
              structure: snapshot.structure,
            }, null, 2)
          } catch (error) {
            return JSON.stringify({ success: false, error: (error as Error).message }, null, 2)
          }
        },
      }),

      'memory-ingest': tool({
        description: `Ingest files into the knowledge base. Returns file metadata (path, language, lines, hash).

Recommended workflow:
1. Call memory-project-snapshot to understand scope
2. Call memory-read-context to get file contents
3. Use @wiki-generator sub-agent to generate wiki pages
4. Call this tool to register processed files`,
        args: {
          files: tool.schema.array(tool.schema.string()).describe('File paths to ingest'),
        },
        async execute(args) {
          try {
            if (!knowledgeBase) {
              return JSON.stringify({ success: false, error: 'Knowledge base not initialized' }, null, 2)
            }

            const result = await knowledgeBase.ingestFiles(args.files)
            return JSON.stringify(result, null, 2)
          } catch (error) {
            return JSON.stringify({ success: false, error: (error as Error).message }, null, 2)
          }
        },
      }),

      'memory-query': tool({
        description: 'Search the knowledge graph by keywords. Returns matching nodes with scores and related connections. Use this to find existing knowledge before creating new pages.',
        args: {
          query: tool.schema.string().describe('Search query (keywords separated by spaces)'),
          type: tool.schema.enum(['module', 'concept', 'config', 'synthesis', 'all']).optional().describe('Filter by node type (default: all)'),
          limit: tool.schema.number().optional().describe('Maximum results to return (default: 10)'),
        },
        async execute(args) {
          try {
            if (!queryEngine || !graphCache) {
              return JSON.stringify({ success: false, error: 'Knowledge base not initialized' }, null, 2)
            }

            const graph = await graphCache.loadGraph()
            if (!graph) {
              return JSON.stringify({ success: false, error: 'No graph data found. Run memory-build first.' }, null, 2)
            }

            const context = queryEngine.buildQueryContext(graph, args.query, {
              type: args.type ?? 'all',
              limit: args.limit ?? 10,
            })

            return queryEngine.generateLLMQueryPrompt(context)
          } catch (error) {
            return JSON.stringify({ success: false, error: (error as Error).message }, null, 2)
          }
        },
      }),

      'memory-build': tool({
        description: 'Build or rebuild the knowledge graph from .memory/ directory. Scans all wiki pages, creates the graph index, and generates graph.html visualization.',
        args: {},
        async execute() {
          try {
            if (!graphIndexBuilder || !graphCache) {
              return JSON.stringify({ success: false, error: 'Knowledge base not initialized' }, null, 2)
            }

            const memoryDir = path.join(knowledgeBase!.getProjectPath(), '.memory')
            const pages = await graphIndexBuilder.loadPagesFromDirectory(memoryDir)
            const result = await graphIndexBuilder.build(pages)

            await graphCache.saveGraph(result.graph)
            await graphCache.setFileHashes(
              new Map([...result.fileHashes].map(([k, v]) => [k, v.hash]))
            )
            await graphCache.saveHashCache()

            const visualizer = new GraphVisualizer()
            const htmlPath = path.join(memoryDir, 'graph.html')
            await visualizer.generateHtml(result.graph, result.stats, htmlPath)

            return JSON.stringify({
              success: true,
              stats: result.stats,
              visualization: htmlPath,
            }, null, 2)
          } catch (error) {
            return JSON.stringify({ success: false, error: (error as Error).message }, null, 2)
          }
        },
      }),

      'memory-evolve': tool({
        description: 'Control the evolution engine (auto-update on file changes). Actions: status, pause, resume, history.',
        args: {
          action: tool.schema.enum(['status', 'pause', 'resume', 'history']).describe('Action to perform'),
        },
        async execute(args) {
          try {
            if (!evolutionEngine) {
              return JSON.stringify({ success: false, error: 'Evolution engine not available' }, null, 2)
            }

            switch (args.action) {
              case 'status': {
                const pendingChanges = await evolutionEngine.scanForChanges()
                return JSON.stringify({
                  success: true,
                  running: evolutionEngine.isRunning(),
                  watchedFiles: evolutionEngine.getWatchedFileCount(),
                  pendingChanges: pendingChanges.length,
                  config: {
                    enabled: evolutionEngine.getConfig().enabled,
                    requireApproval: evolutionEngine.getConfig().requireApproval,
                  },
                }, null, 2)
              }

              case 'pause':
                evolutionEngine.stop()
                return JSON.stringify({ success: true, message: 'Evolution engine paused', running: false }, null, 2)

              case 'resume':
                await evolutionEngine.start()
                return JSON.stringify({ success: true, message: 'Evolution engine resumed', running: true }, null, 2)

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
                return JSON.stringify({ success: false, error: 'Unknown action' }, null, 2)
            }
          } catch (error) {
            return JSON.stringify({ success: false, error: (error as Error).message }, null, 2)
          }
        },
      }),

      'memory-batch-ingest': tool({
        description: `Batch ingest: scan project files, group them into batches, and generate LLM-ready context with wiki-generation prompts for each batch.

This tool solves the problem of subagents not having access to other tools. It prepares everything the main agent needs to delegate wiki generation to subagents in batches.

Workflow:
1. Call this tool with a directory or file list and batch size
2. It returns batches of file context + wiki-generation prompt
3. For each batch, delegate to @wiki-generator subagent with the prepared context
4. After subagent generates wiki pages, call memory-save-wiki to persist them
5. Finally call memory-build to rebuild the graph`,
        args: {
          files: tool.schema.array(tool.schema.string()).optional().describe('File paths to process (absolute or relative to project root)'),
          directory: tool.schema.string().optional().describe('Directory to scan for files (absolute or relative path, e.g., "api/src/main/java" or "D:/project/api/src")'),
          batchSize: tool.schema.number().optional().describe('Number of files per batch (default: 5)'),
          fileTypes: tool.schema.array(tool.schema.enum(['module', 'concept', 'config', 'script', 'style', 'all'])).optional().describe('Filter by file type (default: ["all"])'),
        },
        async execute(args) {
          try {
            if (!knowledgeBase) {
              return JSON.stringify({ success: false, error: 'Knowledge base not initialized. Run memory-init first.' }, null, 2)
            }

            const batchSize = args.batchSize ?? 5
            const fileTypes = args.fileTypes ?? ['all']

            let filePaths: string[]

            if (args.files && args.files.length > 0) {
              filePaths = args.files.map(f => {
                if (path.isAbsolute(f)) {
                  return path.relative(knowledgeBase!.getProjectPath(), f)
                }
                return f
              })
            } else if (args.directory) {
              const snapshot = await knowledgeBase.getProjectSnapshot()
              let dirPrefix = args.directory.replace(/\/$/, '').replace(/\\/g, '/')
              if (path.isAbsolute(dirPrefix)) {
                dirPrefix = path.relative(knowledgeBase!.getProjectPath(), dirPrefix).replace(/\\/g, '/')
              }
              dirPrefix = dirPrefix + '/'
              filePaths = snapshot.files
                .filter(f => {
                  const normalized = f.relativePath.replace(/\\/g, '/')
                  return normalized.startsWith(dirPrefix)
                })
                .map(f => f.relativePath)
            } else {
              const snapshot = await knowledgeBase.getProjectSnapshot()
              filePaths = snapshot.files.map(f => f.relativePath)
            }

            const filteredPaths = filePaths.filter(p => {
              const ext = path.extname(p)
              if (!isSupportedExtension(ext)) return false
              if (fileTypes.includes('all')) return true
              const ft = getFileType(ext)
              return fileTypes.includes(ft)
            })

            if (filteredPaths.length === 0) {
              return JSON.stringify({
                success: false,
                error: 'No supported files found matching the criteria',
              }, null, 2)
            }

            const batches: Array<{
              batchIndex: number
              totalBatches: number
              files: string[]
              context: string
              prompt: string
            }> = []

            for (let i = 0; i < filteredPaths.length; i += batchSize) {
              const batchFiles = filteredPaths.slice(i, i + batchSize)
              const context = await knowledgeBase.generateLLMContext(batchFiles)

              const prompt = `Generate wiki pages for the following ${batchFiles.length} source files. For each file, create a wiki page following the graph-optimized format with proper frontmatter (name, type, category, tags, source, lastModified) and relationship links using [[page-name]] syntax.

Determine the page type based on the 4-layer semantic model:
- module: Source code files (.ts, .tsx, .js, .jsx, .py, .java, .go, .rs, .rb, .vue, .svelte) → save to .memory/modules/
- concept: Documentation files (.md, .mdx, .rst, .adoc, .txt) → save to .memory/concepts/
- config: Configuration files (.json, .yaml, .yml, .toml, .ini, .env, .properties, .xml, .gradle) → save to .memory/configs/

After generating module pages, also generate concept pages that synthesize architectural patterns across the files.

Save each wiki page to the appropriate .memory/ subdirectory.

Here is the source code context:

${context}`

              batches.push({
                batchIndex: Math.floor(i / batchSize) + 1,
                totalBatches: Math.ceil(filteredPaths.length / batchSize),
                files: batchFiles,
                context,
                prompt,
              })
            }

            return JSON.stringify({
              success: true,
              totalFiles: filteredPaths.length,
              batchSize,
              totalBatches: batches.length,
              batches: batches.map(b => ({
                batchIndex: b.batchIndex,
                totalBatches: b.totalBatches,
                files: b.files,
                prompt: b.prompt,
              })),
            }, null, 2)
          } catch (error) {
            return JSON.stringify({ success: false, error: (error as Error).message }, null, 2)
          }
        },
      }),

      'memory-save-wiki': tool({
        description: `Save a generated wiki page to the .memory/ directory. Use this after @wiki-generator subagent produces wiki content.

This tool handles:
1. Parsing the wiki page frontmatter and content
2. Determining the correct .memory/ subdirectory (modules/concepts/configs/synthesis)
3. Writing the file with proper formatting
4. Optionally triggering memory-ingest and memory-build

Call this for each wiki page generated by the subagent.`,
        args: {
          name: tool.schema.string().describe('Wiki page name (kebab-case, used as filename)'),
          type: tool.schema.enum(['module', 'concept', 'config', 'synthesis']).describe('Page type determining the .memory/ subdirectory'),
          frontmatter: tool.schema.record(tool.schema.string(), tool.schema.any()).describe('Frontmatter fields (tags, category, source, lastModified, etc.)'),
          content: tool.schema.string().describe('Wiki page markdown content (without frontmatter)'),
          autoIngest: tool.schema.boolean().optional().describe('Automatically call memory-ingest after saving (default: true)'),
          autoBuild: tool.schema.boolean().optional().describe('Automatically call memory-build after saving (default: false)'),
        },
        async execute(args) {
          try {
            if (!knowledgeBase) {
              return JSON.stringify({ success: false, error: 'Knowledge base not initialized. Run memory-init first.' }, null, 2)
            }

            const projectPath = knowledgeBase.getProjectPath()
            const subDir = PAGE_TYPE_TO_DIR[args.type] ?? 'modules'
            const wikiDir = path.join(projectPath, '.memory', subDir)
            await fs.mkdir(wikiDir, { recursive: true })

            const wikiPath = path.join(wikiDir, `${args.name}.md`)

            const fm = args.frontmatter as Record<string, unknown>
            const frontmatter: PageFrontmatter = {
              id: args.name,
              title: (fm.title as string) ?? args.name,
              type: args.type,
              date: (fm.date as string) ?? new Date().toISOString().split('T')[0],
              updated: new Date().toISOString().split('T')[0],
              tags: (fm.tags as string[]) ?? [],
              ...fm,
            } as PageFrontmatter

            await writeMarkdownFile(wikiPath, frontmatter, args.content)

            const result: Record<string, unknown> = {
              success: true,
              path: path.relative(projectPath, wikiPath),
              name: args.name,
              type: args.type,
            }

            if (args.autoIngest ?? true) {
              const sourcePath = args.frontmatter.source as string | undefined
              if (sourcePath) {
                const ingestResult = await knowledgeBase.ingestFiles([sourcePath])
                result.ingest = {
                  processedFiles: ingestResult.processedFiles,
                  createdPages: ingestResult.createdPages.length,
                }
              }
            }

            if (args.autoBuild ?? false) {
              if (graphIndexBuilder && graphCache) {
                const memoryDir = path.join(projectPath, '.memory')
                const pages = await graphIndexBuilder.loadPagesFromDirectory(memoryDir)
                const buildResult = await graphIndexBuilder.build(pages)
                await graphCache.saveGraph(buildResult.graph)
                await graphCache.setFileHashes(
                  new Map([...buildResult.fileHashes].map(([k, v]) => [k, v.hash]))
                )
                await graphCache.saveHashCache()

                const visualizer = new GraphVisualizer()
                const htmlPath = path.join(memoryDir, 'graph.html')
                await visualizer.generateHtml(buildResult.graph, buildResult.stats, htmlPath)

                result.build = buildResult.stats
              }
            }

            return JSON.stringify(result, null, 2)
          } catch (error) {
            return JSON.stringify({ success: false, error: (error as Error).message }, null, 2)
          }
        },
      }),
    },
  }
}

function shouldTriggerUpdate(filePath: string, config: EvolutionConfig): boolean {
  for (const pattern of config.ignorePatterns) {
    if (filePath.includes(pattern.replace(/\*\*/g, ''))) return false
  }

  return config.watchPatterns.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))
      return regex.test(filePath)
    }
    return filePath.includes(pattern)
  })
}

async function loadEvolutionConfig(directory: string): Promise<EvolutionConfig> {
  try {
    const configPath = path.join(directory, '.memory', 'config.json')

    if (await fileExists(configPath)) {
      const content = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(content)
      return { ...DEFAULT_EVOLUTION_CONFIG, ...config }
    }
  } catch {
    // Use default config if loading fails
  }

  return DEFAULT_EVOLUTION_CONFIG
}

export default OhMemoryPlugin
