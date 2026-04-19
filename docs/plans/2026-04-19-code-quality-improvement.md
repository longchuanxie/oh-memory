# Code Quality Improvement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 系统性修复代码审计中发现的问题，提升代码质量和可维护性

**Architecture:** 分三个阶段进行：P0立即修复（上帝类拆分、类型安全、错误处理）→ P1近期修复（内存泄漏、并发控制、日志系统）→ P2计划修复（测试覆盖、配置管理、代码重复）

**Tech Stack:** TypeScript 5.0+, Bun Runtime, Jest/Vitest Testing Framework

---

## Phase 1: P0 Critical Issues (Week 1-2)

### Task 1: Extract GraphBuilder from KnowledgeBase

**Files:**
- Create: `src/core/graph-builder.ts`
- Modify: `src/core/knowledge-base.ts:1088-1210`
- Test: `tests/graph-builder.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'bun:test'
import { GraphBuilder } from '../src/core/graph-builder'
import type { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from '../src/types'

describe('GraphBuilder', () => {
  it('should build graph from pages', () => {
    const builder = new GraphBuilder()
    const pages = new Map([
      ['page1', {
        links: ['page2'],
        metadata: { id: 'page1', title: 'Page 1', type: 'entity', tags: [], date: '2026-04-19', updated: '2026-04-19' },
        filePath: '/test/page1.md'
      }]
    ])
    
    const graph = builder.build(pages)
    
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes[0].id).toBe('page1')
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0].from).toBe('page1')
    expect(graph.edges[0].to).toBe('page2')
  })
  
  it('should calculate connection stats', () => {
    const builder = new GraphBuilder()
    const pages = new Map([
      ['page1', {
        links: ['page2'],
        metadata: { id: 'page1', title: 'Page 1', type: 'entity', tags: [], date: '2026-04-19', updated: '2026-04-19' },
        filePath: '/test/page1.md'
      }],
      ['page2', {
        links: [],
        metadata: { id: 'page2', title: 'Page 2', type: 'entity', tags: [], date: '2026-04-19', updated: '2026-04-19' },
        filePath: '/test/page2.md'
      }]
    ])
    
    const stats = builder.calculateConnectionStats(pages)
    
    expect(stats.get('page1')?.outbound).toBe(1)
    expect(stats.get('page2')?.inbound).toBe(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/graph-builder.test.ts`
Expected: FAIL with "Cannot find module '../src/core/graph-builder'"

**Step 3: Write minimal implementation**

```typescript
import type { 
  KnowledgeGraph, 
  KnowledgeNode, 
  KnowledgeEdge,
  ConnectionStats 
} from '../types'

export class GraphBuilder {
  build(pages: Map<string, any>): KnowledgeGraph {
    const nodes: KnowledgeNode[] = []
    const edges: KnowledgeEdge[] = []
    
    for (const [pageId, page] of pages) {
      nodes.push({
        id: pageId,
        title: page.metadata.title || pageId,
        path: page.filePath || '',
        type: page.metadata.type || 'entity',
        tags: page.metadata.tags || [],
        lastUpdated: page.metadata.updated || new Date().toISOString(),
        description: page.metadata.summary?.description
      })
      
      for (const link of page.links) {
        edges.push({
          from: pageId,
          to: link,
          type: 'references'
        })
      }
    }
    
    return { nodes, edges }
  }
  
  calculateConnectionStats(pages: Map<string, any>): Map<string, ConnectionStats> {
    const stats = new Map<string, ConnectionStats>()
    
    for (const [pageId] of pages) {
      stats.set(pageId, { inbound: 0, outbound: 0, total: 0 })
    }
    
    for (const [pageId, page] of pages) {
      const outbound = page.links.filter((link: string) => pages.has(link)).length
      const currentStats = stats.get(pageId)!
      currentStats.outbound = outbound
    }
    
    for (const [pageId, page] of pages) {
      for (const link of page.links) {
        if (pages.has(link)) {
          const linkStats = stats.get(link)!
          linkStats.inbound++
        }
      }
    }
    
    for (const [pageId, pageStats] of stats) {
      pageStats.total = pageStats.inbound + pageStats.outbound
    }
    
    return stats
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/graph-builder.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/graph-builder.ts tests/graph-builder.test.ts
git commit -m "feat: extract GraphBuilder from KnowledgeBase

- Create GraphBuilder class for graph construction
- Add connection stats calculation
- Add comprehensive unit tests"
```

