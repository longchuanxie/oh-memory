import path from 'path'
import os from 'os'
import { promises as fs } from 'fs'

import { Logger } from '../utils/logger.js'

import type { 
  ProjectAnalysis, 
  IngestCheckpoint, 
  IngestProgress,
  IngestOptions,
  IngestResult,
  StructureScore,
  ModuleInfo,
} from '../types/index.js'

type FileProcessor = (file: string) => Promise<string | null>

interface ModuleGroup {
  name: string
  files: string[]
}

export class IngestOrchestrator {
  private basePath: string
  private checkpointPath: string
  private checkpoint: IngestCheckpoint | null = null
  private startTime: number = 0
  private processedCount: number = 0
  private options: IngestOptions = {}
  private structureScore: StructureScore | null = null
  private modules: ModuleInfo[] = []
  private logger = Logger.getInstance()

  constructor(memoryPath: string) {
    this.basePath = memoryPath
    this.checkpointPath = path.join(memoryPath, '.ingest-checkpoint.json')
  }

  setStructureScore(score: StructureScore): void {
    this.structureScore = score
  }

  setModules(modules: ModuleInfo[]): void {
    this.modules = modules
  }

  async analyzeProject(files: string[]): Promise<ProjectAnalysis> {
    let totalSize = 0
    
    for (const file of files) {
      try {
        const stats = await fs.stat(file)
        totalSize += stats.size
      } catch {
        // ignore
      }
    }
    
    const totalFiles = files.length
    const totalSizeMB = totalSize / (1024 * 1024)
    
    const isLargeProject = totalFiles >= 100 || totalSizeMB >= 10
    
    const cpuCount = os.cpus().length
    const systemMemory = os.totalmem()
    const memoryGB = systemMemory / (1024 * 1024 * 1024)
    
    let concurrency: number
    let batchSize: number
    let strategy: 'fast' | 'batch' | 'module'
    
    if (this.structureScore) {
      const level = this.structureScore.level
      
      if (level === 'clear') {
        strategy = totalFiles < 100 ? 'fast' : 'batch'
        concurrency = Math.min(cpuCount * 4, 32)
        batchSize = 100
      } else if (level === 'moderate') {
        strategy = 'module'
        concurrency = Math.min(cpuCount * 2, 16)
        batchSize = 50
      } else {
        strategy = 'batch'
        concurrency = Math.min(cpuCount, 8)
        batchSize = 25
      }
    } else {
      if (!isLargeProject) {
        strategy = 'fast'
        concurrency = Math.min(cpuCount * 4, 20)
        batchSize = totalFiles
      } else {
        strategy = 'batch'
        
        if (memoryGB >= 16) {
          concurrency = Math.min(cpuCount * 4, 32)
          batchSize = 100
        } else if (memoryGB >= 8) {
          concurrency = Math.min(cpuCount * 2, 16)
          batchSize = 50
        } else {
          concurrency = Math.min(cpuCount, 8)
          batchSize = 25
        }
      }
    }
    
    if (this.options.concurrency) {
      concurrency = this.options.concurrency
    }
    if (this.options.batchSize) {
      batchSize = this.options.batchSize
    }
    
    return {
      totalFiles,
      totalSize,
      strategy,
      batchSize,
      concurrency,
    }
  }

  async processFiles(
    files: string[],
    processor: FileProcessor,
    options: IngestOptions = {}
  ): Promise<IngestResult> {
    this.options = options
    const result: IngestResult = {
      success: true,
      processedFiles: 0,
      createdPages: [],
      updatedPages: [],
      errors: [],
    }
    
    if (files.length === 0) {
      return result
    }
    
    const analysis = await this.analyzeProject(files)
    
    if (options.resume) {
      await this.loadCheckpoint()
    }
    
    const filesToProcess = this.checkpoint 
      ? this.checkpoint.pendingFiles 
      : files
    
    if (this.checkpoint) {
      result.errors.push(...this.checkpoint.errors.map(e => `${e.file}: ${e.error}`))
    }
    
    this.startTime = Date.now()
    this.processedCount = this.checkpoint?.processedFiles.length || 0
    
    await this.saveCheckpointInitial(files, filesToProcess)
    
    this.logger.info('Ingest starting', {
      totalFiles: analysis.totalFiles,
      strategy: analysis.strategy,
      concurrency: analysis.concurrency,
      batchSize: analysis.batchSize
    })
    
    if (analysis.strategy === 'fast') {
      await this.processFast(filesToProcess, processor, analysis, result)
    } else if (analysis.strategy === 'module') {
      await this.processByModule(filesToProcess, processor, analysis, result)
    } else {
      await this.processBatch(filesToProcess, processor, analysis, result)
    }
    
    await this.clearCheckpoint()
    
    this.logger.info('Ingest completed', {
      processedFiles: result.processedFiles,
      totalFiles: analysis.totalFiles
    })
    
    return result
  }

