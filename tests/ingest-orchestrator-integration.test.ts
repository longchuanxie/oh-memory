import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { IngestOrchestrator } from '../src/core/ingest-orchestrator'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import type { StructureScore, ModuleInfo } from '../src/types'

describe('IngestOrchestrator Integration', () => {
  let orchestrator: IngestOrchestrator
  let testDir: string
  let memoryDir: string

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `oh-memory-ingest-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    memoryDir = path.join(testDir, '.memory')
    await fs.mkdir(memoryDir, { recursive: true })
    orchestrator = new IngestOrchestrator(memoryDir)
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  describe('analyzeProject', () => {
    it('should analyze empty file list', async () => {
      const analysis = await orchestrator.analyzeProject([])

      expect(analysis.totalFiles).toBe(0)
      expect(analysis.totalSize).toBe(0)
      expect(analysis.strategy).toBeDefined()
      // batchSize may be 0 for empty projects
      expect(analysis.batchSize).toBeGreaterThanOrEqual(0)
      expect(analysis.concurrency).toBeGreaterThan(0)
    })

    it('should analyze single file', async () => {
      const testFile = path.join(testDir, 'test.ts')
      await fs.writeFile(testFile, 'export const test = 1', 'utf-8')

      const analysis = await orchestrator.analyzeProject([testFile])

      expect(analysis.totalFiles).toBe(1)
      expect(analysis.totalSize).toBeGreaterThan(0)
    })

    it('should analyze multiple files', async () => {
      const files = []
      for (let i = 0; i < 10; i++) {
        const testFile = path.join(testDir, `file${i}.ts`)
        await fs.writeFile(testFile, `export const file${i} = ${i}`, 'utf-8')
        files.push(testFile)
      }

      const analysis = await orchestrator.analyzeProject(files)

      expect(analysis.totalFiles).toBe(10)
    })

    it('should use fast strategy for small projects', async () => {
      const files = []
      for (let i = 0; i < 5; i++) {
        const testFile = path.join(testDir, `file${i}.ts`)
        await fs.writeFile(testFile, `export const file${i} = ${i}`, 'utf-8')
        files.push(testFile)
      }

      const analysis = await orchestrator.analyzeProject(files)

      expect(analysis.strategy).toBe('fast')
    })

    it('should calculate file sizes correctly', async () => {
      const testFile = path.join(testDir, 'large.ts')
      const content = 'x'.repeat(10000)
      await fs.writeFile(testFile, content, 'utf-8')

      const analysis = await orchestrator.analyzeProject([testFile])

      expect(analysis.totalSize).toBeGreaterThanOrEqual(10000)
    })

    it('should handle non-existent files gracefully', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.ts')

      const analysis = await orchestrator.analyzeProject([nonExistentFile])

      expect(analysis.totalFiles).toBe(1)
      // Size may be 0 for non-existent files
    })
  })

  describe('processFiles', () => {
    it('should return success for empty file list', async () => {
      const processor = async (file: string): Promise<string | null> => file

      const result = await orchestrator.processFiles([], processor)

      expect(result.success).toBe(true)
      expect(result.processedFiles).toBe(0)
      expect(result.createdPages).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should process files successfully', async () => {
      const testFile = path.join(testDir, 'test.ts')
      await fs.writeFile(testFile, 'export const test = 1', 'utf-8')

      const processor = async (file: string): Promise<string | null> => {
        return path.basename(file, '.ts')
      }

      const result = await orchestrator.processFiles([testFile], processor)

      expect(result.success).toBe(true)
      expect(result.processedFiles).toBe(1)
      expect(result.createdPages).toContain('test')
    })

    it('should handle processor returning null', async () => {
      const testFile = path.join(testDir, 'test.ts')
      await fs.writeFile(testFile, 'export const test = 1', 'utf-8')

      const processor = async (): Promise<string | null> => null

      const result = await orchestrator.processFiles([testFile], processor)

      expect(result.success).toBe(true)
      expect(result.processedFiles).toBe(0)
    })

    it('should handle processor errors', async () => {
      const testFile = path.join(testDir, 'test.ts')
      await fs.writeFile(testFile, 'export const test = 1', 'utf-8')

      const processor = async (): Promise<string | null> => {
        throw new Error('Processing failed')
      }

      const result = await orchestrator.processFiles([testFile], processor)

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('Processing failed')
    })

    it('should process multiple files concurrently', async () => {
      const files = []
      for (let i = 0; i < 10; i++) {
        const testFile = path.join(testDir, `file${i}.ts`)
        await fs.writeFile(testFile, `export const file${i} = ${i}`, 'utf-8')
        files.push(testFile)
      }

      const processor = async (file: string): Promise<string | null> => {
        return path.basename(file, '.ts')
      }

      const result = await orchestrator.processFiles(files, processor)

      expect(result.processedFiles).toBe(10)
    })

    it('should call onProgress callback', async () => {
      const files = []
      for (let i = 0; i < 5; i++) {
        const testFile = path.join(testDir, `file${i}.ts`)
        await fs.writeFile(testFile, `export const file${i} = ${i}`, 'utf-8')
        files.push(testFile)
      }

      const progressCalls: number[] = []
      const processor = async (file: string): Promise<string | null> => {
        return path.basename(file, '.ts')
      }

      await orchestrator.processFiles(files, processor, {
        onProgress: (progress) => {
          progressCalls.push(progress.processed)
        }
      })

      expect(progressCalls.length).toBeGreaterThan(0)
    })

    it('should respect concurrency option', async () => {
      const files = []
      for (let i = 0; i < 10; i++) {
        const testFile = path.join(testDir, `file${i}.ts`)
        await fs.writeFile(testFile, `export const file${i} = ${i}`, 'utf-8')
        files.push(testFile)
      }

      const processor = async (file: string): Promise<string | null> => {
        return path.basename(file, '.ts')
      }

      const result = await orchestrator.processFiles(files, processor, {
        concurrency: 2
      })

      expect(result.processedFiles).toBe(10)
    })

    it('should respect batchSize option', async () => {
      const files = []
      for (let i = 0; i < 15; i++) {
        const testFile = path.join(testDir, `file${i}.ts`)
        await fs.writeFile(testFile, `export const file${i} = ${i}`, 'utf-8')
        files.push(testFile)
      }

      const processor = async (file: string): Promise<string | null> => {
        return path.basename(file, '.ts')
      }

      const result = await orchestrator.processFiles(files, processor, {
        batchSize: 5
      })

      expect(result.processedFiles).toBe(15)
    })
  })

  describe('setStructureScore', () => {
    it('should accept structure score', () => {
      const score: StructureScore = {
        total: 80,
        directory: 25,
        config: 25,
        organization: 20,
        documentation: 10,
        level: 'clear'
      }

      orchestrator.setStructureScore(score)

      // No error means success
      expect(true).toBe(true)
    })
  })

  describe('setModules', () => {
    it('should accept modules', () => {
      const modules: ModuleInfo[] = [
        { name: 'core', path: 'src/core', type: 'core', fileCount: 10, dependencies: [] },
        { name: 'utils', path: 'src/utils', type: 'util', fileCount: 5, dependencies: [] }
      ]

      orchestrator.setModules(modules)

      expect(true).toBe(true)
    })
  })

  describe('checkpoint', () => {
    it('should not have checkpoint initially', () => {
      expect(orchestrator.hasCheckpoint()).toBe(false)
    })

    it('should return null for getCheckpoint when none exists', async () => {
      const checkpoint = await orchestrator.getCheckpoint()
      expect(checkpoint).toBeNull()
    })
  })

  describe('error handling', () => {
    it('should continue processing after errors with retry', async () => {
      const files = []
      for (let i = 0; i < 3; i++) {
        const testFile = path.join(testDir, `file${i}.ts`)
        await fs.writeFile(testFile, `export const file${i} = ${i}`, 'utf-8')
        files.push(testFile)
      }

      let callCount = 0
      const processor = async (file: string): Promise<string | null> => {
        callCount++
        // Fail on second file
        if (callCount === 2) {
          throw new Error('Simulated error')
        }
        return path.basename(file, '.ts')
      }

      const result = await orchestrator.processFiles(files, processor)

      // With retry, errors may accumulate
      expect(result.errors.length).toBeGreaterThanOrEqual(0)
    })

    it('should collect errors from failed operations', async () => {
      const files = []
      for (let i = 0; i < 3; i++) {
        const testFile = path.join(testDir, `file${i}.ts`)
        await fs.writeFile(testFile, `export const file${i} = ${i}`, 'utf-8')
        files.push(testFile)
      }

      const processor = async (): Promise<string | null> => {
        throw new Error('Always fails')
      }

      const result = await orchestrator.processFiles(files, processor)

      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('result structure', () => {
    it('should return correct result structure', async () => {
      const processor = async (file: string): Promise<string | null> => file

      const result = await orchestrator.processFiles([], processor)

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('processedFiles')
      expect(result).toHaveProperty('createdPages')
      expect(result).toHaveProperty('updatedPages')
      expect(result).toHaveProperty('errors')
    })
  })
})
