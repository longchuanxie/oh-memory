import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { IndexManager } from '../src/core/index-manager'
import type { ConnectionStats, KnowledgeGraph, PageFrontmatter } from '../src/types'
import { promises as fs } from 'fs'
import path from 'path'

interface PageData {
  links: string[]
  metadata: PageFrontmatter
  filePath?: string
}

describe('IndexManager', () => {
  let manager: IndexManager
  let testDir: string

  beforeEach(async () => {
    testDir = path.join(process.cwd(), `test-index-manager-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
    manager = new IndexManager(testDir)
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  describe('generateMainIndex', () => {
    it('should generate main index with correct statistics', async () => {
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
        }]
      ])

      const stats = new Map<string, ConnectionStats>([
        ['page1', { inbound: 0, outbound: 0, total: 0 }],
        ['page2', { inbound: 0, outbound: 0, total: 0 }]
      ])

      const graph: KnowledgeGraph = { nodes: [], edges: [] }

      await manager.generateMainIndex(pages, stats, graph)

      const indexPath = path.join(testDir, 'graph-index.md')
      const content = await fs.readFile(indexPath, 'utf-8')
      expect(content).toContain('Total Nodes: 2')
      expect(content).toContain('Entities (1 nodes)')
      expect(content).toContain('Concepts (1 nodes)')
    })

    it('should include hub nodes in main index', async () => {
      const pages = new Map<string, PageData>([
        ['hub', {
          metadata: {
            id: 'hub',
            title: 'Hub Node',
            type: 'entity',
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: ['page1', 'page2']
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
        }]
      ])

      const stats = new Map<string, ConnectionStats>([
        ['hub', { inbound: 0, outbound: 2, total: 2 }],
        ['page1', { inbound: 1, outbound: 0, total: 1 }],
        ['page2', { inbound: 1, outbound: 0, total: 1 }]
      ])

      const graph: KnowledgeGraph = {
        nodes: [
          { id: 'hub', title: 'Hub Node', path: 'hub.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'page1', title: 'Page 1', path: 'page1.md', type: 'entity', tags: [], lastUpdated: '2026-04-19' },
          { id: 'page2', title: 'Page 2', path: 'page2.md', type: 'concept', tags: [], lastUpdated: '2026-04-19' }
        ],
        edges: [
          { from: 'hub', to: 'page1', type: 'references' },
          { from: 'hub', to: 'page2', type: 'references' }
        ]
      }

      await manager.generateMainIndex(pages, stats, graph)

      const indexPath = path.join(testDir, 'graph-index.md')
      const content = await fs.readFile(indexPath, 'utf-8')
      expect(content).toContain('Hub Nodes')
      expect(content).toContain('hub')
    })

    it('should handle empty pages map', async () => {
      const pages = new Map<string, PageData>()
      const stats = new Map<string, ConnectionStats>()
      const graph: KnowledgeGraph = { nodes: [], edges: [] }

      await manager.generateMainIndex(pages, stats, graph)

      const indexPath = path.join(testDir, 'graph-index.md')
      const content = await fs.readFile(indexPath, 'utf-8')
      expect(content).toContain('Total Nodes: 0')
      expect(content).toContain('Total Edges: 0')
    })
  })

  describe('generateLayerIndexes', () => {
    it('should generate layer indexes for all types', async () => {
      const pages = new Map<string, PageData>([
        ['auth', {
          metadata: {
            id: 'auth',
            title: 'Authentication',
            type: 'entity',
            tags: ['security'],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: []
        }],
        ['pattern', {
          metadata: {
            id: 'pattern',
            title: 'Design Pattern',
            type: 'concept',
            tags: ['architecture'],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: []
        }],
        ['readme', {
          metadata: {
            id: 'readme',
            title: 'README',
            type: 'source',
            tags: ['docs'],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: []
        }],
        ['overview', {
          metadata: {
            id: 'overview',
            title: 'Overview',
            type: 'synthesis',
            tags: ['summary'],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: []
        }]
      ])

      const stats = new Map<string, ConnectionStats>([
        ['auth', { inbound: 0, outbound: 0, total: 0 }],
        ['pattern', { inbound: 0, outbound: 0, total: 0 }],
        ['readme', { inbound: 0, outbound: 0, total: 0 }],
        ['overview', { inbound: 0, outbound: 0, total: 0 }]
      ])

      await manager.generateLayerIndexes(pages, stats)

      const entitiesPath = path.join(testDir, 'graph-entities.md')
      const entitiesContent = await fs.readFile(entitiesPath, 'utf-8')
      expect(entitiesContent).toContain('Entity Index')
      expect(entitiesContent).toContain('auth')

      const conceptsPath = path.join(testDir, 'graph-concepts.md')
      const conceptsContent = await fs.readFile(conceptsPath, 'utf-8')
      expect(conceptsContent).toContain('Concept Index')
      expect(conceptsContent).toContain('pattern')

      const sourcesPath = path.join(testDir, 'graph-sources.md')
      const sourcesContent = await fs.readFile(sourcesPath, 'utf-8')
      expect(sourcesContent).toContain('Source Index')
      expect(sourcesContent).toContain('readme')

      const synthesisPath = path.join(testDir, 'graph-synthesis.md')
      const synthesisContent = await fs.readFile(synthesisPath, 'utf-8')
      expect(synthesisContent).toContain('Synthesis Index')
      expect(synthesisContent).toContain('overview')
    })

    it('should include connection counts in layer indexes', async () => {
      const pages = new Map<string, PageData>([
        ['auth', {
          metadata: {
            id: 'auth',
            title: 'Authentication',
            type: 'entity',
            tags: ['security'],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: ['user']
        }],
        ['user', {
          metadata: {
            id: 'user',
            title: 'User',
            type: 'entity',
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: []
        }]
      ])

      const stats = new Map<string, ConnectionStats>([
        ['auth', { inbound: 0, outbound: 1, total: 1 }],
        ['user', { inbound: 1, outbound: 0, total: 1 }]
      ])

      await manager.generateLayerIndexes(pages, stats)

      const entitiesPath = path.join(testDir, 'graph-entities.md')
      const content = await fs.readFile(entitiesPath, 'utf-8')
      expect(content).toContain('1 connections')
    })

    it('should group pages by module', async () => {
      const pages = new Map<string, PageData>([
        ['auth-service', {
          metadata: {
            id: 'auth-service',
            title: 'Auth Service',
            type: 'entity',
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19',
            module: 'auth'
          },
          links: []
        }],
        ['auth-middleware', {
          metadata: {
            id: 'auth-middleware',
            title: 'Auth Middleware',
            type: 'entity',
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19',
            module: 'auth'
          },
          links: []
        }],
        ['user-model', {
          metadata: {
            id: 'user-model',
            title: 'User Model',
            type: 'entity',
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19',
            module: 'user'
          },
          links: []
        }]
      ])

      const stats = new Map<string, ConnectionStats>([
        ['auth-service', { inbound: 0, outbound: 0, total: 0 }],
        ['auth-middleware', { inbound: 0, outbound: 0, total: 0 }],
        ['user-model', { inbound: 0, outbound: 0, total: 0 }]
      ])

      await manager.generateLayerIndexes(pages, stats)

      const entitiesPath = path.join(testDir, 'graph-entities.md')
      const content = await fs.readFile(entitiesPath, 'utf-8')
      expect(content).toContain('By Module')
      expect(content).toContain('auth')
      expect(content).toContain('user')
    })

    it('should handle layer with no pages', async () => {
      const pages = new Map<string, PageData>([
        ['auth', {
          metadata: {
            id: 'auth',
            title: 'Authentication',
            type: 'entity',
            tags: [],
            date: '2026-04-19',
            updated: '2026-04-19'
          },
          links: []
        }]
      ])

      const stats = new Map<string, ConnectionStats>([
        ['auth', { inbound: 0, outbound: 0, total: 0 }]
      ])

      await manager.generateLayerIndexes(pages, stats)

      const conceptsPath = path.join(testDir, 'graph-concepts.md')
      const content = await fs.readFile(conceptsPath, 'utf-8')
      expect(content).toContain('Total: 0 nodes')
    })
  })

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      const invalidManager = new IndexManager('/nonexistent/path/that/does/not/exist')

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

      const stats = new Map<string, ConnectionStats>([
        ['page1', { inbound: 0, outbound: 0, total: 0 }]
      ])

      const graph: KnowledgeGraph = { nodes: [], edges: [] }

      // Should not throw, but log error
      await expect(invalidManager.generateMainIndex(pages, stats, graph)).resolves.toBeUndefined()
    })
  })
})
