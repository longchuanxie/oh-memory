import { describe, it, expect } from 'bun:test'
import { GraphBuilder } from '../src/core/graph-builder'
import type { KnowledgeGraph, ConnectionStats, PageFrontmatter } from '../src/types'

describe('GraphBuilder', () => {
  describe('build', () => {
    it('should build graph from pages', () => {
      const builder = new GraphBuilder()
      const pages = new Map([
        ['page1', {
          links: ['page2'],
          metadata: {
            id: 'page1',
            title: 'Page 1',
            type: 'entity' as const,
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/page1.md'
        }]
      ])

      const graph = builder.build(pages)

      expect(graph.nodes).toHaveLength(1)
      expect(graph.nodes[0].id).toBe('page1')
      expect(graph.nodes[0].title).toBe('Page 1')
      expect(graph.nodes[0].type).toBe('entity')
      expect(graph.edges).toHaveLength(1)
      expect(graph.edges[0].from).toBe('page1')
      expect(graph.edges[0].to).toBe('page2')
    })

    it('should handle pages without links', () => {
      const builder = new GraphBuilder()
      const pages = new Map([
        ['page1', {
          links: [],
          metadata: {
            id: 'page1',
            title: 'Page 1',
            type: 'entity' as const,
            tags: ['test'],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/page1.md'
        }]
      ])

      const graph = builder.build(pages)

      expect(graph.nodes).toHaveLength(1)
      expect(graph.edges).toHaveLength(0)
    })

    it('should handle multiple pages with connections', () => {
      const builder = new GraphBuilder()
      const pages = new Map([
        ['page1', {
          links: ['page2', 'page3'],
          metadata: {
            id: 'page1',
            title: 'Page 1',
            type: 'entity' as const,
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/page1.md'
        }],
        ['page2', {
          links: ['page3'],
          metadata: {
            id: 'page2',
            title: 'Page 2',
            type: 'concept' as const,
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/page2.md'
        }],
        ['page3', {
          links: [],
          metadata: {
            id: 'page3',
            title: 'Page 3',
            type: 'source' as const,
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/page3.md'
        }]
      ])

      const graph = builder.build(pages)

      expect(graph.nodes).toHaveLength(3)
      expect(graph.edges).toHaveLength(3)
    })

    it('should handle empty pages map', () => {
      const builder = new GraphBuilder()
      const pages = new Map()

      const graph = builder.build(pages)

      expect(graph.nodes).toHaveLength(0)
      expect(graph.edges).toHaveLength(0)
    })

    it('should use default values for missing metadata', () => {
      const builder = new GraphBuilder()
      const pages = new Map([
        ['page1', {
          links: [],
          metadata: {
            id: 'page1',
            title: 'Page 1',
            type: 'entity' as const,
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/page1.md'
        }]
      ])

      const graph = builder.build(pages)

      expect(graph.nodes[0].path).toBeDefined()
      expect(graph.nodes[0].lastUpdated).toBeDefined()
    })
  })

  describe('calculateConnectionStats', () => {
    it('should calculate connection stats', () => {
      const builder = new GraphBuilder()
      const pages = new Map([
        ['page1', {
          links: ['page2'],
          metadata: {
            id: 'page1',
            title: 'Page 1',
            type: 'entity' as const,
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/page1.md'
        }],
        ['page2', {
          links: [],
          metadata: {
            id: 'page2',
            title: 'Page 2',
            type: 'entity' as const,
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/page2.md'
        }]
      ])

      const stats = builder.calculateConnectionStats(pages)

      expect(stats.get('page1')?.outbound).toBe(1)
      expect(stats.get('page1')?.inbound).toBe(0)
      expect(stats.get('page1')?.total).toBe(1)
      expect(stats.get('page2')?.inbound).toBe(1)
      expect(stats.get('page2')?.outbound).toBe(0)
      expect(stats.get('page2')?.total).toBe(1)
    })

    it('should handle pages with multiple connections', () => {
      const builder = new GraphBuilder()
      const pages = new Map([
        ['hub', {
          links: ['page1', 'page2', 'page3'],
          metadata: {
            id: 'hub',
            title: 'Hub',
            type: 'entity' as const,
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/hub.md'
        }],
        ['page1', {
          links: ['hub'],
          metadata: {
            id: 'page1',
            title: 'Page 1',
            type: 'entity' as const,
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/page1.md'
        }],
        ['page2', {
          links: [],
          metadata: {
            id: 'page2',
            title: 'Page 2',
            type: 'entity' as const,
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/page2.md'
        }],
        ['page3', {
          links: [],
          metadata: {
            id: 'page3',
            title: 'Page 3',
            type: 'entity' as const,
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/page3.md'
        }]
      ])

      const stats = builder.calculateConnectionStats(pages)

      expect(stats.get('hub')?.outbound).toBe(3)
      expect(stats.get('hub')?.inbound).toBe(1)
      expect(stats.get('hub')?.total).toBe(4)
      expect(stats.get('page1')?.total).toBe(2)
    })

    it('should ignore links to non-existent pages', () => {
      const builder = new GraphBuilder()
      const pages = new Map([
        ['page1', {
          links: ['nonexistent'],
          metadata: {
            id: 'page1',
            title: 'Page 1',
            type: 'entity' as const,
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/page1.md'
        }]
      ])

      const stats = builder.calculateConnectionStats(pages)

      expect(stats.get('page1')?.outbound).toBe(0)
      expect(stats.get('page1')?.total).toBe(0)
    })

    it('should handle empty pages map', () => {
      const builder = new GraphBuilder()
      const pages = new Map()

      const stats = builder.calculateConnectionStats(pages)

      expect(stats.size).toBe(0)
    })

    it('should handle pages with no links', () => {
      const builder = new GraphBuilder()
      const pages = new Map([
        ['orphan', {
          links: [],
          metadata: {
            id: 'orphan',
            title: 'Orphan Page',
            type: 'entity' as const,
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/orphan.md'
        }]
      ])

      const stats = builder.calculateConnectionStats(pages)

      expect(stats.get('orphan')?.inbound).toBe(0)
      expect(stats.get('orphan')?.outbound).toBe(0)
      expect(stats.get('orphan')?.total).toBe(0)
    })
  })

  describe('integration', () => {
    it('should build graph and calculate stats consistently', () => {
      const builder = new GraphBuilder()
      const pages = new Map([
        ['a', {
          links: ['b', 'c'],
          metadata: {
            id: 'a',
            title: 'A',
            type: 'entity' as const,
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/a.md'
        }],
        ['b', {
          links: ['c'],
          metadata: {
            id: 'b',
            title: 'B',
            type: 'concept' as const,
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/b.md'
        }],
        ['c', {
          links: [],
          metadata: {
            id: 'c',
            title: 'C',
            type: 'source' as const,
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          filePath: '/test/c.md'
        }]
      ])

      const graph = builder.build(pages)
      const stats = builder.calculateConnectionStats(pages)

      // Verify graph edges match connection stats
      const edgesFromA = graph.edges.filter(e => e.from === 'a')
      expect(edgesFromA.length).toBe(stats.get('a')?.outbound)

      const edgesToC = graph.edges.filter(e => e.to === 'c')
      expect(edgesToC.length).toBe(stats.get('c')?.inbound)
    })
  })
})