---

### Task 2: Extract IndexManager from KnowledgeBase

**Files:**
- Create: `src/core/index-manager.ts`
- Modify: `src/core/knowledge-base.ts:1274-1453`
- Test: `tests/index-manager.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'bun:test'
import { IndexManager } from '../src/core/index-manager'
import type { ConnectionStats } from '../src/types'

describe('IndexManager', () => {
  let manager: IndexManager
  
  beforeEach(() => {
    manager = new IndexManager('/tmp/test-memory')
  })
  
  it('should generate main index', async () => {
    const pages = new Map([
      ['page1', {
        metadata: { type: 'entity', title: 'Page 1', updated: '2026-04-19' },
        links: []
      }],
      ['page2', {
        metadata: { type: 'concept', title: 'Page 2', updated: '2026-04-19' },
        links: []
      }]
    ])
    
    const stats = new Map<string, ConnectionStats>([
      ['page1', { inbound: 0, outbound: 0, total: 0 }],
      ['page2', { inbound: 0, outbound: 0, total: 0 }]
    ])
    
    const graph = { nodes: [], edges: [] }
    
    await manager.generateMainIndex(pages, stats, graph)
    
    // Verify index file was created
    const indexPath = '/tmp/test-memory/graph-index.md'
    const content = await Bun.file(indexPath).text()
    expect(content).toContain('Total Nodes: 2')
    expect(content).toContain('Entities (1 nodes)')
    expect(content).toContain('Concepts (1 nodes)')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/index-manager.test.ts`
Expected: FAIL with "Cannot find module '../src/core/index-manager'"

**Step 3: Write minimal implementation**

```typescript
import path from 'path'
import { promises as fs } from 'fs'
import type { ConnectionStats, KnowledgeGraph } from '../types'

export class IndexManager {
  private basePath: string
  
  constructor(memoryPath: string) {
    this.basePath = memoryPath
  }
  
  async generateMainIndex(
    pages: Map<string, any>,
    connectionStats: Map<string, ConnectionStats>,
    graph: KnowledgeGraph
  ): Promise<void> {
    const entities = [...pages.entries()].filter(([, p]) => p.metadata.type === 'entity')
    const concepts = [...pages.entries()].filter(([, p]) => p.metadata.type === 'concept')
    const sources = [...pages.entries()].filter(([, p]) => p.metadata.type === 'source')
    const synthesis = [...pages.entries()].filter(([, p]) => p.metadata.type === 'synthesis')
    
    const hubNodes = [...connectionStats.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
    
    const recentUpdates = [...pages.entries()]
      .sort((a, b) => {
        const dateA = a[1].metadata.updated || a[1].metadata.date || ''
        const dateB = b[1].metadata.updated || b[1].metadata.date || ''
        return dateB.localeCompare(dateA)
      })
      .slice(0, 10)

    const content = `# Knowledge Graph Index

## Overview
- Total Nodes: ${pages.size}
- Total Edges: ${graph.edges.length}
- Last Updated: ${new Date().toISOString().split('T')[0]}

## Top Categories
- [[graph-entities|Entities (${entities.length} nodes)]]
- [[graph-concepts|Concepts (${concepts.length} nodes)]]
- [[graph-sources|Sources (${sources.length} nodes)]]
- [[graph-synthesis|Synthesis (${synthesis.length} nodes)]]

## Hub Nodes (High Connectivity)
${hubNodes.map(([id, stats]) => `- [[${id}]] - ${stats.total} connections`).join('\n')}

## Recent Updates
${recentUpdates.map(([id, p]) => `- [[${id}]] - Updated ${p.metadata.updated || p.metadata.date || 'unknown'}`).join('\n')}
`

    await fs.writeFile(
      path.join(this.basePath, 'graph-index.md'),
      content,
      'utf-8'
    )
  }
  
  async generateLayerIndexes(
    pages: Map<string, any>,
    connectionStats: Map<string, ConnectionStats>
  ): Promise<void> {
    const types = ['entity', 'concept', 'source', 'synthesis'] as const
    const typeNames = {
      entity: 'entities',
      concept: 'concepts',
      source: 'sources',
      synthesis: 'synthesis'
    }
    
    for (const type of types) {
      const typePages = [...pages.entries()].filter(([, p]) => p.metadata.type === type)
      
      const content = `# ${type.charAt(0).toUpperCase() + type.slice(1)} Index

