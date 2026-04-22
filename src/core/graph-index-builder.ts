import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

import { GraphBuilder } from './graph-builder.js'
import { readMarkdownFile, fileExists, listFiles } from '../utils/file-utils.js'
import { Logger } from '../utils/logger.js'

import type { KnowledgeGraph, PageData, KnowledgePage, GraphUpdatePlan, GraphIndexStats } from '../types/index.js'

export interface FileHashInfo {
  hash: string
  lastModified: string
  pageId: string
}

export interface BuildResult {
  graph: KnowledgeGraph
  fileHashes: Map<string, FileHashInfo>
  stats: GraphIndexStats
}

export class GraphIndexBuilder {
  private graphBuilder: GraphBuilder
  private logger = Logger.getInstance()

  constructor() {
    this.graphBuilder = new GraphBuilder()
  }

  async build(pages: Map<string, PageData>): Promise<BuildResult> {
    const graph = this.graphBuilder.build(pages)
    const fileHashes = await this.calculateFileHashes(pages)
    const stats = this.computeStats(graph)

    return { graph, fileHashes, stats }
  }

  async loadPagesFromDirectory(basePath: string): Promise<Map<string, PageData>> {
    const pages = new Map<string, PageData>()
    const categories = ['modules', 'concepts', 'configs', 'synthesis']

    const allFiles: string[] = []
    for (const category of categories) {
      const categoryPath = path.join(basePath, category)
      if (!await fileExists(categoryPath)) continue

      const files = await listFiles(categoryPath, ['.md'])
      allFiles.push(...files)
    }

    const CONCURRENCY_LIMIT = 10
    const batches = this.chunkArray(allFiles, CONCURRENCY_LIMIT)

    for (const batch of batches) {
      const results = await Promise.all(
        batch.map(async (filePath) => {
          const page = await readMarkdownFile(filePath)
          if (!page) return null

          return { filePath, page }
        })
      )

      for (const result of results) {
        if (!result) continue
        const pageId = path.basename(result.filePath, '.md')
        pages.set(pageId, {
          links: result.page.links,
          metadata: result.page.frontmatter,
          filePath: result.filePath,
        })
      }
    }

    return pages
  }

  async detectChanges(
    basePath: string,
    previousHashes: Map<string, FileHashInfo>
  ): Promise<GraphUpdatePlan> {
    const currentPages = await this.loadPagesFromDirectory(basePath)
    const currentHashes = await this.calculateFileHashes(currentPages)

    const addedNodes: string[] = []
    const updatedNodes: string[] = []
    const deletedNodes: string[] = []
    const addedEdges: string[] = []
    const deletedEdges: string[] = []
    const affectedLayers: string[] = []

    for (const [filePath, info] of currentHashes) {
      const prev = previousHashes.get(filePath)
      if (!prev) {
        addedNodes.push(info.pageId)
      } else if (prev.hash !== info.hash) {
        updatedNodes.push(info.pageId)
      }
    }

    for (const [filePath, info] of previousHashes) {
      if (!currentHashes.has(filePath)) {
        deletedNodes.push(info.pageId)
      }
    }

    const affectedTypes = new Set<string>()
    for (const page of currentPages.values()) {
      if (
        addedNodes.includes(page.metadata.id ?? '') ||
        updatedNodes.includes(page.metadata.id ?? '')
      ) {
        affectedTypes.add(page.metadata.type)
      }
    }
    affectedLayers.push(...affectedTypes)

    return {
      addedNodes,
      updatedNodes,
      deletedNodes,
      addedEdges,
      deletedEdges,
      affectedLayers,
    }
  }

  async incrementalUpdate(
    existingGraph: KnowledgeGraph,
    basePath: string,
    previousHashes: Map<string, FileHashInfo>
  ): Promise<BuildResult> {
    const plan = await this.detectChanges(basePath, previousHashes)

    if (plan.addedNodes.length === 0 && plan.updatedNodes.length === 0 && plan.deletedNodes.length === 0) {
      const stats = this.computeStats(existingGraph)
      return { graph: existingGraph, fileHashes: previousHashes, stats }
    }

    this.logger.info('[oh-memory] Incremental update', {
      added: plan.addedNodes.length,
      updated: plan.updatedNodes.length,
      deleted: plan.deletedNodes.length,
    })

    const allPages = await this.loadPagesFromDirectory(basePath)
    return this.build(allPages)
  }

  computeStats(graph: KnowledgeGraph): GraphIndexStats {
    const counts = { module: 0, concept: 0, config: 0, synthesis: 0 }

    for (const node of graph.nodes) {
      counts[node.type] = (counts[node.type] ?? 0) + 1
    }

    return {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      modulesCount: counts.module,
      conceptsCount: counts.concept,
      configsCount: counts.config,
      synthesisCount: counts.synthesis,
      lastUpdated: new Date().toISOString(),
    }
  }

  private async calculateFileHashes(
    pages: Map<string, PageData>
  ): Promise<Map<string, FileHashInfo>> {
    const fileHashes = new Map<string, FileHashInfo>()

    for (const [pageId, page] of pages) {
      if (!page.filePath) continue

      try {
        const content = await fs.readFile(page.filePath, 'utf-8')
        const stats = await fs.stat(page.filePath)
        const hash = this.calculateHash(content)

        fileHashes.set(page.filePath, {
          hash,
          lastModified: stats.mtime.toISOString(),
          pageId,
        })
      } catch (error) {
        this.logger.warn('[oh-memory] Failed to calculate hash:', { filePath: page.filePath, error })
      }
    }

    return fileHashes
  }

  private calculateHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 16)
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}
