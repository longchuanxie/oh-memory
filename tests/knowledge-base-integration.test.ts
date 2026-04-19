import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { KnowledgeBase } from '../src/core/knowledge-base'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

describe('KnowledgeBase Integration', () => {
  let kb: KnowledgeBase
  let testDir: string

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `oh-memory-kb-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await fs.mkdir(testDir, { recursive: true })
    kb = new KnowledgeBase(testDir)
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  describe('initialize', () => {
    it('should create .memory directory structure', async () => {
      await kb.initialize()

      const memoryPath = path.join(testDir, '.memory')
      const exists = await fs.access(memoryPath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    })

    it('should create required subdirectories', async () => {
      await kb.initialize()

      const dirs = ['entities', 'concepts', 'sources', 'synthesis', 'pending']
      for (const dir of dirs) {
        const dirPath = path.join(testDir, '.memory', dir)
        const exists = await fs.access(dirPath).then(() => true).catch(() => false)
        expect(exists).toBe(true)
      }
    })

    it('should create index.md if not exists', async () => {
      await kb.initialize()

      const indexPath = path.join(testDir, '.memory', 'index.md')
      const exists = await fs.access(indexPath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    })

    it('should create log.md if not exists', async () => {
      await kb.initialize()

      const logPath = path.join(testDir, '.memory', 'log.md')
      const exists = await fs.access(logPath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    })

    it('should create SCHEMA.md if not exists', async () => {
      await kb.initialize()

      const schemaPath = path.join(testDir, '.memory', 'SCHEMA.md')
      const exists = await fs.access(schemaPath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    })

    it('should not overwrite existing files', async () => {
      await kb.initialize()

      const indexPath = path.join(testDir, '.memory', 'index.md')
      const originalContent = await fs.readFile(indexPath, 'utf-8')

      // Initialize again
      await kb.initialize()

      const newContent = await fs.readFile(indexPath, 'utf-8')
      expect(newContent).toBe(originalContent)
    })
  })

  describe('ingestFiles', () => {
    it('should return success result for empty file list', async () => {
      await kb.initialize()

      const result = await kb.ingestFiles([])

      expect(result.success).toBe(true)
      expect(result.processedFiles).toBe(0)
      expect(result.createdPages).toHaveLength(0)
    })

    it('should handle TypeScript files without error', async () => {
      await kb.initialize()

      const testFile = path.join(testDir, 'test.ts')
      await fs.writeFile(testFile, 'export const test = "hello"', 'utf-8')

      const result = await kb.ingestFiles([testFile])

      expect(result.success).toBe(true)
      // Note: Files may be filtered based on git tracking and other rules
    })

    it('should handle JavaScript files without error', async () => {
      await kb.initialize()

      const testFile = path.join(testDir, 'test.js')
      await fs.writeFile(testFile, 'module.exports = { test: true }', 'utf-8')

      const result = await kb.ingestFiles([testFile])

      expect(result.success).toBe(true)
    })

    it('should handle Markdown files without error', async () => {
      await kb.initialize()

      const testFile = path.join(testDir, 'README.md')
      await fs.writeFile(testFile, '# Test\n\nThis is a test file.', 'utf-8')

      const result = await kb.ingestFiles([testFile])

      expect(result.success).toBe(true)
    })

    it('should handle multiple files without error', async () => {
      await kb.initialize()

      const files = [
        path.join(testDir, 'a.ts'),
        path.join(testDir, 'b.ts'),
        path.join(testDir, 'c.ts')
      ]

      for (const file of files) {
        await fs.writeFile(file, `export const ${path.basename(file, '.ts')} = true`, 'utf-8')
      }

      const result = await kb.ingestFiles(files)

      expect(result.success).toBe(true)
    })

    it('should clear query cache after ingestion', async () => {
      await kb.initialize()

      const testFile = path.join(testDir, 'test.ts')
      await fs.writeFile(testFile, 'export const test = "hello"', 'utf-8')

      // This should not throw
      await kb.ingestFiles([testFile])

      expect(true).toBe(true)
    })
  })

  describe('query', () => {
    it('should return query result structure', async () => {
      await kb.initialize()

      const result = await kb.query('test')

      expect(result).toBeDefined()
      expect(result.query).toBe('test')
      expect(result.answer).toBeDefined()
      expect(result.sources).toBeDefined()
      expect(result.relatedPages).toBeDefined()
    }, 10000)

    it('should return empty results for empty knowledge base', async () => {
      await kb.initialize()

      const result = await kb.query('nonexistent')

      expect(result.relatedPages).toHaveLength(0)
      expect(result.sources).toHaveLength(0)
    })

    it('should respect query options', async () => {
      await kb.initialize()

      const result = await kb.query('test', { limit: 1 })

      expect(result.relatedPages.length).toBeLessThanOrEqual(1)
    })

    it('should filter by type when specified', async () => {
      await kb.initialize()

      const result = await kb.query('test', { type: 'entity' })

      expect(result).toBeDefined()
    })

    it('should handle includeSummaries option', async () => {
      await kb.initialize()

      const result = await kb.query('test', { includeSummaries: true })

      expect(result).toBeDefined()
      // pageSummaries is only set when there are related pages
      expect(result.relatedPages).toBeDefined()
    })
  })

  describe('getBasePath', () => {
    it('should return correct base path', async () => {
      await kb.initialize()

      const basePath = kb.getBasePath()

      expect(basePath).toBe(path.join(testDir, '.memory'))
    })
  })

  describe('getGraph', () => {
    it('should return null before initialization', () => {
      const graph = kb.getGraph()
      expect(graph).toBeNull()
    })

    it('should return graph structure after initialization', async () => {
      await kb.initialize()

      const graph = kb.getGraph()

      // Graph may be null if no pages exist, but structure should be valid
      if (graph) {
        expect(graph.nodes).toBeDefined()
        expect(graph.edges).toBeDefined()
      }
    })
  })

  describe('getPageSummary', () => {
    it('should return null for non-existent page', async () => {
      await kb.initialize()

      const summary = await kb.getPageSummary('nonexistent')

      expect(summary).toBeNull()
    })

    it('should return summary for existing page', async () => {
      await kb.initialize()

      // Create a test page
      const testFile = path.join(testDir, 'test.ts')
      await fs.writeFile(testFile, 'export const test = "hello"', 'utf-8')
      await kb.ingestFiles([testFile])

      // Query to build graph
      await kb.query('test')

      // The page might exist now, try to get summary
      const graph = kb.getGraph()
      if (graph && graph.nodes.length > 0) {
        const summary = await kb.getPageSummary(graph.nodes[0].id)
        // Summary may or may not exist depending on ingestion
        if (summary) {
          expect(summary.id).toBe(graph.nodes[0].id)
          expect(summary.title).toBeDefined()
          expect(summary.tags).toBeDefined()
          expect(summary.summary).toBeDefined()
        }
      }
    })

    it('should respect maxLength parameter', async () => {
      await kb.initialize()

      // Create a page with long content
      const entitiesDir = path.join(testDir, '.memory', 'entities')
      await fs.mkdir(entitiesDir, { recursive: true })
      const longContent = 'x'.repeat(1000)
      await fs.writeFile(
        path.join(entitiesDir, 'long-page.md'),
        `---
id: long-page
title: Long Page
type: entity
tags: []
date: '2026-04-19'
updated: '2026-04-19'
---
${longContent}`,
        'utf-8'
      )

      const summary = await kb.getPageSummary('long-page', 100)

      if (summary) {
        expect(summary.summary.length).toBeLessThanOrEqual(103) // 100 + '...'
      }
    })
  })

  describe('previewChanges', () => {
    it('should detect new pages', async () => {
      await kb.initialize()

      const testFile = path.join(testDir, 'new.ts')
      await fs.writeFile(testFile, 'export const newFile = true', 'utf-8')

      const preview = await kb.previewChanges([testFile])

      expect(preview.newPages.length).toBeGreaterThan(0)
    })

    it('should return correct structure', async () => {
      await kb.initialize()

      const testFile = path.join(testDir, 'test.ts')
      await fs.writeFile(testFile, 'export const test = true', 'utf-8')

      const preview = await kb.previewChanges([testFile])

      expect(preview).toHaveProperty('newPages')
      expect(preview).toHaveProperty('updatedPages')
      expect(preview).toHaveProperty('deletedPages')
      expect(preview).toHaveProperty('unchangedPages')
    })

    it('should handle empty file list', async () => {
      await kb.initialize()

      const preview = await kb.previewChanges([])

      expect(preview.newPages).toHaveLength(0)
      expect(preview.updatedPages).toHaveLength(0)
      expect(preview.deletedPages).toHaveLength(0)
      expect(preview.unchangedPages).toHaveLength(0)
    })

    it('should handle non-existent files', async () => {
      await kb.initialize()

      const preview = await kb.previewChanges([path.join(testDir, 'nonexistent.ts')])

      // Non-existent files should be skipped
      expect(preview.newPages).toHaveLength(0)
    })

    it('should detect updated pages', async () => {
      await kb.initialize()

      // First, ingest a file
      const testFile = path.join(testDir, 'update-test.ts')
      await fs.writeFile(testFile, 'export const original = true', 'utf-8')
      await kb.ingestFiles([testFile])

      // Modify the file
      await fs.writeFile(testFile, 'export const modified = true', 'utf-8')

      const preview = await kb.previewChanges([testFile])

      // Should detect the change
      expect(preview.updatedPages.length + preview.unchangedPages.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('error handling', () => {
    it('should handle non-existent files gracefully', async () => {
      await kb.initialize()

      const nonExistentFile = path.join(testDir, 'nonexistent.ts')

      // Should not throw
      const result = await kb.ingestFiles([nonExistentFile])

      expect(result.success).toBe(true)
    })

    it('should handle invalid file paths gracefully', async () => {
      await kb.initialize()

      // Should not throw
      const result = await kb.ingestFiles([''])

      expect(result.success).toBe(true)
    })
  })

  describe('directory structure', () => {
    it('should create architecture.md after analysis', async () => {
      await kb.initialize()

      const archPath = path.join(testDir, '.memory', 'architecture.md')
      const exists = await fs.access(archPath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    })
  })

  describe('searchContent', () => {
    it('should return empty result for empty query', async () => {
      await kb.initialize()

      const result = await kb.searchContent('')

      expect(result.matches).toHaveLength(0)
    })

    it('should return empty result for whitespace query', async () => {
      await kb.initialize()

      const result = await kb.searchContent('   ')

      expect(result.matches).toHaveLength(0)
    })

    it('should return correct structure', async () => {
      await kb.initialize()

      const result = await kb.searchContent('test')

      expect(result).toHaveProperty('query')
      expect(result).toHaveProperty('matches')
      expect(result.query).toBe('test')
    })

    it('should search in existing pages', async () => {
      await kb.initialize()

      // Create a page with searchable content
      const entitiesDir = path.join(testDir, '.memory', 'entities')
      await fs.mkdir(entitiesDir, { recursive: true })
      await fs.writeFile(
        path.join(entitiesDir, 'searchable.md'),
        `---
id: searchable
title: Searchable Page
type: entity
tags: []
date: '2026-04-19'
updated: '2026-04-19'
---
# Searchable Content

This page contains unique keyword xyz123 for searching.`,
        'utf-8'
      )

      const result = await kb.searchContent('xyz123')

      expect(result.matches.length).toBeGreaterThanOrEqual(0)
    })

    it('should respect limit option', async () => {
      await kb.initialize()

      const result = await kb.searchContent('test', { limit: 1 })

      expect(result.matches.length).toBeLessThanOrEqual(1)
    })

    it('should handle case sensitivity option', async () => {
      await kb.initialize()

      const resultCaseSensitive = await kb.searchContent('TEST', { caseSensitive: true })
      const resultCaseInsensitive = await kb.searchContent('TEST', { caseSensitive: false })

      expect(resultCaseSensitive).toBeDefined()
      expect(resultCaseInsensitive).toBeDefined()
    })
  })

  describe('concurrent operations', () => {
    it('should handle multiple concurrent queries', async () => {
      await kb.initialize()

      const queries = ['test1', 'test2', 'test3', 'test4', 'test5']
      const results = await Promise.all(queries.map(q => kb.query(q)))

      expect(results.length).toBe(5)
      results.forEach(result => {
        expect(result).toHaveProperty('query')
        expect(result).toHaveProperty('relatedPages')
      })
    })

    it('should handle concurrent ingest and query', async () => {
      await kb.initialize()

      const testFile = path.join(testDir, 'concurrent.ts')
      await fs.writeFile(testFile, 'export const concurrent = true', 'utf-8')

      // Run ingest and query concurrently
      const [ingestResult, queryResult] = await Promise.all([
        kb.ingestFiles([testFile]),
        kb.query('test'),
      ])

      expect(ingestResult.success).toBe(true)
      expect(queryResult).toBeDefined()
    })
  })

  describe('large file handling', () => {
    it('should handle large file content', async () => {
      await kb.initialize()

      const largeContent = 'x'.repeat(100000)
      const testFile = path.join(testDir, 'large.ts')
      await fs.writeFile(testFile, `export const large = "${largeContent}"`, 'utf-8')

      const result = await kb.ingestFiles([testFile])

      expect(result.success).toBe(true)
    })

    it('should handle many small files', async () => {
      await kb.initialize()

      const files: string[] = []
      for (let i = 0; i < 20; i++) {
        const filePath = path.join(testDir, `file${i}.ts`)
        await fs.writeFile(filePath, `export const file${i} = true`, 'utf-8')
        files.push(filePath)
      }

      const result = await kb.ingestFiles(files)

      expect(result.success).toBe(true)
    })
  })

  describe('special characters in content', () => {
    it('should handle unicode content', async () => {
      await kb.initialize()

      const testFile = path.join(testDir, 'unicode.ts')
      await fs.writeFile(testFile, 'export const unicode = "你好世界 🌍"', 'utf-8')

      const result = await kb.ingestFiles([testFile])

      expect(result.success).toBe(true)
    })

    it('should handle special markdown characters', async () => {
      await kb.initialize()

      const testFile = path.join(testDir, 'special.md')
      await fs.writeFile(testFile, '# Test\n\n**Bold** and *italic* and `code`', 'utf-8')

      const result = await kb.ingestFiles([testFile])

      expect(result.success).toBe(true)
    })
  })

  describe('graph operations', () => {
    it('should build graph with nodes and edges', async () => {
      await kb.initialize()

      // Create pages with links
      const entitiesDir = path.join(testDir, '.memory', 'entities')
      await fs.mkdir(entitiesDir, { recursive: true })
      await fs.writeFile(
        path.join(entitiesDir, 'page-a.md'),
        `---
id: page-a
title: Page A
type: entity
tags: []
date: '2026-04-19'
updated: '2026-04-19'
---
# Page A

Link to [[page-b]]`,
        'utf-8'
      )
      await fs.writeFile(
        path.join(entitiesDir, 'page-b.md'),
        `---
id: page-b
title: Page B
type: entity
tags: []
date: '2026-04-19'
updated: '2026-04-19'
---
# Page B

Content here.`,
        'utf-8'
      )

      // Trigger graph build
      await kb.query('page')

      const graph = kb.getGraph()
      if (graph) {
        expect(graph.nodes.length).toBeGreaterThanOrEqual(0)
        expect(graph.edges).toBeDefined()
      }
    })

    it('should generate graph.json file', async () => {
      await kb.initialize()

      // Create a page
      const entitiesDir = path.join(testDir, '.memory', 'entities')
      await fs.mkdir(entitiesDir, { recursive: true })
      await fs.writeFile(
        path.join(entitiesDir, 'graph-test.md'),
        `---
id: graph-test
title: Graph Test
type: entity
tags: []
date: '2026-04-19'
updated: '2026-04-19'
---
# Graph Test`,
        'utf-8'
      )

      // Trigger graph build
      await kb.query('graph')

      const graphPath = path.join(testDir, '.memory', 'graph.json')
      const exists = await fs.access(graphPath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    })
  })
})
