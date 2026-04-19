# REQ-012 & REQ-013: 增量索引与分层缓存 - 开发设计方案

> **需求编号**: REQ-012, REQ-013  
> **优先级**: P0 - 最高  
> **预计工时**: 3-4 天  
> **依赖**: REQ-016 (敏感信息过滤)  
> **版本**: v1.1 (根据评审结果修订)  

---

## 一、需求概述

### 1.1 背景

当前系统存在以下性能问题：

1. **每次查询都重建索引**: `plugin.ts:L156` 每次 `memory-query` 调用都创建新的 `KnowledgeBase` 实例，导致 `graph` 始终为 `null`
2. **无内存缓存**: 只有文件级缓存，无内存缓存层
3. **全量索引**: 即使只修改了几个文件，也重建整个图索引
4. **写操作频繁**: 每次查询都会触发大量文件写入操作

### 1.2 目标

- **首次查询 < 3 秒**: 通过缓存实现
- **重复查询 < 100ms**: 通过内存缓存实现
- **增量索引**: 只更新变更的文件
- **减少写操作**: 纯查询不触发写操作

### 1.3 评审反馈响应

根据技术评审报告，本版本重点改进：

1. **全局缓存管理器** - 实现单例模式，确保缓存跨命令持久化
2. **缓存一致性验证** - 增强哈希校验和版本号管理
3. **与现有代码整合** - 复用 `knowledge-base.ts` 中的现有缓存逻辑

---

## 二、技术设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Query Request                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     L1: Memory Cache                              │
│  - KnowledgeGraph (图数据)                                       │
│  - 热点页面内容 (LRU, max=100)                                 │
│  - 查询结果缓存 (TTL=5min)                                      │
│  命中率目标: 80%                                                │
└─────────────────────────────────────────────────────────────────┘
                 ↓ Miss
┌─────────────────────────────────────────────────────────────────┐
│                     L2: File Cache                               │
│  - graph.json (图索引)                                          │
│  - page-content/ (页面内容)                                     │
│  - hash-cache.json (文件哈希)                                   │
│  命中率目标: 95%                                                │
└─────────────────────────────────────────────────────────────────┘
                 ↓ Miss
┌─────────────────────────────────────────────────────────────────┐
│                     L3: Incremental Index                         │
│  - 检测文件变更 (哈希比对)                                       │
│  - 只重建变更的索引                                             │
│  - 按需加载页面内容                                             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 全局缓存管理器（新增）

```typescript
// src/core/global-cache-manager.ts

import { promises as fs } from 'fs'
import path from 'path'

export interface CacheManagerConfig {
  projectPath: string
  memoryPath: string
}

export interface CacheVersion {
  version: string
  graphVersion: string
  indexVersion: string
  lastUpdated: string
}

export class GlobalCacheManager {
  private static instance: GlobalCacheManager | null = null
  private config: CacheManagerConfig | null = null
  
  private memoryCache: Map<string, any> = new Map()
  private version: CacheVersion | null = null
  private initialized: boolean = false

  private constructor() {}

  static getInstance(): GlobalCacheManager {
    if (!GlobalCacheManager.instance) {
      GlobalCacheManager.instance = new GlobalCacheManager()
    }
    return GlobalCacheManager.instance
  }

  async initialize(projectPath: string, memoryPath: string): Promise<void> {
    this.config = { projectPath, memoryPath }
    this.initialized = true
    
    await this.loadVersion()
  }

  private async loadVersion(): Promise<void> {
    if (!this.config) return
    
    const versionPath = path.join(this.config.memoryPath, 'cache-version.json')
    
    try {
      const content = await fs.readFile(versionPath, 'utf-8')
      this.version = JSON.parse(content)
    } catch {
      this.version = {
        version: '1.0.0',
        graphVersion: '',
        indexVersion: '',
        lastUpdated: new Date().toISOString()
      }
    }
  }

  async saveVersion(): Promise<void> {
    if (!this.config || !this.version) return
    
    const versionPath = path.join(this.config.memoryPath, 'cache-version.json')
    await fs.writeFile(versionPath, JSON.stringify(this.version, null, 2), 'utf-8')
  }

  getMemoryCache<T>(key: string): T | null {
    const value = this.memoryCache.get(key)
    return value as T | null
  }

  setMemoryCache<T>(key: string, value: T): void {
    this.memoryCache.set(key, value)
  }

  invalidateCache(key: string): void {
    this.memoryCache.delete(key)
    
    if (this.version) {
      if (key === 'graph') {
        this.version.graphVersion = this.generateNewVersion()
      } else if (key === 'index') {
        this.version.indexVersion = this.generateNewVersion()
      }
      this.version.lastUpdated = new Date().toISOString()
      this.saveVersion()
    }
  }

  invalidateAll(): void {
    this.memoryCache.clear()
    
    if (this.version) {
      this.version.graphVersion = this.generateNewVersion()
      this.version.indexVersion = this.generateNewVersion()
      this.version.lastUpdated = new Date().toISOString()
      this.saveVersion()
    }
  }

  getVersion(): CacheVersion | null {
    return this.version
  }

  isInitialized(): boolean {
    return this.initialized
  }

  private generateNewVersion(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  async clear(): Promise<void> {
    this.memoryCache.clear()
    await this.saveVersion()
  }
}

export function getGlobalCacheManager(): GlobalCacheManager {
  return GlobalCacheManager.getInstance()
}
```

