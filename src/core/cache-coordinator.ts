import { promises as fs } from 'fs'
import path from 'path'

import { Logger } from '../utils/logger.js'
import { MemoryCache } from '../utils/cache-manager.js'
import { fileExists, listFiles } from '../utils/file-utils.js'
import type { KnowledgeGraph, QueryResult } from '../types/index.js'

/**
 * CacheCoordinator manages graph cache and query cache coordination.
 * It handles loading and validating graph cache files, and provides
 * a query cache for storing query results.
 */
export class CacheCoordinator {
  private basePath: string
  private logger = Logger.getInstance()
  private queryCache: MemoryCache<string, QueryResult>

  /**
   * Create a new CacheCoordinator instance
   * @param basePath - The base path for cache files (typically .memory directory)
   */
  constructor(basePath: string) {
    this.basePath = basePath
    this.queryCache = new MemoryCache<string, QueryResult>({
      maxSize: 50,
      defaultTtl: 5 * 60 * 1000 // 5 minutes
    })
  }

  /**
   * Load the graph cache from disk
   * @returns The loaded KnowledgeGraph or null if cache doesn't exist or is invalid
   */
  async loadGraphCache(): Promise<KnowledgeGraph | null> {
    const graphPath = path.join(this.basePath, 'graph.json')

    if (!await fileExists(graphPath)) {
      return null
    }

    try {
      const content = await fs.readFile(graphPath, 'utf-8')
      const graph = JSON.parse(content) as KnowledgeGraph
      return graph
    } catch (error) {
      this.logger.warn('[oh-memory] Failed to load graph cache', { error })
      return null
    }
  }

  /**
   * Check if the graph cache is still valid by comparing modification times
   * of the graph file with all markdown files in category directories
   * @returns true if cache is valid, false otherwise
   */
  async isGraphCacheValid(): Promise<boolean> {
    const graphPath = path.join(this.basePath, 'graph.json')

    if (!await fileExists(graphPath)) {
      return false
    }

    try {
      const graphStats = await fs.stat(graphPath)
      const graphMtime = graphStats.mtime.getTime()

      const categories = ['entities', 'concepts', 'sources', 'synthesis']
      for (const category of categories) {
        const categoryPath = path.join(this.basePath, category)
        if (!await fileExists(categoryPath)) continue

        const files = await listFiles(categoryPath, ['.md'])
        for (const file of files) {
          const stats = await fs.stat(file)
          if (stats.mtime.getTime() > graphMtime) {
            return false
          }
        }
      }

      return true
    } catch (error) {
      this.logger.warn('[oh-memory] Failed to validate graph cache', { error })
      return false
    }
  }

  /**
   * Get the query cache instance for storing query results
   * @returns The MemoryCache instance for query results
   */
  getQueryCache(): MemoryCache<string, QueryResult> {
    return this.queryCache
  }

  /**
   * Clear all caches managed by this coordinator
   * This clears the in-memory query cache but does not delete cache files
   */
  clearAllCaches(): void {
    this.queryCache.clear()
    this.logger.info('[oh-memory] All caches cleared')
  }
}