## Overview
- Total: ${typePages.length} nodes
- Last Updated: ${new Date().toISOString().split('T')[0]}

## All ${type.charAt(0).toUpperCase() + type.slice(1)}s
${typePages.map(([id, p]) => {
  const stats = connectionStats.get(id)
  const desc = p.metadata.summary?.description || p.metadata.description || ''
  return `- [[${id}]] - ${stats?.total || 0} connections${desc ? ` - ${desc.substring(0, 50)}...` : ''}`
}).join('\n')}
`

      await fs.writeFile(
        path.join(this.basePath, `graph-${typeNames[type]}.md`),
        content,
        'utf-8'
      )
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/index-manager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/index-manager.ts tests/index-manager.test.ts
git commit -m "feat: extract IndexManager from KnowledgeBase

- Create IndexManager for index generation
- Support main index and layer indexes
- Add unit tests"
```

---

### Task 3: Extract QueryEngine from KnowledgeBase

**Files:**
- Create: `src/core/query-engine.ts`
- Modify: `src/core/knowledge-base.ts:998-1071`
- Test: `tests/query-engine.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'bun:test'
import { QueryEngine } from '../src/core/query-engine'
import type { KnowledgeGraph } from '../src/types'

describe('QueryEngine', () => {
  let engine: QueryEngine
  let graph: KnowledgeGraph
  
  beforeEach(() => {
    engine = new QueryEngine()
    graph = {
      nodes: [
        { id: 'auth', title: 'Authentication', path: '/auth.md', type: 'entity', tags: ['auth', 'security'], lastUpdated: '2026-04-19' },
        { id: 'user', title: 'User Model', path: '/user.md', type: 'entity', tags: ['user', 'model'], lastUpdated: '2026-04-19' }
      ],
      edges: []
    }
  })
  
  it('should tokenize query correctly', () => {
    const tokens = engine.tokenizeQuery('authentication system')
    expect(tokens).toContain('authentication')
    expect(tokens).toContain('system')
  })
  
  it('should search nodes by title', () => {
    const results = engine.search(graph, 'auth', { type: 'all' })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('auth')
  })
  
  it('should filter by type', () => {
    const results = engine.search(graph, 'auth', { type: 'entity' })
    expect(results.every(r => graph.nodes.find(n => n.id === r.id)?.type === 'entity')).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/query-engine.test.ts`
Expected: FAIL with "Cannot find module '../src/core/query-engine'"

**Step 3: Write minimal implementation**

```typescript
import type { KnowledgeGraph, QueryOptions } from '../types'

export interface QueryResult {
  id: string
  score: number
  type: string
}

export class QueryEngine {
  tokenizeQuery(query: string): string[] {
    const lower = query.toLowerCase().trim()
    
    if (!lower) {
      return []
    }
    
    const spaceTokens = lower.split(/\s+/).filter(t => t.length > 0)
    
    if (spaceTokens.length > 1) {
      return spaceTokens
    }
    
    const terms = [lower]
    
    if (lower.length > 2) {
      const maxGrams = Math.min(10, lower.length - 1)
      for (let i = 0; i < maxGrams; i++) {
        terms.push(lower.substring(i, i + 2))
      }
    }
    
    return terms
  }
  
  search(graph: KnowledgeGraph, query: string, options?: QueryOptions): QueryResult[] {
    const searchTerms = this.tokenizeQuery(query)
    
    if (searchTerms.length === 0) {
      return []
    }
    
    const scoredNodes = graph.nodes
      .map(node => ({
        id: node.id,
        score: this.calculateMatchScore(node, searchTerms),
        type: node.type,
      }))
      .filter(item => item.score > 0)
      .filter(item => !options?.type || item.type === options.type || options.type === 'all')
      .sort((a, b) => b.score - a.score)
    
    return scoredNodes.slice(0, options?.limit || 10)
  }
  
  private calculateMatchScore(node: any, searchTerms: string[]): number {
    let score = 0
    
    for (const term of searchTerms) {
      if (node.title.toLowerCase().includes(term)) {
        score += 2
      }
      if (node.tags.some((tag: string) => tag.includes(term))) {
        score += 1
      }
    }
    
    return score
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/query-engine.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/query-engine.ts tests/query-engine.test.ts
git commit -m "feat: extract QueryEngine from KnowledgeBase

- Create QueryEngine for search functionality
- Support query tokenization and scoring
- Add unit tests"
```

