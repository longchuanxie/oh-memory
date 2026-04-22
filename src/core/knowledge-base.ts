import path from 'path'
import { promises as fs } from 'fs'
import crypto from 'crypto'

import { Logger } from '../utils/logger.js'
import { SensitiveDataFilter } from '../utils/sensitive-filter.js'
import { getLanguage, isCodeFile, isSupportedExtension, isConfigDirectoryFile } from '../utils/language-map.js'
import { shouldIgnore, fileExists } from '../utils/file-utils.js'

import type { IngestResult, PageFrontmatter, KnowledgePage } from '../types/index.js'

export interface FileInfo {
  path: string
  relativePath: string
  language: string
  lines: number
  lastModified: string
  hash: string
  size: number
}

export interface FileContext {
  file: FileInfo
  content: string
  filtered: boolean
  sensitiveMatches: number
}

export interface ProjectSnapshot {
  projectPath: string
  totalFiles: number
  files: FileInfo[]
  languages: Record<string, number>
  structure: DirectoryNode
}

export interface DirectoryNode {
  name: string
  files: number
  children: DirectoryNode[]
}

export class KnowledgeBase {
  private projectPath: string
  private sensitiveFilter: SensitiveDataFilter
  private logger = Logger.getInstance()

  constructor(projectPath: string) {
    this.projectPath = projectPath
    this.sensitiveFilter = new SensitiveDataFilter()
  }

  async initialize(): Promise<void> {
    this.logger.info('[oh-memory] KnowledgeBase initialized', { projectPath: this.projectPath })
  }

  getProjectPath(): string {
    return this.projectPath
  }

  async ingestFiles(paths: string[]): Promise<IngestResult> {
    const resolvedPaths = paths.map(p =>
      path.isAbsolute(p) ? p : path.join(this.projectPath, p)
    )
    const expandedFiles = await this.expandPaths(resolvedPaths)

    const createdPages: string[] = []
    const updatedPages: string[] = []
    const errors: string[] = []

    for (const file of expandedFiles) {
      try {
        const info = await this.extractFileInfo(file)
        if (info) {
          createdPages.push(info.relativePath)
        }
      } catch (error) {
        errors.push(`${file}: ${(error as Error).message}`)
      }
    }

    return {
      success: errors.length === 0,
      processedFiles: expandedFiles.length,
      createdPages,
      updatedPages,
      errors,
    }
  }

  async extractFileInfo(filePath: string): Promise<FileInfo | null> {
    try {
      if (shouldIgnore(filePath)) return null

      const ext = path.extname(filePath)
      if (!isSupportedExtension(ext) && !isConfigDirectoryFile(filePath)) return null

      const stats = await fs.stat(filePath)
      const content = await fs.readFile(filePath, 'utf-8')
      const relativePath = path.relative(this.projectPath, filePath)

      return {
        path: filePath,
        relativePath,
        language: getLanguage(ext),
        lines: content.split('\n').length,
        lastModified: stats.mtime.toISOString().split('T')[0],
        hash: this.calculateHash(content),
        size: stats.size,
      }
    } catch {
      return null
    }
  }

  async readFileContext(filePath: string): Promise<FileContext | null> {
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.projectPath, filePath)

    if (!await fileExists(resolvedPath)) return null

    const info = await this.extractFileInfo(resolvedPath)
    if (!info) return null

    const rawContent = await fs.readFile(resolvedPath, 'utf-8')
    const filterResult = this.sensitiveFilter.filter(rawContent)

    return {
      file: info,
      content: filterResult.filtered,
      filtered: filterResult.redactedCount > 0,
      sensitiveMatches: filterResult.redactedCount,
    }
  }

  async readFilesContext(filePaths: string[]): Promise<FileContext[]> {
    const contexts: FileContext[] = []
    for (const filePath of filePaths) {
      const ctx = await this.readFileContext(filePath)
      if (ctx) contexts.push(ctx)
    }
    return contexts
  }

  async getProjectSnapshot(): Promise<ProjectSnapshot> {
    const allFiles = await this.scanDirectory(this.projectPath)
    const fileInfos: FileInfo[] = []
    const languages: Record<string, number> = {}

    for (const file of allFiles) {
      const info = await this.extractFileInfo(file)
      if (info) {
        fileInfos.push(info)
        languages[info.language] = (languages[info.language] ?? 0) + 1
      }
    }

    const structure = await this.buildDirectoryTree(this.projectPath)

    return {
      projectPath: this.projectPath,
      totalFiles: fileInfos.length,
      files: fileInfos,
      languages,
      structure,
    }
  }

  async generateLLMContext(filePaths: string[]): Promise<string> {
    const contexts = await this.readFilesContext(filePaths)

    if (contexts.length === 0) {
      return 'No files found for the given paths.'
    }

    const sections = contexts.map(ctx => {
      const header = `## ${ctx.file.relativePath} (${ctx.file.language}, ${ctx.file.lines} lines)`
      const meta = [
        `Last modified: ${ctx.file.lastModified}`,
        ctx.filtered ? `⚠ ${ctx.sensitiveMatches} sensitive items filtered` : '',
      ].filter(Boolean).join(' | ')

      return `${header}\n${meta}\n\n\`\`\`${ctx.file.language}\n${ctx.content}\n\`\`\``
    })

    return sections.join('\n\n---\n\n')
  }

  async findRelatedFiles(filePath: string, maxDepth: number = 1): Promise<FileInfo[]> {
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.projectPath, filePath)

    const dir = path.dirname(resolvedPath)
    const basename = path.basename(resolvedPath, path.extname(resolvedPath))
    const related: FileInfo[] = []

    const candidates = [
      path.join(dir, `${basename}.test.ts`),
      path.join(dir, `${basename}.spec.ts`),
      path.join(dir, `${basename}.test.js`),
      path.join(dir, 'index.ts'),
      path.join(dir, 'index.js'),
    ]

    if (maxDepth > 0) {
      candidates.push(
        path.join(dir, '..', `${basename}.ts`),
        path.join(dir, '..', `${basename}.js`),
      )
    }

    for (const candidate of candidates) {
      const info = await this.extractFileInfo(candidate)
      if (info) related.push(info)
    }

    return related
  }

  private async expandPaths(paths: string[]): Promise<string[]> {
    const files: string[] = []
    for (const p of paths) {
      try {
        const stat = await fs.stat(p)
        if (stat.isDirectory()) {
          const dirFiles = await this.scanDirectory(p)
          files.push(...dirFiles)
        } else if (stat.isFile()) {
          files.push(p)
        }
      } catch {
        // Skip non-existent paths
      }
    }
    return files
  }

  private async scanDirectory(dirPath: string): Promise<string[]> {
    const files: string[] = []
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        if (shouldIgnore(fullPath)) continue

        if (entry.isDirectory()) {
          const subFiles = await this.scanDirectory(fullPath)
          files.push(...subFiles)
        } else if (entry.isFile()) {
          files.push(fullPath)
        }
      }
    } catch {
      // Skip inaccessible directories
    }
    return files
  }

  private async buildDirectoryTree(dirPath: string, depth: number = 0): Promise<DirectoryNode> {
    const name = path.basename(dirPath)
    const node: DirectoryNode = { name, files: 0, children: [] }

    if (depth > 5) return node

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        if (shouldIgnore(entry.name)) continue
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
          const child = await this.buildDirectoryTree(fullPath, depth + 1)
          node.children.push(child)
        } else {
          node.files++
        }
      }
    } catch {
      // Skip inaccessible directories
    }

    return node
  }

  private calculateHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 16)
  }
}
