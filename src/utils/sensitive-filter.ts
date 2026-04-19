import type { SensitivePattern, SensitiveMatch, FilterResult } from '../types/index.js'
import { DEFAULT_SENSITIVE_PATTERNS } from './sensitive-patterns.js'
import { Logger } from './logger.js'

export interface FilterOptions {
  timeout?: number
  skipTestFiles?: boolean
  skipExampleFiles?: boolean
  maxMatches?: number
}

export interface FilterContext {
  filePath: string
  isTestFile: boolean
  isExampleFile: boolean
  isConfigFile: boolean
}

export class SensitiveDataFilter {
  private patterns: SensitivePattern[]
  private filterLog: Array<{
    timestamp: string
    file: string
    matches: SensitiveMatch[]
    skipped: boolean
    reason?: string
  }> = []
  private logger = Logger.getInstance()

  private readonly DEFAULT_TIMEOUT = 5000
  private readonly DEFAULT_MAX_MATCHES = 100

  constructor(customPatterns?: SensitivePattern[]) {
    this.patterns = customPatterns || DEFAULT_SENSITIVE_PATTERNS
  }

  scan(content: string, options?: FilterOptions): SensitiveMatch[] {
    const matches: SensitiveMatch[] = []
    const lines = content.split('\n')
    const timeout = options?.timeout || this.DEFAULT_TIMEOUT
    const maxMatches = options?.maxMatches || this.DEFAULT_MAX_MATCHES
    const startTime = Date.now()

    for (const pattern of this.patterns) {
      if (Date.now() - startTime > timeout) {
        this.logger.warn('Sensitive scan timeout, skipping remaining patterns')
        break
      }

      if (matches.length >= maxMatches) {
        this.logger.warn('Max matches reached, stopping scan', { maxMatches })
        break
      }

      let match
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags)
      
      try {
        while ((match = regex.exec(content)) !== null) {
          if (matches.length >= maxMatches) break
          
          const lineNumber = this.getLineNumber(content, match.index)
          const line = lines[lineNumber - 1] || ''
          
          matches.push({
            patternId: pattern.id,
            type: pattern.name,
            value: this.maskValue(match[0]),
            location: {
              line: lineNumber,
              start: match.index,
              end: match.index + match[0].length
            },
            severity: pattern.severity
          })
        }
      } catch (error) {
        this.logger.warn(`Regex error for pattern ${pattern.id}`, { error: error instanceof Error ? error.message : String(error) })
      }
    }

    return matches
  }

  filter(content: string, filePath?: string, options?: FilterOptions): FilterResult {
    const context = filePath ? this.analyzeContext(filePath) : null

    if (context && options?.skipTestFiles && context.isTestFile) {
      this.logFilter(filePath!, [], true, 'test-file')
      return {
        original: content,
        filtered: content,
        matches: [],
        redactedCount: 0,
        warningCount: 0
      }
    }

    if (context && options?.skipExampleFiles && context.isExampleFile) {
      this.logFilter(filePath!, [], true, 'example-file')
      return {
        original: content,
        filtered: content,
        matches: [],
        redactedCount: 0,
        warningCount: 0
      }
    }

    const matches = this.scan(content, options)
    let filtered = content
    let redactedCount = 0
    let warningCount = 0

    const sortedMatches = [...matches].sort((a, b) => 
      b.location.start - a.location.start
    )

    for (const match of sortedMatches) {
      const pattern = this.patterns.find(p => p.id === match.patternId)
      if (!pattern) continue

      if (pattern.action === 'redact') {
        filtered = filtered.slice(0, match.location.start) +
          `[REDACTED:${match.type}]` +
          filtered.slice(match.location.end)
        redactedCount++
      } else if (pattern.action === 'warn') {
        warningCount++
      }
    }

    if (filePath && matches.length > 0) {
      this.logFilter(filePath, matches, false)
    }

    return {
      original: content,
      filtered,
      matches,
      redactedCount,
      warningCount
    }
  }

  private analyzeContext(filePath: string): FilterContext {
    const lowerPath = filePath.toLowerCase()
    
    return {
      filePath,
      isTestFile: this.isTestFile(lowerPath),
      isExampleFile: this.isExampleFile(lowerPath),
      isConfigFile: this.isConfigFile(lowerPath)
    }
  }

  private isTestFile(path: string): boolean {
    const testPatterns = [
      /\.test\.(ts|tsx|js|jsx)$/,
      /\.spec\.(ts|tsx|js|jsx)$/,
      /__tests__/,
      /__mocks__/,
      /\.test\//,
      /\/tests?\//,
      /\/__tests__\//
    ]
    
    return testPatterns.some(p => p.test(path))
  }

  private isExampleFile(path: string): boolean {
    const examplePatterns = [
      /\.example\.(ts|tsx|js|jsx|json|yaml|yml)$/,
      /\/examples?\//,
      /\/docs\/examples?\//,
      /sample/,
      /demo/
    ]
    
    return examplePatterns.some(p => p.test(path))
  }

  private isConfigFile(path: string): boolean {
    const configPatterns = [
      /\.config\.(ts|tsx|js|jsx|json)$/,
      /\.env(\.|$)/,
      /config\.yaml$/,
      /config\.json$/
    ]
    
    return configPatterns.some(p => p.test(path))
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length
  }

  private maskValue(value: string): string {
    if (value.length <= 8) {
      return '*'.repeat(value.length)
    }
    return value.substring(0, 4) + '****' + value.substring(value.length - 4)
  }

  private logFilter(
    filePath: string,
    matches: SensitiveMatch[],
    skipped: boolean,
    reason?: string
  ): void {
    this.filterLog.push({
      timestamp: new Date().toISOString(),
      file: filePath,
      matches,
      skipped,
      reason
    })
  }

  getFilterLog(): Array<{
    timestamp: string
    file: string
    matches: SensitiveMatch[]
    skipped: boolean
    reason?: string
  }> {
    return this.filterLog
  }

  addPattern(pattern: SensitivePattern): void {
    this.patterns.push(pattern)
  }

  removePattern(patternId: string): void {
    this.patterns = this.patterns.filter(p => p.id !== patternId)
  }

  clearLog(): void {
    this.filterLog = []
  }
}
