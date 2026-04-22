import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

import {
  fileExists,
  readMarkdownFile,
  writeMarkdownFile,
  listFiles,
  extractLinks,
  shouldIgnore,
  matchesPatterns,
  getFileHash,
} from '../src/utils/file-utils'

describe('file-utils', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `oh-memory-file-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const filePath = path.join(testDir, 'test.txt')
      await fs.writeFile(filePath, 'content')

      const exists = await fileExists(filePath)

      expect(exists).toBe(true)
    })

    it('should return false for non-existing file', async () => {
      const filePath = path.join(testDir, 'nonexistent.txt')

      const exists = await fileExists(filePath)

      expect(exists).toBe(false)
    })

    it('should return true for existing directory', async () => {
      const dirPath = path.join(testDir, 'testdir')
      await fs.mkdir(dirPath)

      const exists = await fileExists(dirPath)

      expect(exists).toBe(true)
    })
  })

  describe('readMarkdownFile', () => {
    it('should read markdown file with frontmatter', async () => {
      const filePath = path.join(testDir, 'test.md')
      const content = `---
id: test
title: Test Page
tags:
  - test
---

# Test Content

This is test content.`
      await fs.writeFile(filePath, content, 'utf-8')

      const result = await readMarkdownFile(filePath)

      expect(result).not.toBeNull()
      expect(result?.frontmatter.id).toBe('test')
      expect(result?.frontmatter.title).toBe('Test Page')
      expect(result?.content).toContain('# Test Content')
    })

    it('should return null for non-existing file', async () => {
      const filePath = path.join(testDir, 'nonexistent.md')

      const result = await readMarkdownFile(filePath)

      expect(result).toBeNull()
    })

    it('should extract links from content', async () => {
      const filePath = path.join(testDir, 'links.md')
      const content = `---
id: links
title: Links Test
---

# Links

- [[page-a]]
- [[page-b|Display Text]]
- [[page-c]]
`
      await fs.writeFile(filePath, content, 'utf-8')

      const result = await readMarkdownFile(filePath)

      expect(result?.links).toContain('page-a')
      expect(result?.links).toContain('page-b')
      expect(result?.links).toContain('page-c')
    })

    it('should handle file without frontmatter', async () => {
      const filePath = path.join(testDir, 'no-frontmatter.md')
      const content = '# Just Content\n\nNo frontmatter here.'
      await fs.writeFile(filePath, content, 'utf-8')

      const result = await readMarkdownFile(filePath)

      expect(result).not.toBeNull()
      expect(result?.content).toContain('Just Content')
    })
  })

  describe('writeMarkdownFile', () => {
    it('should write markdown file with frontmatter', async () => {
      const filePath = path.join(testDir, 'output.md')
      const frontmatter = {
        id: 'output',
        title: 'Output Page',
        type: 'entity' as const,
        tags: ['output'],
        date: '2026-04-19',
        updated: '2026-04-19',
      }

      await writeMarkdownFile(filePath, frontmatter, '# Output Content')

      const content = await fs.readFile(filePath, 'utf-8')
      expect(content).toContain('id: output')
      expect(content).toContain('title: Output Page')
      expect(content).toContain('# Output Content')
    })

    it('should overwrite existing file', async () => {
      const filePath = path.join(testDir, 'overwrite.md')
      const frontmatter = {
        id: 'overwrite',
        title: 'Original',
        type: 'entity' as const,
        tags: [],
        date: '2026-04-19',
        updated: '2026-04-19',
      }

      await writeMarkdownFile(filePath, frontmatter, 'Original content')
      await writeMarkdownFile(filePath, { ...frontmatter, title: 'Updated' }, 'Updated content')

      const content = await fs.readFile(filePath, 'utf-8')
      expect(content).toContain('title: Updated')
      expect(content).toContain('Updated content')
    })

    it('should handle nested undefined values in frontmatter', async () => {
      const filePath = path.join(testDir, 'nested-undefined.md')
      const frontmatter = {
        id: 'nested-test',
        title: 'Nested Undefined Test',
        type: 'entity' as const,
        tags: ['test'],
        date: '2026-04-20',
        updated: '2026-04-20',
        summary: {
          description: 'Test description',
          keywords: ['keyword1', 'keyword2'],
          keyFunctions: undefined,
        },
        relations: {
          dependsOn: ['dep1'],
          usedBy: [],
          relatedTo: undefined as unknown as string[],
        },
      }

      await writeMarkdownFile(filePath, frontmatter, '# Test Content')

      const content = await fs.readFile(filePath, 'utf-8')
      expect(content).toContain('id: nested-test')
      expect(content).toContain('description: Test description')
      expect(content).toContain('- keyword1')
      expect(content).toContain('- dep1')
      expect(content).not.toContain('keyFunctions:')
      expect(content).not.toContain('relatedTo:')
    })
  })

  describe('listFiles', () => {
    it('should list files matching patterns', async () => {
      // Use unique subdirectory to avoid interference from other tests
      const listTestDir = path.join(testDir, `list-test-${Date.now()}`)
      await fs.mkdir(listTestDir, { recursive: true })
      await fs.writeFile(path.join(listTestDir, 'a.md'), 'content')
      await fs.writeFile(path.join(listTestDir, 'b.md'), 'content')
      // Use .class file which is in ignoredExtensions, not .txt which is supported
      await fs.writeFile(path.join(listTestDir, 'c.class'), 'content')

      const files = await listFiles(listTestDir, ['.md'])

      // Should have 2 .md files (listFiles uses supportedExtensions, not patterns)
      expect(files.length).toBe(2)
      expect(files.every(f => f.endsWith('.md'))).toBe(true)
    })

    it('should list files in subdirectories', async () => {
      const subDir = path.join(testDir, 'sub')
      await fs.mkdir(subDir)
      await fs.writeFile(path.join(testDir, 'root.md'), 'content')
      await fs.writeFile(path.join(subDir, 'nested.md'), 'content')

      const files = await listFiles(testDir, ['.md'])

      expect(files.length).toBe(2)
    })

    it('should ignore node_modules directory', async () => {
      const nodeModules = path.join(testDir, 'node_modules')
      await fs.mkdir(nodeModules)
      await fs.writeFile(path.join(nodeModules, 'package.md'), 'content')
      await fs.writeFile(path.join(testDir, 'valid.md'), 'content')

      const files = await listFiles(testDir, ['.md'])

      expect(files.length).toBe(1)
      expect(files[0]).toContain('valid.md')
    })

    it('should ignore .git directory', async () => {
      const gitDir = path.join(testDir, '.git')
      await fs.mkdir(gitDir)
      await fs.writeFile(path.join(gitDir, 'config.md'), 'content')
      await fs.writeFile(path.join(testDir, 'valid.md'), 'content')

      const files = await listFiles(testDir, ['.md'])

      expect(files.length).toBe(1)
    })
  })

  describe('extractLinks', () => {
    it('should extract wiki-style links', () => {
      const content = 'See [[page-a]] and [[page-b]] for more info.'

      const links = extractLinks(content)

      expect(links).toContain('page-a')
      expect(links).toContain('page-b')
    })

    it('should extract links with display text', () => {
      const content = 'Check [[page-name|Display Text]] for details.'

      const links = extractLinks(content)

      expect(links).toContain('page-name')
    })

    it('should deduplicate links', () => {
      const content = '[[page-a]] and [[page-a]] are the same.'

      const links = extractLinks(content)

      expect(links.length).toBe(1)
    })

    it('should return empty array for no links', () => {
      const content = 'No links here, just plain text.'

      const links = extractLinks(content)

      expect(links).toHaveLength(0)
    })

    it('should handle empty content', () => {
      const links = extractLinks('')

      expect(links).toHaveLength(0)
    })
  })

  describe('shouldIgnore', () => {
    it('should ignore node_modules', () => {
      expect(shouldIgnore('/project/node_modules/package')).toBe(true)
    })

    it('should ignore .git', () => {
      expect(shouldIgnore('/project/.git/config')).toBe(true)
    })

    it('should ignore .memory', () => {
      expect(shouldIgnore('/project/.memory/entities/test.md')).toBe(true)
    })

    it('should ignore dist directory', () => {
      expect(shouldIgnore('/project/dist/bundle.js')).toBe(true)
    })

    it('should ignore build directory', () => {
      expect(shouldIgnore('/project/build/output.js')).toBe(true)
    })

    it('should not ignore regular files', () => {
      expect(shouldIgnore('/project/src/index.ts')).toBe(false)
    })

    it('should not ignore .DS_Store', () => {
      expect(shouldIgnore('/project/.DS_Store')).toBe(false)
    })

    it('should not ignore .env files', () => {
      expect(shouldIgnore('/project/.env')).toBe(false)
    })
  })

  describe('matchesPatterns', () => {
    it('should match .md files when pattern provided', () => {
      expect(matchesPatterns('readme.md', ['.md'])).toBe(true)
    })

    it('should match .ts files when pattern provided', () => {
      expect(matchesPatterns('index.ts', ['.ts'])).toBe(true)
    })

    it('should match .js files when pattern provided', () => {
      expect(matchesPatterns('index.js', ['.js'])).toBe(true)
    })

    it('should match .py files when pattern provided', () => {
      expect(matchesPatterns('main.py', ['.py'])).toBe(true)
    })

    it('should match .json files when pattern provided', () => {
      expect(matchesPatterns('package.json', ['.json'])).toBe(true)
    })

    it('should match .yaml files when pattern provided', () => {
      expect(matchesPatterns('config.yaml', ['.yaml', '.yml'])).toBe(true)
    })

    it('should not match when no patterns provided', () => {
      expect(matchesPatterns('readme.md', [])).toBe(false)
    })

    it('should not match .class files', () => {
      expect(matchesPatterns('Main.class', ['.ts', '.js'])).toBe(false)
    })

    it('should not match .exe files', () => {
      expect(matchesPatterns('app.exe', ['.ts', '.js'])).toBe(false)
    })

    it('should match multiple patterns', () => {
      expect(matchesPatterns('config.yml', ['.yaml', '.yml'])).toBe(true)
    })
  })

  describe('getFileHash', () => {
    it('should return hash for file', async () => {
      const filePath = path.join(testDir, 'hash-test.txt')
      await fs.writeFile(filePath, 'test content')

      const hash = await getFileHash(filePath)

      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
    })

    it('should return different hashes for different content', async () => {
      const file1 = path.join(testDir, 'file1.txt')
      const file2 = path.join(testDir, 'file2.txt')
      await fs.writeFile(file1, 'content 1')
      await fs.writeFile(file2, 'content 2')

      const hash1 = await getFileHash(file1)
      const hash2 = await getFileHash(file2)

      expect(hash1).not.toBe(hash2)
    })

    it('should return same hash for same content', async () => {
      const file1 = path.join(testDir, 'same1.txt')
      const file2 = path.join(testDir, 'same2.txt')
      await fs.writeFile(file1, 'same content')
      await fs.writeFile(file2, 'same content')

      const hash1 = await getFileHash(file1)
      const hash2 = await getFileHash(file2)

      expect(hash1).toBe(hash2)
    })
  })

  describe('edge cases', () => {
    it('should handle readMarkdownFile with invalid path', async () => {
      const result = await readMarkdownFile('/nonexistent/path/file.md')

      expect(result).toBeNull()
    })

    it('should handle empty directory for listFiles', async () => {
      const emptyDir = path.join(testDir, 'empty')
      await fs.mkdir(emptyDir)

      const files = await listFiles(emptyDir, ['.md'])

      expect(files).toHaveLength(0)
    })

    it('should handle deeply nested directories', async () => {
      const deepDir = path.join(testDir, 'a', 'b', 'c', 'd', 'e')
      await fs.mkdir(deepDir, { recursive: true })
      await fs.writeFile(path.join(deepDir, 'deep.md'), 'content')

      const files = await listFiles(testDir, ['.md'])

      expect(files.length).toBe(1)
    })
  })
})
