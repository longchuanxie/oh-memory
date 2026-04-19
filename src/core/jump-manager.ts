import { promises as fs } from 'fs'
import path from 'path'
import type { SourceLocation, ParsedPage, ParsedFrontmatter } from '../types/index.js'
import { fileExists } from '../utils/file-utils.js'

export interface JumpTarget {
  type: 'source' | 'knowledge' | 'external'
  path: string
  line?: number
  column?: number
  label: string
}

export interface JumpManagerResult {
  success: boolean
  target?: JumpTarget
  error?: string
  targets?: JumpTarget[]
}

export class JumpManager {
  private projectPath: string
  private memoryPath: string

  constructor(projectPath: string, memoryPath: string) {
    this.projectPath = projectPath
    this.memoryPath = memoryPath
  }

  async jumpToSource(pageId: string): Promise<JumpManagerResult> {
    const pagePath = await this.findPagePath(pageId)
    
    if (!pagePath) {
      return { success: false, error: `Page not found: ${pageId}` }
    }

    const page = await this.readPage(pagePath)
    
    if (!page) {
      return { success: false, error: `Could not read page: ${pageId}` }
    }

    const sourceLocation = this.extractSourceLocation(page)
    
    if (!sourceLocation) {
      return { success: false, error: `No source location found for: ${pageId}` }
    }

    const fullPath = path.resolve(this.projectPath, sourceLocation.path)
    
    if (!await fileExists(fullPath)) {
      return { success: false, error: `Source file not found: ${sourceLocation.path}` }
    }

    return {
      success: true,
      target: {
        type: 'source',
        path: fullPath,
        line: sourceLocation.line,
        column: sourceLocation.column,
        label: sourceLocation.description || path.basename(sourceLocation.path)
      }
    }
  }

  async jumpToKnowledge(pageId: string): Promise<JumpManagerResult> {
    const pagePath = await this.findPagePath(pageId)
    
    if (!pagePath) {
      return { success: false, error: `Page not found: ${pageId}` }
    }

    return {
      success: true,
      target: {
        type: 'knowledge',
        path: pagePath,
        label: pageId
      }
    }
  }

  async getJumpTargets(pageId: string): Promise<JumpTarget[]> {
    const targets: JumpTarget[] = []
    const pagePath = await this.findPagePath(pageId)
    
    if (!pagePath) return targets

    const page = await this.readPage(pagePath)
    if (!page) return targets

    const primarySource = this.extractSourceLocation(page)
    if (primarySource) {
      targets.push({
        type: 'source',
        path: path.resolve(this.projectPath, primarySource.path),
        line: primarySource.line,
        label: `Primary: ${path.basename(primarySource.path)}`
      })
    }

    const additionalSources = this.extractAdditionalSources(page)
    for (const source of additionalSources) {
      targets.push({
        type: 'source',
        path: path.resolve(this.projectPath, source.path),
        line: source.line,
        label: source.description || path.basename(source.path)
      })
    }

    const linkedPages = this.extractLinkedPages(page)
    for (const linkedPage of linkedPages) {
      targets.push({
        type: 'knowledge',
        path: linkedPage,
        label: `Related: ${linkedPage}`
      })
    }

    return targets
  }

  private async findPagePath(pageId: string): Promise<string | null> {
    const categories = ['entities', 'concepts', 'sources', 'synthesis']
    
    for (const category of categories) {
      const pagePath = path.join(this.memoryPath, category, `${pageId}.md`)
      if (await fileExists(pagePath)) {
        return pagePath
      }
    }

    return null
  }

  private async readPage(pagePath: string): Promise<ParsedPage | null> {
    try {
      const content = await fs.readFile(pagePath, 'utf-8')
      return this.parseMarkdown(content)
    } catch {
      return null
    }
  }

  private parseMarkdown(content: string): ParsedPage {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    
    if (!frontmatterMatch) {
      return { frontmatter: {}, content }
    }

    const frontmatterText = frontmatterMatch[1]
    const body = frontmatterMatch[2]

    const frontmatter: ParsedFrontmatter = {}
    for (const line of frontmatterText.split('\n')) {
      const match = line.match(/^(\w+):\s*(.*)$/)
      if (match) {
        frontmatter[match[1]] = match[2]
      }
    }

    return { frontmatter, content: body }
  }

  private extractSourceLocation(page: ParsedPage): SourceLocation | null {
    const source = page.frontmatter?.source
    
    if (!source?.path) {
      return null
    }

    return {
      path: source.path,
      line: source.line,
      column: source.column,
      description: source.description
    }
  }

  private extractAdditionalSources(page: ParsedPage): SourceLocation[] {
    const sources: SourceLocation[] = []
    const sourceLocations = page.frontmatter?.sourceLocations
    
    if (Array.isArray(sourceLocations)) {
      for (const loc of sourceLocations) {
        if (loc.path) {
          sources.push({
            path: loc.path,
            line: loc.line,
            column: loc.column,
            description: loc.description
          })
        }
      }
    }

    return sources
  }

  private extractLinkedPages(page: ParsedPage): string[] {
    const links: string[] = []
    const content = page.content || ''
    
    const linkPattern = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
    let match
    
    while ((match = linkPattern.exec(content)) !== null) {
      links.push(match[1])
    }

    return [...new Set(links)]
  }
}