### 2.3 缓存管理器

```typescript
// src/utils/cache-manager.ts

import { promises as fs } from 'fs'
import path from 'path'

export interface CacheEntry<T> {
  value: T
  timestamp: number
  ttl: number
}

export interface CacheStats {
  hits: number
  misses: number
  size: number
  memoryUsage: number
}

export class MemoryCache<K, V> {
  private cache: Map<K, CacheEntry<V>> = new Map()
  private maxSize: number
  private defaultTtl: number
  private stats = { hits: 0, misses: 0 }

  constructor(options: { maxSize: number; defaultTtl: number }) {
    this.maxSize = options.maxSize
    this.defaultTtl = options.defaultTtl
  }

  get(key: K): V | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.stats.misses++
      return null
    }
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }
    
    this.stats.hits++
    return entry.value
  }

  set(key: K, value: V, ttl?: number): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU()
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl
    })
  }

  has(key: K): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  delete(key: K): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  private evictLRU(): void {
    let oldestKey: K | null = null
    let oldestTime = Infinity
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.cache.size,
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  private estimateMemoryUsage(): number {
    let size = 0
    for (const entry of this.cache.values()) {
      size += JSON.stringify(entry.value).length
    }
    return size
  }
}
```

### 2.3 图缓存管理器

```typescript
// src/core/graph-cache.ts

import { KnowledgeGraph } from '../types'
import { MemoryCache } from '../utils/cache-manager'
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
  
  private fileHashes: Map<string, string> = new Map()

  constructor(basePath: string) {
    this.basePath = basePath
    this.graphCachePath = path.join(basePath, 'graph.json')
    this.hashCachePath = path.join(basePath, 'graph-hash-cache.json')
    
    this.memoryCache = new MemoryCache<string, KnowledgeGraph>({
      maxSize: 10,
      defaultTtl: 5 * 60 * 1000 // 5 minutes
    })
  }

  async loadGraph(): Promise<KnowledgeGraph | null> {
    // L1: 内存缓存
    const cached = this.memoryCache.get('main-graph')
    if (cached) {
      console.log('[oh-memory] Graph loaded from memory cache')
      return cached
    }

    // L2: 文件缓存
    try {
      const content = await fs.readFile(this.graphCachePath, 'utf-8')
      const graph: KnowledgeGraph = JSON.parse(content)
      
      // 验证缓存有效性
      if (await this.isCacheValid(graph)) {
        this.memoryCache.set('main-graph', graph)
        console.log('[oh-memory] Graph loaded from file cache')
        return graph
      }
    } catch (error) {
      console.log('[oh-memory] No cached graph found')
    }

    return null
  }

  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    // 保存到文件
    await fs.writeFile(
      this.graphCachePath,
      JSON.stringify(graph, null, 2),
      'utf-8'
    )
    
    // 保存元数据
    const meta: GraphCacheMeta = {
      version: '1.0.0',
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      lastUpdated: new Date().toISOString(),
      hashVersion: this.computeHashVersion()
    }
    
    await fs.writeFile(
      path.join(this.basePath, 'graph-meta.json'),
      JSON.stringify(meta, null, 2),
      'utf-8'
    )
    
    // 更新内存缓存
    this.memoryCache.set('main-graph', graph)
  }

  async invalidate(): Promise<void> {
    this.memoryCache.delete('main-graph')
  }

  private async isCacheValid(graph: KnowledgeGraph): Promise<boolean> {
    try {
      const metaPath = path.join(this.basePath, 'graph-meta.json')
      const content = await fs.readFile(metaPath, 'utf-8')
      const meta: GraphCacheMeta = JSON.parse(content)
      
      // 检查哈希版本
      const currentHashVersion = this.computeHashVersion()
      if (meta.hashVersion !== currentHashVersion) {
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
}
```

### 2.4 增量索引引擎