  private async processFast(
    files: string[],
    processor: FileProcessor,
    analysis: ProjectAnalysis,
    result: IngestResult
  ): Promise<void> {
    const chunks = this.chunkArray(files, analysis.concurrency)
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (file) => {
        try {
          const page = await this.processFileWithRetry(file, processor)
          this.processedCount++
          this.updateProgress(analysis, file)
          
          if (this.checkpoint) {
            this.checkpoint.processedFiles.push(file)
            this.checkpoint.pendingFiles = this.checkpoint.pendingFiles.filter(f => f !== file)
            await this.saveCheckpoint()
          }
          
          return page
        } catch (error) {
          const errorMsg = `Failed to process ${file}: ${(error as Error).message}`
          result.errors.push(errorMsg)
          
          if (this.checkpoint) {
            this.checkpoint.errors.push({ file, error: (error as Error).message })
            await this.saveCheckpoint()
          }
          
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
  }

  private async processFileWithRetry(
    file: string,
    processor: FileProcessor,
    maxRetries: number = 2
  ): Promise<string | null> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await processor(file)
      } catch (error) {
        lastError = error as Error
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)))
        }
      }
    }
    
    throw lastError
  }

  private async processBatch(
    files: string[],
    processor: FileProcessor,
    analysis: ProjectAnalysis,
    result: IngestResult
  ): Promise<void> {
    const batches = this.chunkArray(files, analysis.batchSize)
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      this.logger.info('Processing batch', {
        current: i + 1,
        total: batches.length,
        filesInBatch: batch.length
      })
      
      const chunks = this.chunkArray(batch, analysis.concurrency)
      
      for (const chunk of chunks) {
        const promises = chunk.map(async (file) => {
          try {
            const page = await processor(file)
            this.processedCount++
            this.updateProgress(analysis, file)
            
            if (this.checkpoint) {
              this.checkpoint.processedFiles.push(file)
              this.checkpoint.pendingFiles = this.checkpoint.pendingFiles.filter(f => f !== file)
            }
            
            return page
          } catch (error) {
            const errorMsg = `Failed to process ${file}: ${(error as Error).message}`
            result.errors.push(errorMsg)
            
            if (this.checkpoint) {
              this.checkpoint.errors.push({ file, error: (error as Error).message })
            }
            
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
      
      if (this.checkpoint) {
        await this.saveCheckpoint()
      }
    }
  }

  private async processByModule(
    files: string[],
    processor: FileProcessor,
    analysis: ProjectAnalysis,
    result: IngestResult
  ): Promise<void> {
    const moduleGroups = this.groupFilesByModule(files)
    
    if (moduleGroups.length === 0) {
      await this.processBatch(files, processor, analysis, result)
      return
    }
    
    this.logger.info('Processing by module', { moduleCount: moduleGroups.length })
    
    for (let i = 0; i < moduleGroups.length; i++) {
      const group = moduleGroups[i]
      this.logger.info('Processing module', {
        current: i + 1,
        total: moduleGroups.length,
        moduleName: group.name,
        filesInModule: group.files.length
      })
      
      const chunks = this.chunkArray(group.files, analysis.concurrency)
      
      for (const chunk of chunks) {
        const promises = chunk.map(async (file) => {
          try {
            const page = await processor(file)
            this.processedCount++
            this.updateProgress(analysis, file)
            
            if (this.checkpoint) {
              this.checkpoint.processedFiles.push(file)
              this.checkpoint.pendingFiles = this.checkpoint.pendingFiles.filter(f => f !== file)
            }
            
            return page
          } catch (error) {
            const errorMsg = `Failed to process ${file}: ${(error as Error).message}`
            result.errors.push(errorMsg)
            
            if (this.checkpoint) {
              this.checkpoint.errors.push({ file, error: (error as Error).message })
            }
            
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
      
      if (this.checkpoint) {
        await this.saveCheckpoint()
      }
    }
  }

  private groupFilesByModule(files: string[]): ModuleGroup[] {
    const groups: ModuleGroup[] = []
    
    const normalizePath = (p: string): string => {
      return p.replace(/\\/g, '/').toLowerCase()
    }
    
    if (this.modules.length === 0) {
      const dirGroups = new Map<string, string[]>()
      
      for (const file of files) {
        const normalized = normalizePath(file)
        const parts = normalized.split('/')
        const moduleDir = parts.length > 1 ? parts[0] : 'root'
        
        if (!dirGroups.has(moduleDir)) {
          dirGroups.set(moduleDir, [])
        }
        dirGroups.get(moduleDir)!.push(file)
      }
      
      for (const [name, moduleFiles] of dirGroups) {
        if (moduleFiles.length > 0) {
          groups.push({ name, files: moduleFiles })
        }
      }
    } else {
      const moduleFiles = new Map<string, string[]>()
      const unassigned: string[] = []
      
      for (const file of files) {
        const normalizedFile = normalizePath(file)
        let assigned = false
        
        for (const mod of this.modules) {
          const modulePath = normalizePath(mod.path.replace(/^\.\//, '').replace(/\/$/, ''))
          
          const isMatch = normalizedFile.startsWith(modulePath + '/') || 
                          normalizedFile === modulePath ||
                          normalizedFile.includes('/' + modulePath + '/')
          
          if (isMatch) {
            if (!moduleFiles.has(mod.name)) {
              moduleFiles.set(mod.name, [])
            }
            moduleFiles.get(mod.name)!.push(file)
            assigned = true
            break
          }
        }
        
        if (!assigned) {
          unassigned.push(file)
        }
      }
      
      for (const [name, files] of moduleFiles) {
        groups.push({ name, files })
      }
      
      if (unassigned.length > 0) {
        groups.push({ name: 'other', files: unassigned })
      }
    }
    
    return groups.sort((a, b) => b.files.length - a.files.length)
  }

  private updateProgress(analysis: ProjectAnalysis, currentFile: string): void {
    const elapsed = Date.now() - this.startTime
    const percentage = Math.round((this.processedCount / analysis.totalFiles) * 100)
    const speed = this.processedCount / (elapsed / 1000)
    const remaining = analysis.totalFiles - this.processedCount
    const estimated = remaining / speed * 1000
    
    const progress: IngestProgress = {
      total: analysis.totalFiles,
      processed: this.processedCount,
      percentage,
      currentFile,
      elapsed,
      estimated,
      speed,
    }
    
    if (this.options.onProgress) {
      this.options.onProgress(progress)
    }
    
    this.renderProgressBar(progress)
  }

  private renderProgressBar(progress: IngestProgress): void {
    if (!process.stdout.isTTY) {
      if (progress.percentage % 20 === 0 && progress.percentage > 0) {
        this.logger.info('Progress', {
          percentage: progress.percentage,
          processed: progress.processed,
          total: progress.total,
          speed: Math.round(progress.speed)
        })
      }
      return
    }
    
    const barWidth = 30
    const filled = Math.round((progress.percentage / 100) * barWidth)
    const empty = barWidth - filled
    const bar = '█'.repeat(filled) + '░'.repeat(empty)
    
    const elapsedSec = Math.round(progress.elapsed / 1000)
    const estimatedSec = Math.round(progress.estimated / 1000)
    
    const filename = path.basename(progress.currentFile).substring(0, 20)
    
    process.stdout.write(
      `\r[${bar}] ${progress.percentage}% (${progress.processed}/${progress.total}) ${filename.padEnd(20)} ${Math.round(progress.speed)} files/s ETA: ${this.formatTime(estimatedSec)}`
    )
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  private async saveCheckpointInitial(allFiles: string[], pendingFiles: string[]): Promise<void> {
    this.checkpoint = {
      id: `ingest-${Date.now()}`,
      startTime: new Date().toISOString(),
      totalFiles: allFiles.length,
      processedFiles: [],
      pendingFiles: pendingFiles,
      errors: [],
      lastUpdated: new Date().toISOString(),
    }
    await this.saveCheckpoint()
  }

  private async saveCheckpoint(): Promise<void> {
    if (!this.checkpoint) return
    this.checkpoint.lastUpdated = new Date().toISOString()
    await fs.writeFile(this.checkpointPath, JSON.stringify(this.checkpoint, null, 2), 'utf-8')
  }

  private async loadCheckpoint(): Promise<void> {
    try {
      const content = await fs.readFile(this.checkpointPath, 'utf-8')
      this.checkpoint = JSON.parse(content)
      if (this.checkpoint) {
        this.logger.info('Resuming from checkpoint', {
          processedFiles: this.checkpoint.processedFiles.length
        })
      }
    } catch {
      this.checkpoint = null
    }
  }

  private async clearCheckpoint(): Promise<void> {
    try {
      await fs.unlink(this.checkpointPath)
    } catch {
      // ignore
    }
    this.checkpoint = null
  }

  hasCheckpoint(): boolean {
    return this.checkpoint !== null
  }

  async getCheckpoint(): Promise<IngestCheckpoint | null> {
    if (!this.checkpoint) {
      await this.loadCheckpoint()
    }
    return this.checkpoint
  }
}