---

### Task 4: Refactor KnowledgeBase to use extracted classes

**Files:**
- Modify: `src/core/knowledge-base.ts`
- Test: `tests/knowledge-base.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'bun:test'
import { KnowledgeBase } from '../src/core/knowledge-base'
import type { KnowledgeGraph } from '../src/types'

describe('KnowledgeBase Refactored', () => {
  let kb: KnowledgeBase
  
  beforeEach(() => {
    kb = new KnowledgeBase('/tmp/test-project')
  })
  
  it('should use GraphBuilder for graph construction', async () => {
    await kb.initialize()
    const graph = kb.getGraph()
    
    expect(graph).toBeDefined()
    expect(graph?.nodes).toBeDefined()
    expect(graph?.edges).toBeDefined()
  })
  
  it('should use QueryEngine for queries', async () => {
    await kb.initialize()
    const result = await kb.query('test query')
    
    expect(result).toBeDefined()
    expect(result.query).toBe('test query')
    expect(Array.isArray(result.relatedPages)).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/knowledge-base.test.ts`
Expected: Tests should still pass but we need to verify integration

**Step 3: Refactor KnowledgeBase**

```typescript
// In src/core/knowledge-base.ts, replace methods with delegated calls

import { GraphBuilder } from './graph-builder'
import { IndexManager } from './index-manager'
import { QueryEngine } from './query-engine'

export class KnowledgeBase {
  private graphBuilder: GraphBuilder
  private indexManager: IndexManager
  private queryEngine: QueryEngine
  
  constructor(projectPath: string) {
    // ... existing initialization ...
    this.graphBuilder = new GraphBuilder()
    this.indexManager = new IndexManager(this.basePath)
    this.queryEngine = new QueryEngine()
  }
  
  // Replace buildGraphIndex method
  private async buildGraphIndex(): Promise<void> {
    // ... file loading logic ...
    
    // Use GraphBuilder
    this.graph = this.graphBuilder.build(pages)
    
    // Use IndexManager
    const connectionStats = this.graphBuilder.calculateConnectionStats(pages)
    await this.indexManager.generateMainIndex(pages, connectionStats, this.graph)
    await this.indexManager.generateLayerIndexes(pages, connectionStats)
    
    // ... rest of the logic ...
  }
  
  // Replace query method
  async query(query: string, options?: QueryOptions): Promise<QueryResult> {
    // ... cache checking ...
    
    const results = this.queryEngine.search(this.graph!, query, options)
    
    // ... rest of the logic ...
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/knowledge-base.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/knowledge-base.ts tests/knowledge-base.test.ts
git commit -m "refactor: integrate extracted classes into KnowledgeBase

- Use GraphBuilder for graph construction
- Use IndexManager for index generation
- Use QueryEngine for queries
- Maintain backward compatibility"
```

---

### Task 5: Create ErrorHandler for unified error handling

**Files:**
- Create: `src/utils/error-handler.ts`
- Create: `src/types/errors.ts`
- Test: `tests/error-handler.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'bun:test'
import { ErrorHandler, OhMemoryError } from '../src/utils/error-handler'

describe('ErrorHandler', () => {
  it('should normalize errors to OhMemoryError', () => {
    const handler = new ErrorHandler()
    const error = new Error('Test error')
    
    const normalized = handler.normalize(error, 'TEST_ERROR', 'high')
    
    expect(normalized).toBeInstanceOf(OhMemoryError)
    expect(normalized.code).toBe('TEST_ERROR')
    expect(normalized.severity).toBe('high')
  })
  
  it('should handle unknown errors', () => {
    const handler = new ErrorHandler()
    const normalized = handler.normalize('string error', 'UNKNOWN', 'medium')
    
    expect(normalized.message).toContain('string error')
  })
  
  it('should log errors with context', () => {
    const handler = new ErrorHandler()
    const error = new OhMemoryError('Test', 'TEST', 'high', { file: 'test.ts' })
    
    const logs: any[] = []
    handler.setLogger((log) => logs.push(log))
    
    handler.handle(error, { operation: 'test' })
    
    expect(logs.length).toBe(1)
    expect(logs[0].error).toBe(error)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/error-handler.test.ts`