```typescript
// src/core/incremental-indexer.ts

import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from '../types'
import { readMarkdownFile, listFiles } from '../utils/file-utils'

export interface FileChange {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'unchanged'
  oldHash?: string
  newHash?: string
}

export interface IncrementalIndexResult {
  addedNodes: string[]
  updatedNodes: string[]
  deletedNodes: string[]
  rebuildRequired: boolean
  duration: number
}

export class IncrementalIndexer {
  private basePath: string
  private fileHashes: Map<string, string> = new Map()

  constructor(basePath: string) {
    this.basePath = basePath
  }

  async detectChanges(): Promise<FileChange[]> {
    const changes: FileChange[] = []
    const categories = ['entities', 'concepts', 'sources', 'synthesis']
    
    for (const category of categories) {
      const categoryPath = path.join(this.basePath, category)
      
      if (!await this.exists(categoryPath)) {
        continue
      }

      const files = await listFiles(categoryPath, ['.md'])
      
      for (const file of files) {
        const currentHash = await this.computeFileHash(file)
        const oldHash = this.fileHashes.get(file)
        
        if (!oldHash) {
          changes.push({
            path: file,
            status: 'added',
            newHash: currentHash
          })
        } else if (oldHash !== currentHash) {
          changes.push({
            path: file,
            status: 'modified',
            oldHash,
            newHash: currentHash
          })
        } else {
          changes.push({
            path: file,
            status: 'unchanged'
          })
        }
        
        this.fileHashes.set(file, currentHash)
      }
    }

    // 检测删除的文件
    for (const [file, hash] of this.fileHashes) {
      if (!await this.exists(file)) {
        changes.push({
          path: file,
          status: 'deleted',
          oldHash: hash
        })
        this.fileHashes.delete(file)
      }
    }

    return changes
  }

  async incrementalBuild(
    existingGraph: KnowledgeGraph,
    changes: FileChange[]
  ): Promise<IncrementalIndexResult> {
    const startTime = Date.now()
    const result: IncrementalIndexResult = {
      addedNodes: [],
      updatedNodes: [],
      deletedNodes: [],
      rebuildRequired: false,
      duration: 0
    }

    // 判断是否需要全量重建
    if (this.shouldRebuildFull(changes)) {
      result.rebuildRequired = true
      result.duration = Date.now() - startTime
      return result
    }

    // 创建节点和边的映射
    const nodesMap = new Map(existingGraph.nodes.map(n => [n.id, n]))
    const edgesMap = new Map<string, KnowledgeEdge[]>()

    for (const edge of existingGraph.edges) {
      const key = `${edge.from}->${edge.to}`
      if (!edgesMap.has(key)) {
        edgesMap.set(key, [])
      }
      edgesMap.get(key)!.push(edge)
    }

    // 处理删除
    for (const change of changes.filter(c => c.status === 'deleted')) {
      const pageId = path.basename(change.path, '.md')
      nodesMap.delete(pageId)
      result.deletedNodes.push(pageId)
      
      // 删除相关的边
      for (const [key, edges] of edgesMap) {
        edgesMap.set(key, edges.filter(e => e.from !== pageId && e.to !== pageId))
      }
    }

    // 处理新增和修改
    for (const change of changes.filter(c => c.status === 'added' || c.status === 'modified')) {
      const page = await readMarkdownFile(change.path)
      
      if (!page) continue

      const pageId = path.basename(change.path, '.md')
      
      // 更新或添加节点
      const node: KnowledgeNode = {
        id: pageId,
        title: page.frontmatter.title || pageId,
        path: change.path,
        type: page.frontmatter.type || 'entity',
        tags: page.frontmatter.tags || [],
        lastUpdated: new Date().toISOString(),
        description: page.frontmatter.description
      }
      
      nodesMap.set(pageId, node)
      
      if (change.status === 'added') {
        result.addedNodes.push(pageId)
      } else {
        result.updatedNodes.push(pageId)
      }
    }

    // 重新计算边（简化处理：基于现有链接）
    // 实际实现中需要更复杂的边更新逻辑

    result.duration = Date.now() - startTime
    return result
  }

  private shouldRebuildFull(changes: FileChange[]): boolean {
    const changeCount = changes.filter(c => c.status !== 'unchanged').length
    const totalCount = this.fileHashes.size || 1
    
    // 变化超过 30% 或者超过 100 个文件变更，需要全量重建
    if (changeCount / totalCount > 0.3) {
      return true
    }
    
    if (changeCount > 100) {
      return true
    }

    return false
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private async computeFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8')
    return crypto.createHash('md5').update(content).digest('hex')
  }

  setFileHashes(hashes: Map<string, string>): void {
    this.fileHashes = hashes
  }

  getFileHashes(): Map<string, string> {
    return this.fileHashes
  }
}
```

