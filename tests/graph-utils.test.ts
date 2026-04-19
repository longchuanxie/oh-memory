import { describe, it, expect, beforeEach } from 'bun:test'

import {
  buildGraph,
  findOrphanNodes,
  findBrokenLinks,
  findCycles,
  getRelatedNodes,
  searchNodes,
  exportToJSON,
  exportToMermaid,
} from '../src/utils/graph-utils'
import type { KnowledgeGraph, PageFrontmatter } from '../src/types'

describe('graph-utils', () => {
  describe('buildGraph', () => {
    it('should build graph from pages', () => {
      const pages = new Map<string, { links: string[]; metadata: PageFrontmatter }>()
      pages.set('page-a', {
        links: ['page-b', 'page-c'],
        metadata: {
          id: 'page-a',
          title: 'Page A',
          type: 'entity',
          date: '2026-04-19',
          updated: '2026-04-19',
          tags: ['test'],
        },
      })
      pages.set('page-b', {
        links: ['page-c'],
        metadata: {
          id: 'page-b',
          title: 'Page B',
          type: 'concept',
          date: '2026-04-19',
          updated: '2026-04-19',
          tags: ['test'],
        },
      })

      const graph = buildGraph(pages)

      expect(graph.nodes.length).toBe(2)
      expect(graph.edges.length).toBe(3)
    })

    it('should handle empty pages', () => {
      const pages = new Map<string, { links: string[]; metadata: PageFrontmatter }>()

      const graph = buildGraph(pages)

      expect(graph.nodes).toHaveLength(0)
      expect(graph.edges).toHaveLength(0)
    })

    it('should create nodes with correct properties', () => {
      const pages = new Map<string, { links: string[]; metadata: PageFrontmatter }>()
      pages.set('test-page', {
        links: [],
        metadata: {
          id: 'test-page',
          title: 'Test Page',
          type: 'entity',
          date: '2026-04-19',
          updated: '2026-04-19',
          tags: ['tag1', 'tag2'],
          description: 'Test description',
        },
      })

      const graph = buildGraph(pages)

      expect(graph.nodes[0].id).toBe('test-page')
      expect(graph.nodes[0].title).toBe('Test Page')
      expect(graph.nodes[0].type).toBe('entity')
      expect(graph.nodes[0].tags).toEqual(['tag1', 'tag2'])
      expect(graph.nodes[0].description).toBe('Test description')
    })

    it('should use pageId as title when title is missing', () => {
      const pages = new Map<string, { links: string[]; metadata: PageFrontmatter }>()
      pages.set('no-title', {
        links: [],
        metadata: {
          id: 'no-title',
          type: 'entity',
          date: '2026-04-19',
          updated: '2026-04-19',
          tags: [],
        },
      })

      const graph = buildGraph(pages)

      expect(graph.nodes[0].title).toBe('no-title')
    })

    it('should create edges for links', () => {
      const pages = new Map<string, { links: string[]; metadata: PageFrontmatter }>()
      pages.set('source', {
        links: ['target1', 'target2'],
        metadata: {
          id: 'source',
          title: 'Source',
          type: 'entity',
          date: '2026-04-19',
          updated: '2026-04-19',
          tags: [],
        },
      })

      const graph = buildGraph(pages)

      expect(graph.edges.length).toBe(2)
      expect(graph.edges[0].from).toBe('source')
      expect(graph.edges[0].type).toBe('references')
    })
  })

  describe('findOrphanNodes', () => {
    it('should find nodes with no inbound edges', () => {
      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'orphan', title: 'Orphan', path: '/orphan.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'linked', title: 'Linked', path: '/linked.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [
          { from: 'other', to: 'linked', type: 'references' },
        ],
      }

      const orphans = findOrphanNodes(graph)

      expect(orphans).toContain('orphan')
      expect(orphans).not.toContain('linked')
    })

    it('should return all nodes when no edges exist', () => {
      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'a', title: 'A', path: '/a.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'b', title: 'B', path: '/b.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [],
      }

      const orphans = findOrphanNodes(graph)

      expect(orphans.length).toBe(2)
    })

    it('should return empty array when all nodes have inbound edges', () => {
      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'a', title: 'A', path: '/a.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'b', title: 'B', path: '/b.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [
          { from: 'a', to: 'b', type: 'references' },
          { from: 'b', to: 'a', type: 'references' },
        ],
      }

      const orphans = findOrphanNodes(graph)

      expect(orphans).toHaveLength(0)
    })
  })

  describe('findBrokenLinks', () => {
    it('should find edges pointing to non-existent nodes', () => {
      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'exists', title: 'Exists', path: '/exists.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [
          { from: 'exists', to: 'missing', type: 'references' },
        ],
      }

      const broken = findBrokenLinks(graph)

      expect(broken.length).toBe(1)
      expect(broken[0].from).toBe('exists')
      expect(broken[0].to).toBe('missing')
    })

    it('should return empty array when all links are valid', () => {
      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'a', title: 'A', path: '/a.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'b', title: 'B', path: '/b.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [
          { from: 'a', to: 'b', type: 'references' },
        ],
      }

      const broken = findBrokenLinks(graph)

      expect(broken).toHaveLength(0)
    })

    it('should handle multiple broken links', () => {
      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'source', title: 'Source', path: '/source.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [
          { from: 'source', to: 'missing1', type: 'references' },
          { from: 'source', to: 'missing2', type: 'references' },
        ],
      }

      const broken = findBrokenLinks(graph)

      expect(broken.length).toBe(2)
    })
  })

  describe('findCycles', () => {
    it('should detect simple cycle', () => {
      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'a', title: 'A', path: '/a.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'b', title: 'B', path: '/b.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [
          { from: 'a', to: 'b', type: 'references' },
          { from: 'b', to: 'a', type: 'references' },
        ],
      }

      const cycles = findCycles(graph)

      expect(cycles.length).toBeGreaterThan(0)
    })

    it('should return empty array for acyclic graph', () => {
      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'a', title: 'A', path: '/a.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'b', title: 'B', path: '/b.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [
          { from: 'a', to: 'b', type: 'references' },
        ],
      }

      const cycles = findCycles(graph)

      expect(cycles).toHaveLength(0)
    })

    it('should detect self-loop', () => {
      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'a', title: 'A', path: '/a.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [
          { from: 'a', to: 'a', type: 'references' },
        ],
      }

      const cycles = findCycles(graph)

      expect(cycles.length).toBeGreaterThan(0)
    })

    it('should handle disconnected components', () => {
      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'a', title: 'A', path: '/a.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'b', title: 'B', path: '/b.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'c', title: 'C', path: '/c.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'd', title: 'D', path: '/d.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [
          { from: 'a', to: 'b', type: 'references' },
          { from: 'c', to: 'd', type: 'references' },
        ],
      }

      const cycles = findCycles(graph)

      expect(cycles).toHaveLength(0)
    })
  })

  describe('getRelatedNodes', () => {
    let graph: KnowledgeGraph

    beforeEach(() => {
      graph = {
        nodes: [
          { id: 'center', title: 'Center', path: '/center.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'neighbor1', title: 'Neighbor1', path: '/n1.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'neighbor2', title: 'Neighbor2', path: '/n2.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'distant', title: 'Distant', path: '/d.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [
          { from: 'center', to: 'neighbor1', type: 'references' },
          { from: 'neighbor2', to: 'center', type: 'references' },
          { from: 'neighbor1', to: 'distant', type: 'references' },
        ],
      }
    })

    it('should find directly connected nodes', () => {
      const related = getRelatedNodes(graph, 'center', 1)

      expect(related).toContain('neighbor1')
      expect(related).toContain('neighbor2')
      expect(related).not.toContain('center')
    })

    it('should respect depth parameter', () => {
      const related = getRelatedNodes(graph, 'center', 2)

      expect(related).toContain('neighbor1')
      expect(related).toContain('neighbor2')
      expect(related).toContain('distant')
    })

    it('should return empty array for non-existent node', () => {
      const related = getRelatedNodes(graph, 'nonexistent')

      expect(related).toHaveLength(0)
    })

    it('should return empty array for isolated node', () => {
      const isolatedGraph: KnowledgeGraph = {
        nodes: [
          { id: 'isolated', title: 'Isolated', path: '/isolated.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [],
      }

      const related = getRelatedNodes(isolatedGraph, 'isolated')

      expect(related).toHaveLength(0)
    })
  })

  describe('searchNodes', () => {
    let graph: KnowledgeGraph

    beforeEach(() => {
      graph = {
        nodes: [
          { id: 'auth', title: 'Authentication', path: '/auth.md', type: 'entity', tags: ['security', 'auth'], lastUpdated: '2026-04-19', description: 'User authentication system' },
          { id: 'user', title: 'User Model', path: '/user.md', type: 'entity', tags: ['model', 'user'], lastUpdated: '2026-04-19' },
          { id: 'api', title: 'API Design', path: '/api.md', type: 'concept', tags: ['api', 'design'], lastUpdated: '2026-04-19' },
        ],
        edges: [],
      }
    })

    it('should search by title', () => {
      const results = searchNodes(graph, 'auth')

      expect(results.length).toBe(1)
      expect(results[0].id).toBe('auth')
    })

    it('should search by tag', () => {
      const results = searchNodes(graph, 'security')

      expect(results.length).toBe(1)
      expect(results[0].id).toBe('auth')
    })

    it('should search by description', () => {
      const results = searchNodes(graph, 'authentication system')

      expect(results.length).toBe(1)
      expect(results[0].id).toBe('auth')
    })

    it('should be case-insensitive', () => {
      const results = searchNodes(graph, 'AUTH')

      expect(results.length).toBe(1)
    })

    it('should return empty array for no matches', () => {
      const results = searchNodes(graph, 'nonexistent')

      expect(results).toHaveLength(0)
    })

    it('should return multiple matches', () => {
      const results = searchNodes(graph, 'user')

      expect(results.length).toBe(2) // 'user' tag and 'User Model' title
    })
  })

  describe('exportToJSON', () => {
    it('should export graph to JSON string', () => {
      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'a', title: 'A', path: '/a.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [],
      }

      const json = exportToJSON(graph)

      expect(json).toContain('"id": "a"')
      expect(json).toContain('"title": "A"')
    })

    it('should produce valid JSON', () => {
      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'test', title: 'Test', path: '/test.md', type: 'entity', tags: ['tag1'], lastUpdated: '2026-04-19' },
        ],
        edges: [
          { from: 'test', to: 'other', type: 'references' },
        ],
      }

      const json = exportToJSON(graph)
      const parsed = JSON.parse(json)

      expect(parsed.nodes.length).toBe(1)
      expect(parsed.edges.length).toBe(1)
    })

    it('should handle empty graph', () => {
      const graph: KnowledgeGraph = {
        nodes: [],
        edges: [],
      }

      const json = exportToJSON(graph)
      const parsed = JSON.parse(json)

      expect(parsed.nodes).toHaveLength(0)
      expect(parsed.edges).toHaveLength(0)
    })
  })

  describe('exportToMermaid', () => {
    it('should export graph to Mermaid format', () => {
      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'a', title: 'Node A', path: '/a.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'b', title: 'Node B', path: '/b.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [
          { from: 'a', to: 'b', type: 'references' },
        ],
      }

      const mermaid = exportToMermaid(graph)

      expect(mermaid).toContain('graph TD')
      expect(mermaid).toContain('a["Node A"]')
      expect(mermaid).toContain('a --> b')
    })

    it('should handle quotes in titles', () => {
      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'a', title: 'Node "quoted"', path: '/a.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [],
      }

      const mermaid = exportToMermaid(graph)

      expect(mermaid).toContain("Node 'quoted'")
    })

    it('should handle empty graph', () => {
      const graph: KnowledgeGraph = {
        nodes: [],
        edges: [],
      }

      const mermaid = exportToMermaid(graph)

      expect(mermaid).toContain('graph TD')
    })
  })

  describe('edge cases', () => {
    it('should handle graph with only nodes', () => {
      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'a', title: 'A', path: '/a.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'b', title: 'B', path: '/b.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [],
      }

      const orphans = findOrphanNodes(graph)
      const broken = findBrokenLinks(graph)
      const cycles = findCycles(graph)

      expect(orphans.length).toBe(2)
      expect(broken).toHaveLength(0)
      expect(cycles).toHaveLength(0)
    })

    it('should handle graph with only edges (broken links)', () => {
      const graph: KnowledgeGraph = {
        nodes: [],
        edges: [
          { from: 'missing1', to: 'missing2', type: 'references' },
        ],
      }

      const broken = findBrokenLinks(graph)

      expect(broken.length).toBe(1)
    })

    it('should handle large depth in getRelatedNodes', () => {
      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'a', title: 'A', path: '/a.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'b', title: 'B', path: '/b.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [
          { from: 'a', to: 'b', type: 'references' },
        ],
      }

      const related = getRelatedNodes(graph, 'a', 100)

      expect(related).toContain('b')
    })
  })
})
