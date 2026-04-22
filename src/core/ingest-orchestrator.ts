import path from 'path'
import { promises as fs } from 'fs'

import { Logger } from '../utils/logger.js'

import type { IngestResult } from '../types/index.js'

type FileProcessor = (file: string) => Promise<string | null>

export interface IngestOptions {
  concurrency?: number
  batchSize?: number
  onProgress?: (processed: number, total: number, currentFile: string) => void
}

export class IngestOrchestrator {
  private basePath: string
  private logger = Logger.getInstance()

  constructor(memoryPath: string) {
    this.basePath = memoryPath
  }

  async processFiles(
    files: string[],
    processor: FileProcessor,
    options: IngestOptions = {}
  ): Promise<IngestResult> {
    const result: IngestResult = {
      success: true,
      processedFiles: 0,
      createdPages: [],
      updatedPages: [],
      errors: [],
    }

    if (files.length === 0) return result

    const concurrency = options.concurrency ?? 8
    const startTime = Date.now()

    this.logger.info('[oh-memory] Ingest starting', {
      totalFiles: files.length,
      concurrency,
    })

    const chunks = this.chunkArray(files, concurrency)

    for (const chunk of chunks) {
      const promises = chunk.map(async (file) => {
        try {
          const page = await processor(file)

          if (options.onProgress) {
            options.onProgress(result.processedFiles + 1, files.length, file)
          }

          return page
        } catch (error) {
          result.errors.push(`${file}: ${(error as Error).message}`)
          return null
        }
      })

      const pages = await Promise.all(promises)

      for (const page of pages) {
        if (page) {
          result.processedFiles++
          result.createdPages.push(page)
        }
      }
    }

    const duration = Date.now() - startTime
    this.logger.info(`[oh-memory] Ingest completed: ${duration}ms, ${result.processedFiles} files`)

    result.success = result.errors.length === 0
    return result
  }

  async saveIngestMeta(meta: Record<string, unknown>): Promise<void> {
    const metaPath = path.join(this.basePath, '.ingest-meta.json')
    try {
      await fs.mkdir(this.basePath, { recursive: true })
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
    } catch (error) {
      this.logger.warn('[oh-memory] Failed to save ingest meta:', { error: String(error) })
    }
  }

  async loadIngestMeta(): Promise<Record<string, unknown> | null> {
    const metaPath = path.join(this.basePath, '.ingest-meta.json')
    try {
      const content = await fs.readFile(metaPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}