### 2.5 修改 KnowledgeBase 类

```typescript
// src/core/knowledge-base.ts 修改

export class KnowledgeBase {
  private graphCache: GraphCache
  private incrementalIndexer: IncrementalIndexer
  private memoryCache: MemoryCache<string, any>

  constructor(projectPath: string) {
    this.projectPath = projectPath
    this.basePath = path.join(projectPath, '.memory')
    this.updater = new GraphUpdater(this.basePath)
    this.orchestrator = new IngestOrchestrator(this.basePath)
    this.analyzer = new ProjectAnalyzer(projectPath, this.basePath)
    
    // 初始化缓存
    this.graphCache = new GraphCache(this.basePath)
    this.incrementalIndexer = new IncrementalIndexer(this.basePath)
    this.memoryCache = new MemoryCache({
      maxSize: 100,
      defaultTtl: 5 * 60 * 1000
    })
  }

  async query(query: string, options?: QueryOptions): Promise<QueryResult> {
    const queryStart = Date.now()
    
    // L1: 尝试从内存缓存加载图
    if (!this.graph) {
      this.graph = await this.graphCache.loadGraph()
    }

    // 如果仍然没有图，构建索引
    if (!this.graph) {
      await this.buildGraphIndex()
    }

    // ... 原有查询逻辑
    
    const duration = Date.now() - queryStart
    
    // 记录性能指标
    console.log(`[oh-memory] Query "${query.substring(0, 30)}": ${duration}ms`)
    
    return results
  }

  async buildGraphIndex(): Promise<void> {
    const startTime = Date.now()
    
    // 检测变更
    const changes = await this.incrementalIndexer.detectChanges()
    
    // 如果有现有图，尝试增量更新
    let existingGraph = await this.graphCache.loadGraph()
    
    if (existingGraph) {
      const result = await this.incrementalIndexer.incrementalBuild(existingGraph, changes)
      
      if (result.rebuildRequired) {
        // 需要全量重建
        existingGraph = await this.fullRebuild()
      } else {
        // 增量更新成功
        this.graph = existingGraph
      }
    } else {
      // 首次构建或缓存失效，全量重建
      this.graph = await this.fullRebuild()
    }

    // 保存到缓存
    if (this.graph) {
      await this.graphCache.saveGraph(this.graph)
    }

    const duration = Date.now() - startTime
    console.log(`[oh-memory] Graph build: ${duration}ms, ${this.graph?.nodes.length ?? 0} nodes`)
  }

  private async fullRebuild(): Promise<KnowledgeGraph> {
    const pages = new Map<string, any>()
    const categories = ['entities', 'concepts', 'sources', 'synthesis']
    
    for (const category of categories) {
      const categoryPath = path.join(this.basePath, category)
      
      if (!await fileExists(categoryPath)) {
        continue
      }

      const files = await listFiles(categoryPath, ['.md'])
      
      for (const file of files) {
        const page = await readMarkdownFile(file)
        
        if (!page) continue
        
        const pageId = path.basename(file, '.md')
        
        pages.set(pageId, {
          links: page.links,
          metadata: page.frontmatter,
          filePath: file,
        })
      }
    }

    return buildGraph(pages)
  }
}
```

---

## 三、测试方案

### 3.1 缓存测试

```typescript
// tests/cache-manager.test.ts

import { describe, it, expect } from 'bun:test'
import { MemoryCache } from '../src/utils/cache-manager'

describe('MemoryCache', () => {
  const cache = new MemoryCache<string, string>({
    maxSize: 3,
    defaultTtl: 1000
  })

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1')
    expect(cache.get('key1')).toBe('value1')
  })

  it('should return null for expired entries', async () => {
    cache.set('key2', 'value2', 100)
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(cache.get('key2')).toBeNull()
  })

  it('should evict LRU entries', () => {
    cache.set('key1', 'value1')
    cache.set('key2', 'value2')
    cache.set('key3', 'value3')
    cache.set('key4', 'value4')
    
    expect(cache.get('key1')).toBeNull() // key1 should be evicted
    expect(cache.get('key4')).toBe('value4')
  })

  it('should track hits and misses', () => {
    const testCache = new MemoryCache<string, string>({
      maxSize: 10,
      defaultTtl: 60000
    })
    
    testCache.set('key1', 'value1')
    testCache.get('key1') // hit
    testCache.get('key2') // miss
    
    const stats = testCache.getStats()
    expect(stats.hits).toBe(1)
    expect(stats.misses).toBe(1)
  })
})
```

