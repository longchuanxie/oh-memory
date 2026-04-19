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

  it('should search nodes by tags', () => {
    const results = engine.search(graph, 'security', { type: 'all' })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('auth')
  })

  it('should filter by type', () => {
    const results = engine.search(graph, 'auth', { type: 'entity' })
    expect(results.every(r => graph.nodes.find(n => n.id === r.id)?.type === 'entity')).toBe(true)
  })

  it('should return empty array for no matches', () => {
    const results = engine.search(graph, 'nonexistent', { type: 'all' })
    expect(results).toHaveLength(0)
  })

  it('should handle empty query', () => {
    const results = engine.search(graph, '', { type: 'all' })
    expect(results).toHaveLength(0)
  })
})
