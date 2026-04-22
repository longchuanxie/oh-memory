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
        { id: 'user', title: 'User Model', path: '/user.md', type: 'entity', tags: ['user', 'model'], lastUpdated: '2026-04-19' },
        { id: 'api', title: 'API Design', path: '/api.md', type: 'concept', tags: ['api', 'design'], lastUpdated: '2026-04-19' }
      ],
      edges: [
        { from: 'auth', to: 'user', type: 'references' },
        { from: 'api', to: 'auth', type: 'references' }
      ]
    }
  })

  describe('search', () => {
    it('should search nodes by title', () => {
      const results = engine.search(graph, 'auth', { type: 'all' })
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].node.id).toBe('auth')
    })

    it('should search nodes by tags', () => {
      const results = engine.search(graph, 'security', { type: 'all' })
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].node.id).toBe('auth')
    })

    it('should filter by type', () => {
      const results = engine.search(graph, 'auth', { type: 'entity' })
      expect(results.every(r => r.node.type === 'entity')).toBe(true)
    })

    it('should return empty array for no matches', () => {
      const results = engine.search(graph, 'nonexistent', { type: 'all' })
      expect(results).toHaveLength(0)
    })

    it('should handle empty query', () => {
      const results = engine.search(graph, '', { type: 'all' })
      expect(results).toHaveLength(0)
    })

    it('should respect limit option', () => {
      const results = engine.search(graph, 'a', { type: 'all', limit: 1 })
      expect(results.length).toBeLessThanOrEqual(1)
    })

    it('should return results with score and matchedFields', () => {
      const results = engine.search(graph, 'auth', { type: 'all' })
      expect(results[0].score).toBeGreaterThan(0)
      expect(results[0].matchedFields.length).toBeGreaterThan(0)
    })

    it('should sort results by score descending', () => {
      const results = engine.search(graph, 'a', { type: 'all' })
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
      }
    })
  })

  describe('findById', () => {
    it('should find node by id', () => {
      const node = engine.findById(graph, 'auth')
      expect(node).toBeDefined()
      expect(node!.id).toBe('auth')
    })

    it('should return undefined for non-existent id', () => {
      const node = engine.findById(graph, 'nonexistent')
      expect(node).toBeUndefined()
    })
  })

  describe('findByPath', () => {
    it('should find node by path', () => {
      const node = engine.findByPath(graph, '/auth.md')
      expect(node).toBeDefined()
      expect(node!.id).toBe('auth')
    })

    it('should return undefined for non-existent path', () => {
      const node = engine.findByPath(graph, '/nonexistent.md')
      expect(node).toBeUndefined()
    })
  })

  describe('getNeighbors', () => {
    it('should get neighbors for a node', () => {
      const traversals = engine.getNeighbors(graph, 'auth', 1)

      expect(traversals.length).toBeGreaterThan(0)
      expect(traversals[0].node.id).toBe('auth')
      expect(traversals[0].edges.length).toBeGreaterThan(0)
      expect(traversals[0].neighbors.length).toBeGreaterThan(0)
    })

    it('should return empty for isolated node', () => {
      const isolatedGraph: KnowledgeGraph = {
        nodes: [{ id: 'solo', title: 'Solo', path: '/solo.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' }],
        edges: []
      }

      const traversals = engine.getNeighbors(isolatedGraph, 'solo', 1)

      expect(traversals).toHaveLength(1)
      expect(traversals[0].neighbors).toHaveLength(0)
    })

    it('should respect depth parameter', () => {
      const traversals1 = engine.getNeighbors(graph, 'api', 1)
      const traversals2 = engine.getNeighbors(graph, 'api', 2)

      expect(traversals2.length).toBeGreaterThanOrEqual(traversals1.length)
    })
  })

  describe('buildQueryContext', () => {
    it('should build query context with results and traversals', () => {
      const context = engine.buildQueryContext(graph, 'auth', { type: 'all' })

      expect(context.query).toBe('auth')
      expect(context.results.length).toBeGreaterThan(0)
      expect(context.summary).toBeDefined()
    })

    it('should handle no matches', () => {
      const context = engine.buildQueryContext(graph, 'nonexistent', { type: 'all' })

      expect(context.results).toHaveLength(0)
      expect(context.summary).toContain('No matching')
    })
  })

  describe('generateLLMQueryPrompt', () => {
    it('should generate LLM prompt from context', () => {
      const context = engine.buildQueryContext(graph, 'auth', { type: 'all' })
      const prompt = engine.generateLLMQueryPrompt(context)

      expect(prompt).toContain('Knowledge Base Query')
      expect(prompt).toContain('auth')
    })

    it('should include related nodes in prompt', () => {
      const context = engine.buildQueryContext(graph, 'auth', { type: 'all' })
      const prompt = engine.generateLLMQueryPrompt(context)

      if (context.traversalPaths.length > 0) {
        expect(prompt).toContain('Related Nodes')
      }
    })
  })
})
