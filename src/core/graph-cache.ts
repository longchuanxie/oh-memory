import { KnowledgeGraph } from '../types/index.js'
import { MemoryCache } from '../utils/cache-manager.js'
import { Logger } from '../utils/logger.js'
import { promises as fs } from 'fs'
import path from 'path'

export interface GraphCacheMeta {
  version: string
  nodeCount: number
  edgeCount: number
  lastUpdated: string
  hashVersion: string
}

export class GraphCache {
  private memoryCache: MemoryCache<string, KnowledgeGraph>
  private basePath: string
  private hashCachePath: string
  private graphCachePath: string
  private metaPath: string
  private logger = Logger.getInstance()
  
  private fileHashes: Map<string, string> = new Map()

  constructor(basePath: string) {
    this.basePath = basePath
    this.graphCachePath = path.join(basePath, 'graph.json')
    this.hashCachePath = path.join(basePath, 'graph-hash-cache.json')
    this.metaPath = path.join(basePath, 'graph-meta.json')
    
    this.memoryCache = new MemoryCache<string, KnowledgeGraph>({
      maxSize: 10,
      defaultTtl: 5 * 60 * 1000
    })
  }

  async loadGraph(): Promise<KnowledgeGraph | null> {
    const cached = this.memoryCache.get('main-graph')
    if (cached) {
      this.logger.info('Graph loaded from memory cache')
      return cached
    }

    try {
      const content = await fs.readFile(this.graphCachePath, 'utf-8')
      const graph: KnowledgeGraph = JSON.parse(content)
      
      if (await this.isCacheValid(graph)) {
        this.memoryCache.set('main-graph', graph)
        this.logger.info('Graph loaded from file cache')
        return graph
      }
    } catch {
      this.logger.debug('No cached graph found')
    }

    return null
  }

  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    await fs.writeFile(
      this.graphCachePath,
      JSON.stringify(graph, null, 2),
      'utf-8'
    )
    
    const meta: GraphCacheMeta = {
      version: '1.0.0',
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      lastUpdated: new Date().toISOString(),
      hashVersion: this.computeHashVersion()
    }
    
    await fs.writeFile(
      this.metaPath,
      JSON.stringify(meta, null, 2),
      'utf-8'
    )
    
    this.memoryCache.set('main-graph', graph)
  }

  async invalidate(): Promise<void> {
    this.memoryCache.delete('main-graph')
    
    try {
      await fs.unlink(this.graphCachePath)
      await fs.unlink(this.metaPath)
    } catch {
      // ignore
    }
  }

  private async isCacheValid(graph: KnowledgeGraph): Promise<boolean> {
    try {
      const content = await fs.readFile(this.metaPath, 'utf-8')
      const meta: GraphCacheMeta = JSON.parse(content)
      
      const currentHashVersion = this.computeHashVersion()
      if (meta.hashVersion && currentHashVersion && meta.hashVersion !== currentHashVersion) {
        return false
      }
      
      return true
    } catch {
      return false
    }
  }

  private computeHashVersion(): string {
    const hashes = Array.from(this.fileHashes.values()).sort()
    return hashes.join(',').substring(0, 32)
  }

  updateFileHash(filePath: string, hash: string): void {
    this.fileHashes.set(filePath, hash)
  }

  async loadHashCache(): Promise<void> {
    try {
      const content = await fs.readFile(this.hashCachePath, 'utf-8')
      const hashes = JSON.parse(content)
      this.fileHashes = new Map(Object.entries(hashes))
    } catch {
      // No hash cache yet
    }
  }

  async saveHashCache(): Promise<void> {
    await fs.writeFile(
      this.hashCachePath,
      JSON.stringify(Object.fromEntries(this.fileHashes), null, 2),
      'utf-8'
    )
  }

  getFileHash(filePath: string): string | undefined {
    return this.fileHashes.get(filePath)
  }

  getFileHashes(): Map<string, string> {
    return this.fileHashes
  }

  setFileHashes(hashes: Map<string, string>): void {
    this.fileHashes = hashes
  }

  getStats() {
    return this.memoryCache.getStats()
  }
}
