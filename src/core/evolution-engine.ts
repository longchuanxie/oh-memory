import { watch, FSWatcher } from 'fs'
import path from 'path'
import type { PluginInput } from '@opencode-ai/plugin'
import type { EvolutionConfig } from '../types/index.js'
import { KnowledgeBase } from './knowledge-base.js'

export class EvolutionEngine {
  private config: EvolutionConfig
  private knowledgeBase: KnowledgeBase
  private context: PluginInput
  private watcher: FSWatcher | null = null
  private fileHashes: Map<string, string> = new Map()
  private updateHistory: Array<{
    timestamp: Date
    files: string[]
    createdPages: number
    updatedPages: number
  }> = []

  constructor(
    config: EvolutionConfig,
    knowledgeBase: KnowledgeBase,
    context: PluginInput
  ) {
    this.config = config
    this.knowledgeBase = knowledgeBase
    this.context = context
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      return
    }

    await this.initializeFileHashes()

    this.watcher = watch(
      this.context.directory,
      { recursive: true },
      async (event, filename) => {
        if (filename && this.shouldProcess(filename)) {
          await this.handleFileChange(filename)
        }
      }
    )

    await this.context.client.app.log({
      body: {
        service: 'oh-memory',
        level: 'info',
        message: 'Evolution engine started',
      },
    })
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  isRunning(): boolean {
    return this.watcher !== null
  }

  getWatchedFileCount(): number {
    return this.fileHashes.size
  }

  getUpdateHistory(limit: number = 20): Array<{
    timestamp: Date
    files: string[]
    createdPages: number
    updatedPages: number
  }> {
    return this.updateHistory.slice(-limit)
  }

  getConfig(): EvolutionConfig {
    return this.config
  }

  private async initializeFileHashes(): Promise<void> {
    const { listFiles, getFileHash } = await import('../utils/file-utils')
    
    const files = await listFiles(this.context.directory, this.config.watchPatterns)
    
    for (const file of files) {
      try {
        const hash = await getFileHash(file)
        this.fileHashes.set(file, hash)
      } catch (error) {
        // Ignore errors during initialization
      }
    }
  }

  private shouldProcess(filename: string): boolean {
    const fullPath = path.join(this.context.directory, filename)

    for (const pattern of this.config.ignorePatterns) {
      if (fullPath.includes(pattern)) {
        return false
      }
    }

    const matchesWatchPattern = this.config.watchPatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'))
        return regex.test(fullPath)
      }
      return fullPath.includes(pattern)
    })

    return matchesWatchPattern
  }

  private async handleFileChange(filename: string): Promise<void> {
    const fullPath = path.join(this.context.directory, filename)

    try {
      const { getFileHash } = await import('../utils/file-utils')
      const currentHash = await getFileHash(fullPath)
      const previousHash = this.fileHashes.get(fullPath)

      if (currentHash === previousHash) {
        return
      }

      this.fileHashes.set(fullPath, currentHash)

      await this.context.client.app.log({
        body: {
          service: 'oh-memory',
          level: 'info',
          message: `File changed: ${filename}`,
          extra: { file: filename },
        },
      })

      if (this.config.requireApproval) {
        await this.notifyUserForApproval(filename)
      } else {
        await this.updateKnowledgeBase([fullPath])
      }
    } catch (error) {
      await this.context.client.app.log({
        body: {
          service: 'oh-memory',
          level: 'error',
          message: `Failed to process file change: ${filename}`,
          extra: { error: (error as Error).message },
        },
      })
    }
  }

  private async notifyUserForApproval(filename: string): Promise<void> {
    await this.context.client.app.log({
      body: {
        service: 'oh-memory',
        level: 'info',
        message: `Knowledge base update available for: ${filename}`,
        extra: {
          file: filename,
          action: 'Run /memory-ingest to update the knowledge base',
        },
      },
    })
  }

  private async updateKnowledgeBase(files: string[]): Promise<void> {
    try {
      const result = await this.knowledgeBase.ingestFiles(files)
      
      // 记录更新历史
      this.updateHistory.push({
        timestamp: new Date(),
        files,
        createdPages: result.createdPages.length,
        updatedPages: result.updatedPages.length,
      })
      
      // 保持历史不超过 100 条
      if (this.updateHistory.length > 100) {
        this.updateHistory = this.updateHistory.slice(-100)
      }
      
      await this.context.client.app.log({
        body: {
          service: 'oh-memory',
          level: 'info',
          message: 'Knowledge base updated automatically',
          extra: {
            processedFiles: result.processedFiles,
            createdPages: result.createdPages.length,
            updatedPages: result.updatedPages.length,
          },
        },
      })
    } catch (error) {
      await this.context.client.app.log({
        body: {
          service: 'oh-memory',
          level: 'error',
          message: 'Failed to update knowledge base',
          extra: { error: (error as Error).message },
        },
      })
    }
  }

  async scanForChanges(): Promise<string[]> {
    const { listFiles, getFileHash } = await import('../utils/file-utils')
    
    const files = await listFiles(this.context.directory, this.config.watchPatterns)
    const changedFiles: string[] = []

    for (const file of files) {
      try {
        const currentHash = await getFileHash(file)
        const previousHash = this.fileHashes.get(file)

        if (currentHash !== previousHash) {
          changedFiles.push(file)
          this.fileHashes.set(file, currentHash)
        }
      } catch (error) {
        // Ignore errors during scan
      }
    }

    return changedFiles
  }
}