Expected: FAIL with "Cannot find module '../src/utils/error-handler'"

**Step 3: Write minimal implementation**

```typescript
// src/types/errors.ts
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ErrorContext {
  operation?: string
  file?: string
  [key: string]: any
}

// src/utils/error-handler.ts
import type { ErrorSeverity, ErrorContext } from '../types/errors'

export class OhMemoryError extends Error {
  constructor(
    message: string,
    public code: string,
    public severity: ErrorSeverity,
    public context?: Record<string, any>
  ) {
    super(message)
    this.name = 'OhMemoryError'
  }
}

export class ErrorHandler {
  private logger?: (log: any) => void
  
  normalize(
    error: unknown,
    code: string,
    severity: ErrorSeverity,
    context?: Record<string, any>
  ): OhMemoryError {
    if (error instanceof OhMemoryError) {
      return error
    }
    
    let message: string
    if (error instanceof Error) {
      message = error.message
    } else if (typeof error === 'string') {
      message = error
    } else {
      message = JSON.stringify(error)
    }
    
    return new OhMemoryError(message, code, severity, context)
  }
  
  handle(error: unknown, context: ErrorContext): void {
    const normalizedError = this.normalize(error, 'UNKNOWN', 'medium', context)
    
    if (this.logger) {
      this.logger({
        timestamp: new Date().toISOString(),
        error: normalizedError,
        context
      })
    }
    
    if (normalizedError.severity === 'critical') {
      console.error('[oh-memory] CRITICAL ERROR:', normalizedError.message, normalizedError)
    }
  }
  
  setLogger(logger: (log: any) => void): void {
    this.logger = logger
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/error-handler.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/error-handler.ts src/types/errors.ts tests/error-handler.test.ts
git commit -m "feat: add unified error handling system

- Create OhMemoryError class
- Create ErrorHandler for normalization
- Support error severity levels
- Add comprehensive tests"
```

---

### Task 6: Replace any types with proper interfaces

**Files:**
- Modify: `src/core/knowledge-base.ts`
- Modify: `src/core/project-analyzer.ts`
- Modify: `src/types/index.ts`

**Step 1: Define proper interfaces**

```typescript
// Add to src/types/index.ts

export interface PageData {
  id: string
  metadata: PageFrontmatter
  content: string
  links: string[]
  filePath?: string
}

export interface DirectoryNodeData {
  name: string
  path: string
  type: 'directory' | 'file'
  children?: DirectoryNodeData[]
  fileCount?: number
}

export interface WalkOptions {
  ignorePatterns?: string[]
  maxDepth?: number
  fileExtensions?: string[]
}
```

**Step 2: Replace any in knowledge-base.ts**

```typescript
// Before
private calculateConnectionStats(pages: Map<string, any>): Map<string, ConnectionStats>

// After
private calculateConnectionStats(pages: Map<string, PageData>): Map<string, ConnectionStats>

// Before
const pages = new Map<string, any>()

// After
const pages = new Map<string, PageData>()
```

**Step 3: Replace any in project-analyzer.ts**

```typescript
// Before
const directories: any[] = []

// After
const directories: DirectoryNodeData[] = []

// Before
const children: any[] = []

// After
const children: DirectoryNodeData[] = []
```

**Step 4: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/types/index.ts src/core/knowledge-base.ts src/core/project-analyzer.ts
git commit -m "refactor: replace any types with proper interfaces

- Add PageData, DirectoryNodeData interfaces
- Replace all any types in KnowledgeBase
- Replace all any types in ProjectAnalyzer
- Improve type safety"
```

---

## Phase 2: P1 Important Issues (Week 3-4)

### Task 7: Fix memory leak in GlobalCacheManager

**Files:**
- Modify: `src/core/global-cache-manager.ts`
- Test: `tests/global-cache-manager.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { GlobalCacheManager } from '../src/core/global-cache-manager'

