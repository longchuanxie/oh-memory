import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

import { GraphBuilder } from './graph-builder.js'
import { readMarkdownFile, fileExists, listFiles } from '../utils/file-utils.js'
import { Logger } from '../utils/logger.js'

import type { KnowledgeGraph, PageData, PageFrontmatter, KnowledgePage } from '../types/index.js'

/**
 * File hash information for tracking changes
 */
export interface FileHashInfo {
  hash: string
  lastModified: string
  pageId: string
}

/**
 * Batch file item for processing
 */
export interface BatchFileItem {
  category: string
  path: string
}

/**
 * Result from processing a batch of files
 */
export interface ProcessBatchResult {
  filePath: string
  page: KnowledgePage
  stats: { mtime: Date }
  hash: string
}

/**
 * Result from building graph index
 */
export interface BuildResult {
  graph: KnowledgeGraph
  fileHashes: Map<string, FileHashInfo>
}

/**
 * GraphIndexBuilder handles the construction of knowledge graph indexes
 * from markdown files in the memory directory.
 *
 * This class is responsible for:
 * - Loading pages from directory structure
 * - Processing files in batches for efficiency
 * - Building the knowledge graph
 * - Calculating file hashes for change detection
 */
export class GraphIndexBuilder {
  private graphBuilder: GraphBuilder
  private logger = Logger.getInstance()

  constructor() {
    this.graphBuilder = new GraphBuilder()
  }

  /**
   * Build a knowledge graph from a map of pages
   *
   * @param pages - Map of page ID to page data
   * @returns Promise resolving to graph and file hashes
   */
  async build(pages: Map<string, PageData>): Promise<BuildResult> {
    const graph = this.graphBuilder.build(pages)
    const fileHashes = await this.calculateFileHashes(pages)

    return { graph, fileHashes }
  }

  /**
   * Load all pages from a memory directory structure
   *
   * @param basePath - Base path to the memory directory
   * @returns Promise resolving to map of page ID to page data
   */
  async loadPagesFromDirectory(basePath: string): Promise<Map<string, PageData>> {
    const pages = new Map<string, PageData>()
    const categories = ['entities', 'concepts', 'sources', 'synthesis']

    const allFiles: BatchFileItem[] = []

    for (const category of categories) {
      const categoryPath = path.join(basePath, category)

      if (!await fileExists(categoryPath)) {
        continue
      }

      const files = await listFiles(categoryPath, ['.md'])
      for (const file of files) {
        allFiles.push({ category, path: file })
      }
    }

    const CONCURRENCY_LIMIT = 10
    const batches = this.chunkArray(allFiles, CONCURRENCY_LIMIT)

    for (const batch of batches) {
      const results = await this.processBatch(batch)

      for (const result of results) {
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

  /**
   * Process a batch of files concurrently
   *
   * @param files - Array of batch file items to process
   * @returns Promise resolving to array of process results
   */
  async processBatch(files: BatchFileItem[]): Promise<ProcessBatchResult[]> {
    const results = await Promise.all(
      files.map(async ({ path: filePath }) => {
        const page = await readMarkdownFile(filePath)
        if (!page) return null

        const stats = await fs.stat(filePath)
        const content = await fs.readFile(filePath, 'utf-8')
        const hash = this.calculateHash(content)

        return { filePath, page, stats: { mtime: stats.mtime }, hash }
      })
    )

    return results.filter((result): result is ProcessBatchResult => result !== null)
  }

  /**
   * Split an array into chunks of specified size
   *
   * @param array - Array to split
   * @param size - Maximum size of each chunk
   * @returns Array of chunks
   */
  chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  /**
   * Calculate hash for content using MD5
   *
   * @param content - Content to hash
   * @returns Hash string (16 characters)
   */
  private calculateHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 16)
  }

  /**
   * Calculate file hashes for all pages with file paths
   *
   * @param pages - Map of page data
   * @returns Promise resolving to map of file path to hash info
   */
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
        this.logger.warn('Failed to calculate hash for file', {
          filePath: page.filePath,
          error
        })
      }
    }

    return fileHashes
  }
}
