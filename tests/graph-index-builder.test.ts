import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { promises as fs } from 'fs'
import path from 'path'

import type { PageData, PageFrontmatter } from '../src/types'

import { GraphIndexBuilder } from '../src/core/graph-index-builder'

describe('GraphIndexBuilder', () => {
  let builder: GraphIndexBuilder
  let testDir: string

  beforeEach(async () => {
    testDir = path.join(process.cwd(), `test-graph-index-builder-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
    builder = new GraphIndexBuilder()
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  describe('build', () => {
    it('should build graph from pages map', async () => {
      const pages = new Map<string, PageData>([
        ['page1', {
          metadata: {
            id: 'page1',
            title: 'Page 1',
            type: 'entity',
            tags: ['test'],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: ['page2'],
          filePath: path.join(testDir, 'page1.md')
        }],
        ['page2', {
          metadata: {
            id: 'page2',
            title: 'Page 2',
            type: 'concept',
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: [],
          filePath: path.join(testDir, 'page2.md')
        }]
      ])

      const result = await builder.build(pages)

      expect(result.graph).toBeDefined()
      expect(result.graph.nodes).toHaveLength(2)
      expect(result.graph.edges).toHaveLength(1)
      expect(result.graph.edges[0].from).toBe('page1')
      expect(result.graph.edges[0].to).toBe('page2')
      expect(result.fileHashes).toBeDefined()
      expect(result.stats).toBeDefined()
    })

    it('should calculate file hashes for pages with filePath', async () => {
      const page1Path = path.join(testDir, 'page1.md')
      const page2Path = path.join(testDir, 'page2.md')

      await fs.writeFile(page1Path, '---\nid: page1\ntitle: Page 1\ntype: entity\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nContent 1', 'utf-8')
      await fs.writeFile(page2Path, '---\nid: page2\ntitle: Page 2\ntype: concept\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nContent 2', 'utf-8')

      const pages = new Map<string, PageData>([
        ['page1', {
          metadata: {
            id: 'page1',
            title: 'Page 1',
            type: 'entity',
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: [],
          filePath: page1Path
        }],
        ['page2', {
          metadata: {
            id: 'page2',
            title: 'Page 2',
            type: 'concept',
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: [],
          filePath: page2Path
        }]
      ])

      const result = await builder.build(pages)

      expect(result.fileHashes.size).toBe(2)
      expect(result.fileHashes.get(page1Path)).toBeDefined()
      expect(result.fileHashes.get(page1Path)?.pageId).toBe('page1')
      expect(result.fileHashes.get(page2Path)).toBeDefined()
      expect(result.fileHashes.get(page2Path)?.pageId).toBe('page2')
    })

    it('should handle empty pages map', async () => {
      const pages = new Map<string, PageData>()

      const result = await builder.build(pages)

      expect(result.graph.nodes).toHaveLength(0)
      expect(result.graph.edges).toHaveLength(0)
      expect(result.fileHashes.size).toBe(0)
    })

    it('should handle pages without filePath', async () => {
      const pages = new Map<string, PageData>([
        ['page1', {
          metadata: {
            id: 'page1',
            title: 'Page 1',
            type: 'entity',
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: []
        }]
      ])

      const result = await builder.build(pages)

      expect(result.graph.nodes).toHaveLength(1)
      expect(result.fileHashes.size).toBe(0)
    })

    it('should handle pages with multiple links', async () => {
      const pages = new Map<string, PageData>([
        ['hub', {
          metadata: {
            id: 'hub',
            title: 'Hub',
            type: 'entity',
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: ['page1', 'page2', 'page3']
        }],
        ['page1', {
          metadata: {
            id: 'page1',
            title: 'Page 1',
            type: 'entity',
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: []
        }],
        ['page2', {
          metadata: {
            id: 'page2',
            title: 'Page 2',
            type: 'concept',
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: []
        }],
        ['page3', {
          metadata: {
            id: 'page3',
            title: 'Page 3',
            type: 'source',
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: []
        }]
      ])

      const result = await builder.build(pages)

      expect(result.graph.nodes).toHaveLength(4)
      expect(result.graph.edges).toHaveLength(3)
    })

    it('should use default values for missing metadata', async () => {
      const pages = new Map<string, PageData>([
        ['page1', {
          metadata: {
            id: 'page1',
            title: '',
            type: 'entity',
            tags: [],
            date: '',
            updated: ''
          },
          links: []
        }]
      ])

      const result = await builder.build(pages)

      expect(result.graph.nodes[0].title).toBe('page1')
      expect(result.graph.nodes[0].lastUpdated).toBeDefined()
    })
  })

  describe('loadPagesFromDirectory', () => {
    it('should load pages from directory structure', async () => {
      const entitiesDir = path.join(testDir, 'entities')
      const conceptsDir = path.join(testDir, 'concepts')

      await fs.mkdir(entitiesDir, { recursive: true })
      await fs.mkdir(conceptsDir, { recursive: true })

      await fs.writeFile(
        path.join(entitiesDir, 'auth.md'),
        '---\nid: auth\ntitle: Authentication\ntype: entity\ntags: [security]\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nAuth content [[user]]',
        'utf-8'
      )

      await fs.writeFile(
        path.join(conceptsDir, 'pattern.md'),
        '---\nid: pattern\ntitle: Design Pattern\ntype: concept\ntags: [architecture]\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nPattern content',
        'utf-8'
      )

      const pages = await builder.loadPagesFromDirectory(testDir)

      expect(pages.size).toBe(2)
      expect(pages.has('auth')).toBe(true)
      expect(pages.has('pattern')).toBe(true)
      expect(pages.get('auth')?.links).toContain('user')
      expect(pages.get('auth')?.metadata.type).toBe('entity')
      expect(pages.get('pattern')?.metadata.type).toBe('concept')
    })

    it('should handle empty directory', async () => {
      const pages = await builder.loadPagesFromDirectory(testDir)

      expect(pages.size).toBe(0)
    })

    it('should handle missing category directories', async () => {
      const entitiesDir = path.join(testDir, 'entities')
      await fs.mkdir(entitiesDir, { recursive: true })

      await fs.writeFile(
        path.join(entitiesDir, 'test.md'),
        '---\nid: test\ntitle: Test\ntype: entity\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nTest content',
        'utf-8'
      )

      const pages = await builder.loadPagesFromDirectory(testDir)

      expect(pages.size).toBe(1)
      expect(pages.has('test')).toBe(true)
    })

    it('should handle all four categories', async () => {
      const categories = ['entities', 'concepts', 'sources', 'synthesis']

      for (const category of categories) {
        const categoryDir = path.join(testDir, category)
        await fs.mkdir(categoryDir, { recursive: true })

        await fs.writeFile(
          path.join(categoryDir, `${category}-item.md`),
          `---\nid: ${category}-item\ntitle: ${category} Item\ntype: ${category === 'entities' ? 'entity' : category === 'concepts' ? 'concept' : category === 'sources' ? 'source' : 'synthesis'}\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nContent`,
          'utf-8'
        )
      }

      const pages = await builder.loadPagesFromDirectory(testDir)

      expect(pages.size).toBe(4)
      expect(pages.has('entities-item')).toBe(true)
      expect(pages.has('concepts-item')).toBe(true)
      expect(pages.has('sources-item')).toBe(true)
      expect(pages.has('synthesis-item')).toBe(true)
    })

    it('should set filePath for each page', async () => {
      const entitiesDir = path.join(testDir, 'entities')
      await fs.mkdir(entitiesDir, { recursive: true })

      const filePath = path.join(entitiesDir, 'test.md')
      await fs.writeFile(
        filePath,
        '---\nid: test\ntitle: Test\ntype: entity\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nTest content',
        'utf-8'
      )

      const pages = await builder.loadPagesFromDirectory(testDir)

      expect(pages.get('test')?.filePath).toBeDefined()
    })

    it('should extract links from content', async () => {
      const entitiesDir = path.join(testDir, 'entities')
      await fs.mkdir(entitiesDir, { recursive: true })

      await fs.writeFile(
        path.join(entitiesDir, 'page1.md'),
        '---\nid: page1\ntitle: Page 1\ntype: entity\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nContent with [[link1]] and [[link2|display text]]',
        'utf-8'
      )

      const pages = await builder.loadPagesFromDirectory(testDir)

      expect(pages.get('page1')?.links).toContain('link1')
      expect(pages.get('page1')?.links).toContain('link2')
    })

    it('should handle malformed markdown files gracefully', async () => {
      const entitiesDir = path.join(testDir, 'entities')
      await fs.mkdir(entitiesDir, { recursive: true })

      await fs.writeFile(
        path.join(entitiesDir, 'valid.md'),
        '---\nid: valid\ntitle: Valid\ntype: entity\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nValid content',
        'utf-8'
      )

      await fs.writeFile(
        path.join(entitiesDir, 'invalid.md'),
        'This is not valid markdown with frontmatter',
        'utf-8'
      )

      const pages = await builder.loadPagesFromDirectory(testDir)

      expect(pages.size).toBeGreaterThanOrEqual(1)
      expect(pages.has('valid')).toBe(true)
    })
  })

  describe('detectChanges', () => {
    it('should detect new pages', async () => {
      const entitiesDir = path.join(testDir, 'entities')
      await fs.mkdir(entitiesDir, { recursive: true })
      await fs.writeFile(
        path.join(entitiesDir, 'new-page.md'),
        '---\nid: new-page\ntitle: New Page\ntype: entity\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nNew content',
        'utf-8'
      )

      const previousHashes = new Map<string, { hash: string; lastModified: string; pageId: string }>()
      const plan = await builder.detectChanges(testDir, previousHashes)

      expect(plan.addedNodes.length).toBeGreaterThan(0)
    })

    it('should detect deleted pages', async () => {
      const previousHashes = new Map<string, { hash: string; lastModified: string; pageId: string }>([
        ['/deleted/file.md', { hash: 'abc123', lastModified: '2026-04-19', pageId: 'deleted-page' }]
      ])

      const plan = await builder.detectChanges(testDir, previousHashes)

      expect(plan.deletedNodes).toContain('deleted-page')
    })

    it('should detect updated pages', async () => {
      const entitiesDir = path.join(testDir, 'entities')
      await fs.mkdir(entitiesDir, { recursive: true })
      await fs.writeFile(
        path.join(entitiesDir, 'updated.md'),
        '---\nid: updated\ntitle: Updated Page\ntype: entity\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nNew content',
        'utf-8'
      )

      const pages = await builder.loadPagesFromDirectory(testDir)
      const currentHashes = await builder.build(pages)
      const hashInfo = currentHashes.fileHashes

      const previousHashes = new Map<string, { hash: string; lastModified: string; pageId: string }>()
      for (const [filePath, info] of hashInfo) {
        previousHashes.set(filePath, { ...info, hash: 'old-hash' })
      }

      const plan = await builder.detectChanges(testDir, previousHashes)

      expect(plan.updatedNodes.length).toBeGreaterThan(0)
    })

    it('should return empty plan when no changes', async () => {
      const entitiesDir = path.join(testDir, 'entities')
      await fs.mkdir(entitiesDir, { recursive: true })
      await fs.writeFile(
        path.join(entitiesDir, 'stable.md'),
        '---\nid: stable\ntitle: Stable Page\ntype: entity\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nStable content',
        'utf-8'
      )

      const pages = await builder.loadPagesFromDirectory(testDir)
      const currentResult = await builder.build(pages)

      const plan = await builder.detectChanges(testDir, currentResult.fileHashes)

      expect(plan.addedNodes).toHaveLength(0)
      expect(plan.updatedNodes).toHaveLength(0)
      expect(plan.deletedNodes).toHaveLength(0)
    })
  })

  describe('incrementalUpdate', () => {
    it('should skip rebuild when no changes detected', async () => {
      const entitiesDir = path.join(testDir, 'entities')
      await fs.mkdir(entitiesDir, { recursive: true })
      await fs.writeFile(
        path.join(entitiesDir, 'stable.md'),
        '---\nid: stable\ntitle: Stable Page\ntype: entity\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nStable content',
        'utf-8'
      )

      const pages = await builder.loadPagesFromDirectory(testDir)
      const initialResult = await builder.build(pages)

      const existingGraph = initialResult.graph
      const result = await builder.incrementalUpdate(existingGraph, testDir, initialResult.fileHashes)

      expect(result.graph).toBe(existingGraph)
    })

    it('should rebuild when changes detected', async () => {
      const entitiesDir = path.join(testDir, 'entities')
      await fs.mkdir(entitiesDir, { recursive: true })
      await fs.writeFile(
        path.join(entitiesDir, 'page1.md'),
        '---\nid: page1\ntitle: Page 1\ntype: entity\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nContent 1',
        'utf-8'
      )

      const pages = await builder.loadPagesFromDirectory(testDir)
      const initialResult = await builder.build(pages)

      const previousHashes = new Map<string, { hash: string; lastModified: string; pageId: string }>()
      for (const [filePath, info] of initialResult.fileHashes) {
        previousHashes.set(filePath, { ...info, hash: 'old-hash' })
      }

      const result = await builder.incrementalUpdate(initialResult.graph, testDir, previousHashes)

      expect(result.graph).toBeDefined()
      expect(result.stats).toBeDefined()
    })
  })

  describe('computeStats', () => {
    it('should compute stats from graph', () => {
      const graph = {
        nodes: [
          { id: 'a', title: 'A', path: '/a.md', type: 'entity' as const, tags: [], lastUpdated: '2026-04-19' },
          { id: 'b', title: 'B', path: '/b.md', type: 'concept' as const, tags: [], lastUpdated: '2026-04-19' },
          { id: 'c', title: 'C', path: '/c.md', type: 'source' as const, tags: [], lastUpdated: '2026-04-19' },
          { id: 'd', title: 'D', path: '/d.md', type: 'synthesis' as const, tags: [], lastUpdated: '2026-04-19' },
        ],
        edges: [
          { from: 'a', to: 'b', type: 'references' as const },
          { from: 'c', to: 'd', type: 'references' as const },
        ]
      }

      const stats = builder.computeStats(graph)

      expect(stats.totalNodes).toBe(4)
      expect(stats.totalEdges).toBe(2)
      expect(stats.entitiesCount).toBe(1)
      expect(stats.conceptsCount).toBe(1)
      expect(stats.sourcesCount).toBe(1)
      expect(stats.synthesisCount).toBe(1)
      expect(stats.lastUpdated).toBeDefined()
    })

    it('should handle empty graph', () => {
      const graph = { nodes: [], edges: [] }

      const stats = builder.computeStats(graph)

      expect(stats.totalNodes).toBe(0)
      expect(stats.totalEdges).toBe(0)
    })
  })

  describe('integration', () => {
    it('should build graph from directory end-to-end', async () => {
      const entitiesDir = path.join(testDir, 'entities')
      const conceptsDir = path.join(testDir, 'concepts')

      await fs.mkdir(entitiesDir, { recursive: true })
      await fs.mkdir(conceptsDir, { recursive: true })

      await fs.writeFile(
        path.join(entitiesDir, 'auth.md'),
        '---\nid: auth\ntitle: Authentication\ntype: entity\ntags: [security]\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nAuth module [[user]] [[session]]',
        'utf-8'
      )

      await fs.writeFile(
        path.join(entitiesDir, 'user.md'),
        '---\nid: user\ntitle: User\ntype: entity\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nUser entity [[profile]]',
        'utf-8'
      )

      await fs.writeFile(
        path.join(conceptsDir, 'session.md'),
        '---\nid: session\ntitle: Session\ntype: concept\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nSession concept',
        'utf-8'
      )

      const pages = await builder.loadPagesFromDirectory(testDir)
      const result = await builder.build(pages)

      expect(result.graph.nodes).toHaveLength(3)
      expect(result.graph.edges).toHaveLength(3)
      expect(result.fileHashes.size).toBe(3)

      const authEdges = result.graph.edges.filter(e => e.from === 'auth')
      expect(authEdges).toHaveLength(2)
    })
  })
})
