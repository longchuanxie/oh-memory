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
    it('should initialize without error', async () => {
      await kb.initialize()
    })

    it('should return project path', () => {
      const projectPath = kb.getProjectPath()
      expect(projectPath).toBe(testDir)
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

    it('should handle non-existent files gracefully', async () => {
      await kb.initialize()

      const nonExistentFile = path.join(testDir, 'nonexistent.ts')

      const result = await kb.ingestFiles([nonExistentFile])

      expect(result.success).toBe(true)
    })

    it('should handle invalid file paths gracefully', async () => {
      await kb.initialize()

      const result = await kb.ingestFiles([''])

      expect(result.success).toBe(true)
    })
  })

  describe('extractFileInfo', () => {
    it('should extract file info for TypeScript file', async () => {
      const testFile = path.join(testDir, 'info-test.ts')
      await fs.writeFile(testFile, 'export const test = "hello"', 'utf-8')

      const info = await kb.extractFileInfo(testFile)

      expect(info).not.toBeNull()
      expect(info!.path).toBe(testFile)
      expect(info!.language).toBe('typescript')
      expect(info!.lines).toBe(1)
      expect(info!.hash).toBeDefined()
      expect(info!.size).toBeGreaterThan(0)
    })

    it('should return null for unsupported file types', async () => {
      const testFile = path.join(testDir, 'test.exe')
      await fs.writeFile(testFile, 'binary content', 'utf-8')

      const info = await kb.extractFileInfo(testFile)

      expect(info).toBeNull()
    })

    it('should return null for ignored paths', async () => {
      const nodeModulesDir = path.join(testDir, 'node_modules')
      await fs.mkdir(nodeModulesDir, { recursive: true })
      const testFile = path.join(nodeModulesDir, 'package.ts')
      await fs.writeFile(testFile, 'export const pkg = true', 'utf-8')

      const info = await kb.extractFileInfo(testFile)

      expect(info).toBeNull()
    })
  })

  describe('readFileContext', () => {
    it('should read file context with metadata', async () => {
      const testFile = path.join(testDir, 'context-test.ts')
      await fs.writeFile(testFile, 'export const test = "hello"', 'utf-8')

      const ctx = await kb.readFileContext(testFile)

      expect(ctx).not.toBeNull()
      expect(ctx!.file.language).toBe('typescript')
      expect(ctx!.content).toContain('export const test')
      expect(ctx!.filtered).toBe(false)
      expect(ctx!.sensitiveMatches).toBe(0)
    })

    it('should return null for non-existent file', async () => {
      const ctx = await kb.readFileContext(path.join(testDir, 'nonexistent.ts'))

      expect(ctx).toBeNull()
    })

    it('should filter sensitive data', async () => {
      const testFile = path.join(testDir, 'sensitive.ts')
      await fs.writeFile(testFile, 'const apiKey = "sk-1234567890abcdef1234567890abcdef"', 'utf-8')

      const ctx = await kb.readFileContext(testFile)

      expect(ctx).not.toBeNull()
      expect(ctx!.filtered).toBe(true)
      expect(ctx!.sensitiveMatches).toBeGreaterThan(0)
      expect(ctx!.content).not.toContain('sk-1234567890abcdef1234567890abcdef')
    })
  })

  describe('readFilesContext', () => {
    it('should read multiple file contexts', async () => {
      const file1 = path.join(testDir, 'multi1.ts')
      const file2 = path.join(testDir, 'multi2.ts')
      await fs.writeFile(file1, 'export const a = 1', 'utf-8')
      await fs.writeFile(file2, 'export const b = 2', 'utf-8')

      const contexts = await kb.readFilesContext([file1, file2])

      expect(contexts).toHaveLength(2)
    })

    it('should skip non-existent files', async () => {
      const existingFile = path.join(testDir, 'exists.ts')
      await fs.writeFile(existingFile, 'export const x = 1', 'utf-8')

      const contexts = await kb.readFilesContext([existingFile, path.join(testDir, 'nope.ts')])

      expect(contexts).toHaveLength(1)
    })
  })

  describe('generateLLMContext', () => {
    it('should generate LLM-ready context string', async () => {
      const testFile = path.join(testDir, 'llm-test.ts')
      await fs.writeFile(testFile, 'export const test = "hello"', 'utf-8')

      const context = await kb.generateLLMContext([testFile])

      expect(context).toContain('llm-test.ts')
      expect(context).toContain('typescript')
      expect(context).toContain('export const test')
    })

    it('should return message for no files found', async () => {
      const context = await kb.generateLLMContext([path.join(testDir, 'nonexistent.ts')])

      expect(context).toBe('No files found for the given paths.')
    })

    it('should include sensitive data warning when filtered', async () => {
      const testFile = path.join(testDir, 'secret.ts')
      await fs.writeFile(testFile, 'const apiKey = "sk-1234567890abcdef1234567890abcdef"', 'utf-8')

      const context = await kb.generateLLMContext([testFile])

      expect(context).toContain('sensitive items filtered')
    })
  })

  describe('getProjectSnapshot', () => {
    it('should return project snapshot', async () => {
      await fs.writeFile(path.join(testDir, 'snap.ts'), 'export const a = 1', 'utf-8')
      await fs.writeFile(path.join(testDir, 'snap.js'), 'const b = 2', 'utf-8')

      const snapshot = await kb.getProjectSnapshot()

      expect(snapshot.projectPath).toBe(testDir)
      expect(snapshot.totalFiles).toBeGreaterThan(0)
      expect(snapshot.languages).toBeDefined()
      expect(snapshot.structure).toBeDefined()
    })

    it('should count files by language', async () => {
      await fs.writeFile(path.join(testDir, 'lang1.ts'), 'export const a = 1', 'utf-8')
      await fs.writeFile(path.join(testDir, 'lang2.ts'), 'export const b = 2', 'utf-8')
      await fs.writeFile(path.join(testDir, 'lang3.py'), 'c = 3', 'utf-8')

      const snapshot = await kb.getProjectSnapshot()

      expect(snapshot.languages['typescript']).toBeGreaterThanOrEqual(2)
      expect(snapshot.languages['python']).toBeGreaterThanOrEqual(1)
    })
  })

  describe('findRelatedFiles', () => {
    it('should find test files related to source', async () => {
      const sourceFile = path.join(testDir, 'module.ts')
      const testFile = path.join(testDir, 'module.test.ts')
      await fs.writeFile(sourceFile, 'export const mod = true', 'utf-8')
      await fs.writeFile(testFile, 'import { mod } from "./module"', 'utf-8')

      const related = await kb.findRelatedFiles(sourceFile)

      expect(related.length).toBeGreaterThan(0)
      const hasTest = related.some(f => f.relativePath.includes('test'))
      expect(hasTest).toBe(true)
    })

    it('should return empty array for non-existent file', async () => {
      const related = await kb.findRelatedFiles(path.join(testDir, 'nonexistent.ts'))

      expect(related).toHaveLength(0)
    })
  })

  describe('concurrent operations', () => {
    it('should handle multiple concurrent reads', async () => {
      const files: string[] = []
      for (let i = 0; i < 5; i++) {
        const filePath = path.join(testDir, `concurrent${i}.ts`)
        await fs.writeFile(filePath, `export const c${i} = ${i}`, 'utf-8')
        files.push(filePath)
      }

      const results = await Promise.all(files.map(f => kb.readFileContext(f)))

      expect(results.length).toBe(5)
      results.forEach(r => expect(r).not.toBeNull())
    })
  })

  describe('large file handling', () => {
    it('should handle large file content', async () => {
      const largeContent = 'x'.repeat(100000)
      const testFile = path.join(testDir, 'large.ts')
      await fs.writeFile(testFile, `export const large = "${largeContent}"`, 'utf-8')

      const result = await kb.ingestFiles([testFile])

      expect(result.success).toBe(true)
    })

    it('should handle many small files', async () => {
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
      const testFile = path.join(testDir, 'unicode.ts')
      await fs.writeFile(testFile, 'export const unicode = "你好世界 🌍"', 'utf-8')

      const result = await kb.ingestFiles([testFile])

      expect(result.success).toBe(true)
    })

    it('should handle special markdown characters', async () => {
      const testFile = path.join(testDir, 'special.md')
      await fs.writeFile(testFile, '# Test\n\n**Bold** and *italic* and `code`', 'utf-8')

      const result = await kb.ingestFiles([testFile])

      expect(result.success).toBe(true)
    })
  })
})