### 3.2 增量索引测试

```typescript
// tests/incremental-indexer.test.ts

import { describe, it, expect, beforeEach } from 'bun:test'
import { IncrementalIndexer } from '../src/core/incremental-indexer'
import { promises as fs } from 'fs'
import path from 'path'

describe('IncrementalIndexer', () => {
  const testDir = path.join(__dirname, 'test-memory')
  const indexer = new IncrementalIndexer(testDir)

  beforeEach(async () => {
    await fs.mkdir(path.join(testDir, 'entities'), { recursive: true })
  })

  it('should detect new files', async () => {
    await fs.writeFile(
      path.join(testDir, 'entities', 'test1.md'),
      '# Test\nContent'
    )
    
    const changes = await indexer.detectChanges()
    const testChange = changes.find(c => c.path.includes('test1.md'))
    
    expect(testChange?.status).toBe('added')
  })

  it('should detect modified files', async () => {
    const filePath = path.join(testDir, 'entities', 'test2.md')
    await fs.writeFile(filePath, '# Original')
    
    await indexer.detectChanges()
    await fs.writeFile(filePath, '# Modified')
    
    const changes = await indexer.detectChanges()
    const testChange = changes.find(c => c.path.includes('test2.md'))
    
    expect(testChange?.status).toBe('modified')
  })

  it('should detect deleted files', async () => {
    const filePath = path.join(testDir, 'entities', 'test3.md')
    await fs.writeFile(filePath, '# Test')
    
    await indexer.detectChanges()
    await fs.unlink(filePath)
    
    const changes = await indexer.detectChanges()
    const testChange = changes.find(c => c.path.includes('test3.md'))
    
    expect(testChange?.status).toBe('deleted')
  })
})
```

### 3.3 性能测试

```typescript
// tests/performance/query-performance.test.ts

import { describe, it, expect } from 'bun:test'

describe('Query Performance', () => {
  it('first query should be under 3 seconds', async () => {
    const kb = new KnowledgeBase(testProjectPath)
    await kb.initialize()
    
    const start = Date.now()
    await kb.query('authentication test')
    const duration = Date.now() - start
    
    expect(duration).toBeLessThan(3000)
  })

  it('subsequent query should be under 100ms', async () => {
    // 第一次查询
    await kb.query('authentication test')
    
    // 第二次查询
    const start = Date.now()
    await kb.query('authentication test')
    const duration = Date.now() - start
    
    expect(duration).toBeLessThan(100)
  })
})
```

---

## 四、验收标准

### 4.1 性能指标

| 指标 | 目标 | 实测方式 |
|------|------|---------|
| 首次查询 | < 3 秒 | 冷启动后第一次查询 |
| 重复查询 | < 100ms | 相同查询第二次执行 |
| 增量索引 | < 2 秒 | 10 个文件变更 |
| 全量索引 | < 30 秒 | 1000 个文件 |

### 4.2 功能验收

- [ ] 内存缓存正确工作
- [ ] 文件缓存正确工作
- [ ] 增量检测正确识别变更
- [ ] 增量索引正确更新图
- [ ] 缓存失效时正确重建
- [ ] 性能指标达到要求

### 4.3 边界情况

- [ ] 空项目正确处理
- [ ] 大型项目（1000+ 文件）不崩溃
- [ ] 缓存损坏时正确重建
- [ ] 并发查询正确处理

---

## 五、实施计划

### 5.1 开发任务

| 任务 | 预计时间 | 优先级 |
|------|---------|--------|
| 实现 MemoryCache 类 | 2h | P0 |
| 实现 GraphCache 类 | 2h | P0 |
| 实现 IncrementalIndexer 类 | 3h | P0 |
| 修改 KnowledgeBase 集成缓存 | 2h | P0 |
| 单元测试 | 2h | P1 |
| 性能测试 | 1h | P1 |
| 集成测试 | 1h | P1 |

### 5.2 里程碑

- **Day 1**: 完成缓存核心逻辑
- **Day 2**: 集成到 KnowledgeBase
- **Day 3**: 测试和优化
- **Day 4**: 性能调优和验收

---

## 六、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 缓存一致性问题 | 高 | 实现版本号校验，GlobalCacheManager 单例模式 |
| 内存泄漏 | 中 | 限制缓存大小，实现 LRU |
| 并发问题 | 中 | 使用锁或单例模式 |
| 大型项目性能 | 中 | 分片处理，流式加载 |
| 插件实例化导致缓存失效 | 高 | 使用全局缓存管理器，跨命令持久化 |

---

**设计完成 (v1.1)。已根据评审结果添加全局缓存管理器。**
