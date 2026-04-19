import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { promises as fs } from 'fs'
import path from 'path'

import type { PageData, PageFrontmatter, KnowledgeGraph } from '../src/types'

// Interface for file hash info
interface FileHashInfo {
  hash: string
  lastModified: string
  pageId: string
}

// Interface for batch file item
interface BatchFileItem {
  category: string
  path: string
}

// Interface for process batch result
interface ProcessBatchResult {
  filePath: string
  page: {
    frontmatter: PageFrontmatter
    content: string
    links: string[]
  }
  stats: { mtime: Date }
  hash: string
}

// Import will fail initially - this is expected in TDD
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

  describe('chunkArray', () => {
    it('should split array into chunks of specified size', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const chunks = builder.chunkArray(array, 3)

      expect(chunks).toHaveLength(4)
      expect(chunks[0]).toEqual([1, 2, 3])
      expect(chunks[1]).toEqual([4, 5, 6])
      expect(chunks[2]).toEqual([7, 8, 9])
      expect(chunks[3]).toEqual([10])
    })

    it('should handle array smaller than chunk size', () => {
      const array = [1, 2]
      const chunks = builder.chunkArray(array, 5)

      expect(chunks).toHaveLength(1)
      expect(chunks[0]).toEqual([1, 2])
    })

    it('should handle empty array', () => {
      const array: number[] = []
      const chunks = builder.chunkArray(array, 3)

      expect(chunks).toHaveLength(0)
    })

    it('should handle exact division', () => {
      const array = [1, 2, 3, 4, 6, 8]
      const chunks = builder.chunkArray(array, 2)

      expect(chunks).toHaveLength(3)
      expect(chunks[0]).toEqual([1, 2])
      expect(chunks[1]).toEqual([3, 4])
      expect(chunks[2]).toEqual([6, 8])
    })

    it('should handle chunk size of 1', () => {
      const array = [1, 2, 3]
      const chunks = builder.chunkArray(array, 1)

      expect(chunks).toHaveLength(3)
      expect(chunks[0]).toEqual([1])
      expect(chunks[1]).toEqual([2])
      expect(chunks[2]).toEqual([3])
    })
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
    })

    it('should calculate file hashes for pages with filePath', async () => {
      // Create test files
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
      // Create test directory structure
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
      // Only create entities directory
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

      expect(pages.get('test')?.filePath).toBe(filePath)
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

      // Valid file
      await fs.writeFile(
        path.join(entitiesDir, 'valid.md'),
        '---\nid: valid\ntitle: Valid\ntype: entity\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nValid content',
        'utf-8'
      )

      // Invalid file (no frontmatter)
      await fs.writeFile(
        path.join(entitiesDir, 'invalid.md'),
        'This is not valid markdown with frontmatter',
        'utf-8'
      )

      const pages = await builder.loadPagesFromDirectory(testDir)

      // Should still load the valid file
      expect(pages.size).toBeGreaterThanOrEqual(1)
      expect(pages.has('valid')).toBe(true)
    })
  })

  describe('processBatch', () => {
    it('should process a batch of files', async () => {
      const entitiesDir = path.join(testDir, 'entities')
      await fs.mkdir(entitiesDir, { recursive: true })

      const file1Path = path.join(entitiesDir, 'file1.md')
      const file2Path = path.join(entitiesDir, 'file2.md')

      await fs.writeFile(
        file1Path,
        '---\nid: file1\ntitle: File 1\ntype: entity\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nContent 1 [[file2]]',
        'utf-8'
      )

      await fs.writeFile(
        file2Path,
        '---\nid: file2\ntitle: File 2\ntype: entity\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nContent 2',
        'utf-8'
      )

      const files: BatchFileItem[] = [
        { category: 'entities', path: file1Path },
        { category: 'entities', path: file2Path }
      ]

      const results = await builder.processBatch(files)

      expect(results).toHaveLength(2)
      expect(results[0].page.frontmatter.id).toBe('file1')
      expect(results[0].page.links).toContain('file2')
      expect(results[1].page.frontmatter.id).toBe('file2')
      expect(results[0].hash).toBeDefined()
      expect(results[0].stats.mtime).toBeDefined()
    })

    it('should return null for non-existent files', async () => {
      const files: BatchFileItem[] = [
        { category: 'entities', path: '/nonexistent/file.md' }
      ]

      const results = await builder.processBatch(files)

      expect(results).toHaveLength(0)
    })

    it('should handle empty batch', async () => {
      const files: BatchFileItem[] = []

      const results = await builder.processBatch(files)

      expect(results).toHaveLength(0)
    })

    it('should process files concurrently', async () => {
      const entitiesDir = path.join(testDir, 'entities')
      await fs.mkdir(entitiesDir, { recursive: true })

      const files: BatchFileItem[] = []

      // Create 5 test files
      for (let i = 1; i <= 5; i++) {
        const filePath = path.join(entitiesDir, `file${i}.md`)
        await fs.writeFile(
          filePath,
          `---\nid: file${i}\ntitle: File ${i}\ntype: entity\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nContent ${i}`,
          'utf-8'
        )
        files.push({ category: 'entities', path: filePath })
      }

      const startTime = Date.now()
      const results = await builder.processBatch(files)
      const duration = Date.now() - startTime

      expect(results).toHaveLength(5)
      // Concurrent processing should be fast
      expect(duration).toBeLessThan(1000)
    })

    it('should calculate hash for each file', async () => {
      const entitiesDir = path.join(testDir, 'entities')
      await fs.mkdir(entitiesDir, { recursive: true })

      const filePath = path.join(entitiesDir, 'test.md')
      await fs.writeFile(
        filePath,
        '---\nid: test\ntitle: Test\ntype: entity\ntags: []\ndate: 2026-04-19\nupdated: 2026-04-19\n---\nUnique content here',
        'utf-8'
      )

      const files: BatchFileItem[] = [
        { category: 'entities', path: filePath }
      ]

      const results = await builder.processBatch(files)

      expect(results[0].hash).toBeDefined()
      expect(typeof results[0].hash).toBe('string')
      expect(results[0].hash.length).toBeGreaterThan(0)
    })
  })

  describe('integration', () => {
    it('should build graph from directory end-to-end', async () => {
      // Create full directory structure
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

      // Load pages
      const pages = await builder.loadPagesFromDirectory(testDir)

      // Build graph
      const result = await builder.build(pages)

      expect(result.graph.nodes).toHaveLength(3)
      expect(result.graph.edges).toHaveLength(3)
      expect(result.fileHashes.size).toBe(3)

      // Verify edges
      const authEdges = result.graph.edges.filter(e => e.from === 'auth')
      expect(authEdges).toHaveLength(2)
    })
  })
})
