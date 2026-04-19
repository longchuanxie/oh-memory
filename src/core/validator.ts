import path from 'path'
import { promises as fs } from 'fs'
import { readMarkdownFile, listFiles, fileExists } from '../utils/file-utils.js'
import { findBrokenLinks, findOrphanNodes } from '../utils/graph-utils.js'
import type { LintResult, LintIssue, KnowledgeGraph } from '../types/index.js'

export class Validator {
  private basePath: string
  private graph: KnowledgeGraph | null = null

  constructor(basePath: string, graph: KnowledgeGraph | null) {
    this.basePath = basePath
    this.graph = graph
  }

  async validate(autoFix: boolean = false): Promise<LintResult> {
    const issues: LintIssue[] = []
    let fixed = 0

    issues.push(...await this.validateFormat())
    issues.push(...await this.validateLinks())
    issues.push(...await this.validateContent())

    if (autoFix) {
      fixed = await this.autoFix(issues)
    }

    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      fixed,
    }
  }

  private async validateFormat(): Promise<LintIssue[]> {
    const issues: LintIssue[] = []
    const categories = ['entities', 'concepts', 'sources', 'synthesis']

    for (const category of categories) {
      const categoryPath = path.join(this.basePath, category)
      
      if (!await fileExists(categoryPath)) {
        continue
      }

      const files = await listFiles(categoryPath, ['.md'])
      
      for (const file of files) {
        const page = await readMarkdownFile(file)
        
        if (!page) {
          issues.push({
            type: 'missing-cross-ref',
            severity: 'error',
            message: `Failed to read file: ${file}`,
            file,
          })
          continue
        }

        if (!page.frontmatter.title) {
          issues.push({
            type: 'missing-cross-ref',
            severity: 'error',
            message: 'Missing required field: title',
            file,
          })
        }

        if (!page.frontmatter.type) {
          issues.push({
            type: 'missing-cross-ref',
            severity: 'error',
            message: 'Missing required field: type',
            file,
          })
        }

        if (!page.frontmatter.date) {
          issues.push({
            type: 'missing-cross-ref',
            severity: 'warning',
            message: 'Missing recommended field: date',
            file,
          })
        }
      }
    }

    return issues
  }

  private async validateLinks(): Promise<LintIssue[]> {
    const issues: LintIssue[] = []

    if (!this.graph) {
      return issues
    }

    const brokenLinks = findBrokenLinks(this.graph)
    
    for (const link of brokenLinks) {
      issues.push({
        type: 'broken-link',
        severity: 'error',
        message: `Broken link from [[${link.from}]] to [[${link.to}]]`,
        file: link.from,
        suggestion: `Remove link or create page: ${link.to}`,
      })
    }

    const orphanNodes = findOrphanNodes(this.graph)
    
    for (const nodeId of orphanNodes) {
      if (nodeId !== 'index' && nodeId !== 'log') {
        issues.push({
          type: 'orphan-page',
          severity: 'warning',
          message: `Orphan page with no inbound links: [[${nodeId}]]`,
          file: nodeId,
          suggestion: 'Add cross-references from related pages',
        })
      }
    }

    return issues
  }

  private async validateContent(): Promise<LintIssue[]> {
    const issues: LintIssue[] = []

    issues.push({
      type: 'contradiction',
      severity: 'warning',
      message: 'Content validation requires LLM analysis',
      file: 'index',
      suggestion: 'Use LLM to check for content contradictions',
    })

    return issues
  }

  private async autoFix(issues: LintIssue[]): Promise<number> {
    let fixed = 0

    for (const issue of issues) {
      if (issue.severity === 'error' && issue.type === 'broken-link') {
        const fixedCount = await this.fixBrokenLink(issue)
        fixed += fixedCount
      }
    }

    return fixed
  }

  private async fixBrokenLink(issue: LintIssue): Promise<number> {
    const match = issue.message.match(/\[\[([^\]]+)\]\] to \[\[([^\]]+)\]\]/)
    
    if (!match) {
      return 0
    }

    const [, fromPage, toPage] = match
    const fromPath = await this.findPagePath(fromPage)
    
    if (!fromPath) {
      return 0
    }

    const page = await readMarkdownFile(fromPath)
    
    if (!page) {
      return 0
    }

    const brokenLinkPattern = new RegExp(`\\[\\[${toPage}(\\|[^\\]]+)?\\]\\]`, 'g')
    const fixedContent = page.content.replace(brokenLinkPattern, `<!-- broken link: ${toPage} -->`)
    
    if (fixedContent !== page.content) {
      const { writeMarkdownFile } = await import('../utils/file-utils')
      await writeMarkdownFile(fromPath, page.frontmatter, fixedContent)
      return 1
    }

    return 0
  }

  private async findPagePath(pageId: string): Promise<string | null> {
    const categories = ['entities', 'concepts', 'sources', 'synthesis']
    
    for (const category of categories) {
      const pagePath = path.join(this.basePath, category, `${pageId}.md`)
      if (await fileExists(pagePath)) {
        return pagePath
      }
    }
    
    return null
  }
}