describe('GlobalCacheManager Memory Management', () => {
  let manager: GlobalCacheManager
  
  beforeEach(() => {
    GlobalCacheManager.reset()
    manager = GlobalCacheManager.getInstance()
  })
  
  it('should enforce max cache size', () => {
    manager.setMemoryCache('key1', 'value1')
    manager.setMemoryCache('key2', 'value2')
    
    // Set max size to 1
    manager.setMaxSize(1)
    
    expect(manager.hasMemoryCache('key1')).toBe(false)
    expect(manager.hasMemoryCache('key2')).toBe(true)
  })
  
  it('should cleanup expired entries', async () => {
    manager.setMemoryCache('key1', 'value1', 100) // 100ms TTL
    
    expect(manager.hasMemoryCache('key1')).toBe(true)
    
    await new Promise(resolve => setTimeout(resolve, 150))
    
    manager.cleanup()
    
    expect(manager.hasMemoryCache('key1')).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/global-cache-manager.test.ts`
Expected: FAIL with "setMaxSize is not a function"

**Step 3: Implement memory management**

```typescript
// In src/core/global-cache-manager.ts

export class GlobalCacheManager {
  private static instance: GlobalCacheManager | null = null
  private config: CacheManagerConfig | null = null
  
  private memoryCache: Map<string, CacheEntry<any>> = new Map()
  private maxSize: number = 100
  private cleanupInterval?: Timer
  private version: CacheVersion | null = null
  private initialized: boolean = false

  private constructor() {}

  setMaxSize(size: number): void {
    this.maxSize = size
    this.enforceMaxSize()
  }
  
  setMemoryCache<T>(key: string, value: T, ttl?: number): void {
    if (this.memoryCache.size >= this.maxSize) {
      this.enforceMaxSize()
    }
    
    this.memoryCache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl || Infinity
    })
  }
  
  getMemoryCache<T>(key: string): T | null {
    const entry = this.memoryCache.get(key)
    
    if (!entry) {
      return null
    }
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key)
      return null
    }
    
    return entry.value as T
  }
  
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key)
      }
    }
  }
  
  private enforceMaxSize(): void {
    while (this.memoryCache.size > this.maxSize) {
      const oldestKey = this.memoryCache.keys().next().value
      if (oldestKey) {
        this.memoryCache.delete(oldestKey)
      }
    }
  }
  
  async initialize(projectPath: string, memoryPath: string): Promise<void> {
    if (this.initialized && this.config?.projectPath === projectPath) {
      return
    }
    
    this.config = { projectPath, memoryPath }
    this.initialized = true
    
    await this.loadVersion()
    this.startCleanupTimer()
  }
  
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }
  
  static reset(): void {
    if (GlobalCacheManager.instance) {
      if (GlobalCacheManager.instance.cleanupInterval) {
        clearInterval(GlobalCacheManager.instance.cleanupInterval)
      }
    }
    GlobalCacheManager.instance = null
  }
}

interface CacheEntry<T> {
  value: T
  timestamp: number
  ttl: number
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/global-cache-manager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/global-cache-manager.ts tests/global-cache-manager.test.ts
git commit -m "fix: add memory management to GlobalCacheManager

- Add max size limit
- Add TTL-based cleanup
- Add periodic cleanup timer
- Prevent memory leaks"
```

---

### Task 8: Create structured logging system

**Files:**
- Create: `src/utils/logger.ts`
- Create: `src/types/logging.ts`
- Test: `tests/logger.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'bun:test'
import { Logger, LogLevel } from '../src/utils/logger'

describe('Logger', () => {
  let logger: Logger
  let logs: any[]
  
  beforeEach(() => {
    logs = []
    logger = new Logger('info', [{
      write: (entry) => logs.push(entry)
    }])
  })
  
  it('should log info messages', () => {
    logger.info('Test message', { key: 'value' })
    
    expect(logs.length).toBe(1)
    expect(logs[0].level).toBe('info')
    expect(logs[0].message).toBe('Test message')
    expect(logs[0].context.key).toBe('value')
  })
  
  it('should respect log level', () => {
    const debugLogger = new Logger('error', [{
      write: (entry) => logs.push(entry)
    }])
    
    debugLogger.info('This should not be logged')
    debugLogger.error('This should be logged')
    
    expect(logs.length).toBe(1)
    expect(logs[0].level).toBe('error')
  })
  
  it('should include timestamp and prefix', () => {
    logger.info('Test')
    
    expect(logs[0].timestamp).toBeDefined()
    expect(logs[0].prefix).toBe('[oh-memory]')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/logger.test.ts`
Expected: FAIL with "Cannot find module '../src/utils/logger'"

**Step 3: Write minimal implementation**

```typescript
// src/types/logging.ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  prefix: string
  context?: Record<string, any>
  traceId?: string
}

export interface LogTransport {
  write(entry: LogEntry): void
}

// src/utils/logger.ts
import type { LogLevel, LogEntry, LogTransport } from '../types/logging'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

export class Logger {
  private level: LogLevel
  private transports: LogTransport[]
  private prefix: string = '[oh-memory]'
  
  constructor(level: LogLevel, transports: LogTransport[] = []) {
    this.level = level
    this.transports = transports
  }
  
  log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) {
      return
    }
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      prefix: this.prefix,
      context
    }
    
    for (const transport of this.transports) {
      transport.write(entry)
    }
  }
  
  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context)
  }
  
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context)
  }
  
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context)
  }
  
  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', message, {
      ...context,
      error: error?.stack || error?.message
    })
  }
}

