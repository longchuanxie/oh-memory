import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { promises as fs } from 'fs'
import path from 'path'
import { CacheCoordinator } from '../src/core/cache-coordinator'
import type { KnowledgeGraph } from '../src/types'

describe('CacheCoordinator', () => {
  let coordinator: CacheCoordinator
  let testDir: string
  let graphPath: string

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(process.cwd(), 'test-cache-coordinator-' + Date.now())
    await fs.mkdir(testDir, { recursive: true })

    // Create category directories
    const categories = ['entities', 'concepts', 'sources', 'synthesis']
    for (const category of categories) {
      await fs.mkdir(path.join(testDir, category), { recursive: true })
    }

    graphPath = path.join(testDir, 'graph.json')
    coordinator = new CacheCoordinator(testDir)
  })

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('loadGraphCache', () => {
    it('should return null when graph cache does not exist', async () => {
      const result = await coordinator.loadGraphCache()
      expect(result).toBeNull()
    })

    it('should load valid graph cache from file', async () => {
      const testGraph: KnowledgeGraph = {
        nodes: [
          { id: 'test-1', title: 'Test Node', path: '/test', type: 'entity', tags: [], lastUpdated: '2024-01-01' }
        ],
        edges: []
      }

      await fs.writeFile(graphPath, JSON.stringify(testGraph), 'utf-8')

      const result = await coordinator.loadGraphCache()
      expect(result).not.toBeNull()
      expect(result?.nodes.length).toBe(1)
      expect(result?.nodes[0].id).toBe('test-1')
    })

    it('should return null and log warning for invalid JSON', async () => {
      await fs.writeFile(graphPath, 'invalid json content', 'utf-8')

      const result = await coordinator.loadGraphCache()
      expect(result).toBeNull()
    })

    it('should handle empty graph file', async () => {
      await fs.writeFile(graphPath, '{}', 'utf-8')

      const result = await coordinator.loadGraphCache()
      expect(result).not.toBeNull()
      expect(result?.nodes).toBeUndefined()
    })
  })

  describe('isGraphCacheValid', () => {
    it('should return false when graph cache does not exist', async () => {
      const result = await coordinator.isGraphCacheValid()
      expect(result).toBe(false)
    })

    it('should return true when graph is newer than all pages', async () => {
      // Create older page files first
      const entityPath = path.join(testDir, 'entities', 'test.md')
      await fs.writeFile(entityPath, '---\nid: test\n---\ncontent', 'utf-8')

      // Wait to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100))

      // Create newer graph file
      const testGraph: KnowledgeGraph = {
        nodes: [],
        edges: []
      }
      await fs.writeFile(graphPath, JSON.stringify(testGraph), 'utf-8')

      const result = await coordinator.isGraphCacheValid()
      expect(result).toBe(true)
    })

    it('should return false when a page is newer than graph', async () => {
      // Create older graph file
      const testGraph: KnowledgeGraph = {
        nodes: [],
        edges: []
      }
      await fs.writeFile(graphPath, JSON.stringify(testGraph), 'utf-8')

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50))

      // Create newer page file
      const entityPath = path.join(testDir, 'entities', 'newer.md')
      await fs.writeFile(entityPath, '---\nid: newer\n---\ncontent', 'utf-8')

      const result = await coordinator.isGraphCacheValid()
      expect(result).toBe(false)
    })

    it('should return true when category directories do not exist', async () => {
      // Create graph file
      const testGraph: KnowledgeGraph = {
        nodes: [],
        edges: []
      }
      await fs.writeFile(graphPath, JSON.stringify(testGraph), 'utf-8')

      // Remove category directories
      const categories = ['entities', 'concepts', 'sources', 'synthesis']
      for (const category of categories) {
        await fs.rm(path.join(testDir, category), { recursive: true })
      }

      const result = await coordinator.isGraphCacheValid()
      expect(result).toBe(true)
    })

    it('should handle empty category directories', async () => {
      // Create graph file
      const testGraph: KnowledgeGraph = {
        nodes: [],
        edges: []
      }
      await fs.writeFile(graphPath, JSON.stringify(testGraph), 'utf-8')

      // Category directories exist but are empty
      const result = await coordinator.isGraphCacheValid()
      expect(result).toBe(true)
    })
  })

  describe('getQueryCache', () => {
    it('should return a MemoryCache instance', () => {
      const cache = coordinator.getQueryCache()
      expect(cache).toBeDefined()
      expect(typeof cache.get).toBe('function')
      expect(typeof cache.set).toBe('function')
    })

    it('should return the same cache instance on multiple calls', () => {
      const cache1 = coordinator.getQueryCache()
      const cache2 = coordinator.getQueryCache()

      cache1.set('test-key', {
        query: 'test',
        answer: 'answer',
        sources: [],
        relatedPages: []
      })

      expect(cache2.get('test-key')).not.toBeNull()
    })

    it('should support query result caching', () => {
      const cache = coordinator.getQueryCache()
      const result = {
        query: 'test query',
        answer: 'test answer',
        sources: ['source1'],
        relatedPages: ['page1']
      }

      cache.set('query-key', result)
      const cached = cache.get('query-key')

      expect(cached).not.toBeNull()
      expect(cached?.query).toBe('test query')
      expect(cached?.answer).toBe('test answer')
    })
  })

  describe('clearAllCaches', () => {
    it('should clear query cache', () => {
      const cache = coordinator.getQueryCache()
      cache.set('key1', {
        query: 'q1',
        answer: 'a1',
        sources: [],
        relatedPages: []
      })
      cache.set('key2', {
        query: 'q2',
        answer: 'a2',
        sources: [],
        relatedPages: []
      })

      coordinator.clearAllCaches()

      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBeNull()
    })

    it('should handle clearing empty caches', () => {
      // Should not throw
      coordinator.clearAllCaches()
      expect(true).toBe(true)
    })
  })

  describe('integration', () => {
    it('should coordinate graph cache and query cache', async () => {
      // Load graph cache
      const testGraph: KnowledgeGraph = {
        nodes: [
          { id: 'node-1', title: 'Node 1', path: '/node1', type: 'entity', tags: ['tag1'], lastUpdated: '2024-01-01' }
        ],
        edges: []
      }
      await fs.writeFile(graphPath, JSON.stringify(testGraph), 'utf-8')

      const loadedGraph = await coordinator.loadGraphCache()
      expect(loadedGraph).not.toBeNull()

      // Cache a query result
      const queryCache = coordinator.getQueryCache()
      queryCache.set('test-query', {
        query: 'test',
        answer: 'result',
        sources: ['node-1'],
        relatedPages: ['node-1']
      })

      // Clear all caches
      coordinator.clearAllCaches()
      expect(queryCache.get('test-query')).toBeNull()

      // Graph cache file should still exist
      const reloadedGraph = await coordinator.loadGraphCache()
      expect(reloadedGraph).not.toBeNull()
    })
  })
})