// Console transport
export class ConsoleTransport implements LogTransport {
  write(entry: LogEntry): void {
    const output = `${entry.prefix} ${entry.message}`
    
    switch (entry.level) {
      case 'error':
        console.error(output, entry.context || '')
        break
      case 'warn':
        console.warn(output, entry.context || '')
        break
      default:
        console.log(output, entry.context || '')
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/logger.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/logger.ts src/types/logging.ts tests/logger.test.ts
git commit -m "feat: add structured logging system

- Create Logger with log levels
- Support multiple transports
- Add ConsoleTransport implementation
- Replace console.log calls"
```

---

### Task 9: Replace console.log with Logger

**Files:**
- Modify: All files with console.log calls
- Test: Run all tests

**Step 1: Create logger instance**

```typescript
// src/utils/logger.ts - add singleton
let globalLogger: Logger | null = null

export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger('info', [new ConsoleTransport()])
  }
  return globalLogger
}

export function setLogger(logger: Logger): void {
  globalLogger = logger
}
```

**Step 2: Replace in knowledge-base.ts**

```typescript
import { getLogger } from '../utils/logger'

// Replace
console.log('[oh-memory] Graph build: ${duration}ms')

// With
const logger = getLogger()
logger.info('Graph build completed', { duration, pages: pages.size })
```

**Step 3: Replace in ingest-orchestrator.ts**

```typescript
import { getLogger } from '../utils/logger'

// Replace all console.log calls
const logger = getLogger()
logger.info('Ingest starting', { totalFiles: analysis.totalFiles })
```

**Step 4: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/core/*.ts src/utils/*.ts
git commit -m "refactor: replace console.log with structured logging

- Use Logger instead of console.log
- Add context to log messages
- Improve log consistency"
```

---

## Phase 3: P2 General Issues (Week 5-8)

### Task 10: Add comprehensive tests

**Files:**
- Create: `tests/knowledge-base.test.ts`
- Create: `tests/ingest-orchestrator.test.ts`
- Create: `tests/project-analyzer.test.ts`

**Step 1: Write comprehensive tests**

```typescript
// tests/knowledge-base.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { KnowledgeBase } from '../src/core/knowledge-base'
import { promises as fs } from 'fs'
import path from 'path'

describe('KnowledgeBase Integration', () => {
  let kb: KnowledgeBase
  let testDir: string
  
  beforeEach(async () => {
    testDir = await fs.mkdtemp('/tmp/oh-memory-test-')
    kb = new KnowledgeBase(testDir)
  })
  
  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })
  
  it('should initialize knowledge base structure', async () => {
    await kb.initialize()
    
    const dirs = ['entities', 'concepts', 'sources', 'synthesis']
    for (const dir of dirs) {
      const dirPath = path.join(testDir, '.memory', dir)
      const exists = await fs.access(dirPath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    }
  })
  
  it('should ingest files correctly', async () => {
    await kb.initialize()
    
    // Create test file
    const testFile = path.join(testDir, 'test.ts')
    await fs.writeFile(testFile, 'export const test = "hello"', 'utf-8')
    
    const result = await kb.ingestFiles([testFile])
    
    expect(result.success).toBe(true)
    expect(result.processedFiles).toBe(1)
    expect(result.createdPages.length).toBeGreaterThan(0)
  })
})
```

**Step 2: Run tests**

Run: `bun test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/*.test.ts
git commit -m "test: add comprehensive integration tests

- Add KnowledgeBase integration tests
- Add IngestOrchestrator tests
- Add ProjectAnalyzer tests
- Improve test coverage"
```

---

### Task 11: Create configuration manager

**Files:**
- Create: `src/utils/config-manager.ts`
- Create: `src/types/config.ts`
- Test: `tests/config-manager.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'bun:test'
import { ConfigManager } from '../src/utils/config-manager'

describe('ConfigManager', () => {
  it('should load default config', () => {
    const manager = new ConfigManager()
    const config = manager.loadDefaults()
    
    expect(config.evolution.enabled).toBe(true)
    expect(config.cache.maxSize).toBe(100)
    expect(config.logging.level).toBe('info')
  })
  
  it('should merge configs correctly', () => {
    const manager = new ConfigManager()
    const config = manager.merge(
      { evolution: { enabled: false } },
      { cache: { maxSize: 200 } }
    )
    
    expect(config.evolution.enabled).toBe(false)
    expect(config.cache.maxSize).toBe(200)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/config-manager.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/types/config.ts
export interface OhMemoryConfig {
  evolution: {
    enabled: boolean
    watchPatterns: string[]
    ignorePatterns: string[]
    updateThreshold: number
    requireApproval: boolean
  }
  cache: {
    maxSize: number
    ttl: number
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    transports: string[]
  }
  performance: {
    concurrency: number
    batchSize: number
  }
}

// src/utils/config-manager.ts
import type { OhMemoryConfig } from '../types/config'

export class ConfigManager {
  loadDefaults(): OhMemoryConfig {
    return {
      evolution: {
        enabled: true,
        watchPatterns: ['src/**/*.ts', 'src/**/*.js'],
        ignorePatterns: ['**/*.test.ts', '**/node_modules/**'],
        updateThreshold: 10,
        requireApproval: true
      },
      cache: {
        maxSize: 100,
        ttl: 300000 // 5 minutes
      },
      logging: {
        level: 'info',
        transports: ['console']
      },
      performance: {
        concurrency: 10,
        batchSize: 50
      }
    }
  }
  
  merge(...configs: Partial<OhMemoryConfig>[]): OhMemoryConfig {
    const result = this.loadDefaults()
    
    for (const config of configs) {
      Object.assign(result, config)
    }
    
    return result
  }
  
  validate(config: OhMemoryConfig): boolean {
    return (
      config.cache.maxSize > 0 &&
      config.performance.concurrency > 0 &&
      ['debug', 'info', 'warn', 'error'].includes(config.logging.level)
    )
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/config-manager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/config-manager.ts src/types/config.ts tests/config-manager.test.ts
git commit -m "feat: add configuration management system

- Create ConfigManager for unified config
- Support default, file, and env configs
- Add config validation
- Improve configuration consistency"
```

---

## Execution Strategy

### Subagent-Driven Development
Each task will be executed by a fresh subagent with:
- Clear context and requirements
- Specific files to modify
- Test-driven approach
- Code review after completion

### Quality Gates
- All tests must pass before commit
- No TypeScript errors
- Code review required
- Documentation updated

### Progress Tracking
- Use TodoWrite to track task completion
- Mark tasks as in_progress when starting
- Mark as completed after successful commit

---

## Success Criteria

### Phase 1 (P0) Success Metrics:
- ✅ KnowledgeBase class reduced to <500 lines
- ✅ Zero `any` types in core modules
- ✅ Unified error handling across all modules
- ✅ All tests passing

### Phase 2 (P1) Success Metrics:
- ✅ No memory leaks in long-running processes
- ✅ Structured logging with context
- ✅ All console.log replaced with Logger
- ✅ Performance improvements measurable

### Phase 3 (P2) Success Metrics:
- ✅ Test coverage >80%
- ✅ Configuration centralized
- ✅ Code duplication <5%
- ✅ Documentation complete

---

## Risk Mitigation

### Breaking Changes
- Maintain backward compatibility
- Use feature flags for major changes
- Comprehensive testing before merge

### Performance Regression
- Benchmark before and after refactoring
- Monitor memory usage
- Profile critical paths

### Team Coordination
- Regular code reviews
- Pair programming for complex tasks
- Daily standups on progress
