import type { KnowledgeNode } from '../types/index.js'
import path from 'path'

export interface TagRule {
  type: 'path' | 'content' | 'import' | 'function' | 'tech-stack'
  pattern: RegExp | string
  tags: string[]
  confidence: number
}

export interface AutoTagResult {
  tags: string[]
  sources: Map<string, string[]>
}

export class AutoTagger {
  private rules: TagRule[] = []
  private synonymMap: Map<string, string> = new Map()
  private excludePatterns: RegExp[] = []

  constructor() {
    this.initializeDefaultRules()
    this.initializeSynonyms()
    this.initializeExclusions()
  }

  private initializeDefaultRules(): void {
    this.rules = [
      {
        type: 'path',
        pattern: /\/auth\/|\/authentication\//i,
        tags: ['authentication', 'security'],
        confidence: 0.9
      },
      {
        type: 'path',
        pattern: /\/api\/|\/routes?\//i,
        tags: ['api', 'endpoint'],
        confidence: 0.85
      },
      {
        type: 'path',
        pattern: /\/components?\//i,
        tags: ['component', 'ui'],
        confidence: 0.8
      },
      {
        type: 'path',
        pattern: /\/hooks?\//i,
        tags: ['hook', 'react'],
        confidence: 0.85
      },
      {
        type: 'path',
        pattern: /\/utils?\//i,
        tags: ['utility', 'helper'],
        confidence: 0.7
      },
      {
        type: 'path',
        pattern: /\/services?\//i,
        tags: ['service', 'business-logic'],
        confidence: 0.8
      },
      {
        type: 'path',
        pattern: /\/models?\//i,
        tags: ['model', 'data'],
        confidence: 0.8
      },
      {
        type: 'path',
        pattern: /\/middleware\//i,
        tags: ['middleware', 'request-handling'],
        confidence: 0.85
      },
      {
        type: 'path',
        pattern: /\/config\//i,
        tags: ['configuration', 'settings'],
        confidence: 0.85
      },
      {
        type: 'path',
        pattern: /\/tests?\//i,
        tags: ['testing', 'test'],
        confidence: 0.9
      },
      {
        type: 'path',
        pattern: /\/database\/|\/db\//i,
        tags: ['database', 'storage'],
        confidence: 0.85
      },
      {
        type: 'import',
        pattern: 'react',
        tags: ['react', 'frontend'],
        confidence: 0.9
      },
      {
        type: 'import',
        pattern: 'express',
        tags: ['express', 'backend', 'api'],
        confidence: 0.9
      },
      {
        type: 'import',
        pattern: 'mongoose',
        tags: ['mongodb', 'database', 'orm'],
        confidence: 0.9
      },
      {
        type: 'import',
        pattern: 'prisma',
        tags: ['prisma', 'database', 'orm'],
        confidence: 0.9
      },
      {
        type: 'import',
        pattern: 'jsonwebtoken',
        tags: ['jwt', 'authentication', 'security'],
        confidence: 0.95
      },
      {
        type: 'import',
        pattern: 'bcrypt',
        tags: ['encryption', 'security', 'password'],
        confidence: 0.95
      },
      {
        type: 'import',
        pattern: 'axios',
        tags: ['http-client', 'api'],
        confidence: 0.85
      },
      {
        type: 'import',
        pattern: 'zod',
        tags: ['validation', 'schema'],
        confidence: 0.9
      },
      {
        type: 'import',
        pattern: 'tailwindcss',
        tags: ['css', 'styling', 'tailwind'],
        confidence: 0.9
      },
      {
        type: 'function',
        pattern: /^(use|create|fetch|get|set|update|delete|handle|on|render)/i,
        tags: ['function'],
        confidence: 0.6
      },
      {
        type: 'function',
        pattern: /^(login|logout|signin|signup|register|authenticate)/i,
        tags: ['authentication', 'user-management'],
        confidence: 0.9
      },
      {
        type: 'function',
        pattern: /^(validate|check|verify|sanitize)/i,
        tags: ['validation', 'security'],
        confidence: 0.85
      },
      {
        type: 'content',
        pattern: /\b(password|token|secret|api[_-]?key|credential)\b/i,
        tags: ['security', 'sensitive'],
        confidence: 0.8
      },
      {
        type: 'content',
        pattern: /\b(error|exception|catch|throw)\b/i,
        tags: ['error-handling'],
        confidence: 0.7
      },
      {
        type: 'content',
        pattern: /\b(cache|memoize|store)\b/i,
        tags: ['caching', 'performance'],
        confidence: 0.75
      },
      {
        type: 'content',
        pattern: /\b(test|spec|mock|stub)\b/i,
        tags: ['testing'],
        confidence: 0.8
      },
      {
        type: 'tech-stack',
        pattern: 'TypeScript',
        tags: ['typescript'],
        confidence: 0.95
      },
      {
        type: 'tech-stack',
        pattern: 'JavaScript',
        tags: ['javascript'],
        confidence: 0.95
      },
      {
        type: 'tech-stack',
        pattern: 'Python',
        tags: ['python'],
        confidence: 0.95
      }
    ]
  }

  private initializeSynonyms(): void {
    const synonyms: Array<[string, string]> = [
      ['auth', 'authentication'],
      ['login', 'authentication'],
      ['signin', 'authentication'],
      ['logout', 'authentication'],
      ['signup', 'authentication'],
      ['register', 'authentication'],
      ['db', 'database'],
      ['mongo', 'mongodb'],
      ['postgres', 'postgresql'],
      ['test', 'testing'],
      ['spec', 'testing'],
      ['util', 'utility'],
      ['helper', 'utility'],
      ['config', 'configuration'],
      ['setting', 'configuration'],
      ['api', 'endpoint'],
      ['component', 'ui'],
      ['style', 'styling']
    ]

    for (const [from, to] of synonyms) {
      this.synonymMap.set(from.toLowerCase(), to.toLowerCase())
    }
  }

  private initializeExclusions(): void {
    this.excludePatterns = [
      /^index$/i,
      /^main$/i,
      /^app$/i,
      /^types$/i,
      /^constants$/i
    ]
  }

  generateTags(
    filePath: string,
    content: string,
    metadata: {
      imports?: string[]
      functions?: string[]
      classes?: string[]
      techStack?: string[]
    }
  ): AutoTagResult {
    const result: AutoTagResult = {
      tags: [],
      sources: new Map()
    }

    const pathTags = this.analyzePath(filePath)
    this.mergeTags(result, pathTags, 'path')

    if (metadata.imports?.length) {
      const importTags = this.analyzeImports(metadata.imports)
      this.mergeTags(result, importTags, 'import')
    }

    if (metadata.functions?.length) {
      const functionTags = this.analyzeFunctions(metadata.functions)
      this.mergeTags(result, functionTags, 'function')
    }

    const contentTags = this.analyzeContent(content)
    this.mergeTags(result, contentTags, 'content')

    if (metadata.techStack?.length) {
      const techTags = this.analyzeTechStack(metadata.techStack)
      this.mergeTags(result, techTags, 'tech-stack')
    }

    result.tags = this.normalizeTags(result.tags)

    return result
  }

  private analyzePath(filePath: string): Array<{ tag: string; confidence: number }> {
    const results: Array<{ tag: string; confidence: number }> = []

    for (const rule of this.rules.filter(r => r.type === 'path')) {
      if (rule.pattern instanceof RegExp && rule.pattern.test(filePath)) {
        for (const tag of rule.tags) {
          results.push({ tag, confidence: rule.confidence })
        }
      }
    }

    const parts = filePath.split(/[/\\]/)
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i].toLowerCase()
      if (dir.length > 2 && !this.excludePatterns.some(p => p.test(dir))) {
        results.push({ tag: dir, confidence: 0.5 })
      }
    }

    return results
  }

  private analyzeImports(imports: string[]): Array<{ tag: string; confidence: number }> {
    const results: Array<{ tag: string; confidence: number }> = []

    for (const rule of this.rules.filter(r => r.type === 'import')) {
      const pattern = rule.pattern
      const isMatch = typeof pattern === 'string'
        ? imports.some(imp => imp.toLowerCase().includes(pattern.toLowerCase()))
        : imports.some(imp => pattern.test(imp))

      if (isMatch) {
        for (const tag of rule.tags) {
          results.push({ tag, confidence: rule.confidence })
        }
      }
    }

    return results
  }

  private analyzeFunctions(functions: string[]): Array<{ tag: string; confidence: number }> {
    const results: Array<{ tag: string; confidence: number }> = []

    for (const rule of this.rules.filter(r => r.type === 'function')) {
      if (rule.pattern instanceof RegExp) {
        for (const func of functions) {
          if (rule.pattern.test(func)) {
            for (const tag of rule.tags) {
              results.push({ tag, confidence: rule.confidence })
            }
          }
        }
      }
    }

    return results
  }

  private analyzeContent(content: string): Array<{ tag: string; confidence: number }> {
    const results: Array<{ tag: string; confidence: number }> = []

    for (const rule of this.rules.filter(r => r.type === 'content')) {
      if (rule.pattern instanceof RegExp && rule.pattern.test(content)) {
        for (const tag of rule.tags) {
          results.push({ tag, confidence: rule.confidence })
        }
      }
    }

    return results
  }

  private analyzeTechStack(techStack: string[]): Array<{ tag: string; confidence: number }> {
    const results: Array<{ tag: string; confidence: number }> = []

    for (const rule of this.rules.filter(r => r.type === 'tech-stack')) {
      const pattern = rule.pattern
      const isMatch = typeof pattern === 'string'
        ? techStack.some(t => t.toLowerCase() === pattern.toLowerCase())
        : techStack.some(t => pattern.test(t))

      if (isMatch) {
        for (const tag of rule.tags) {
          results.push({ tag, confidence: rule.confidence })
        }
      }
    }

    return results
  }

  private mergeTags(
    result: AutoTagResult,
    newTags: Array<{ tag: string; confidence: number }>,
    source: string
  ): void {
    for (const { tag, confidence } of newTags) {
      const existing = result.tags.find(t => t === tag)
      if (!existing) {
        result.tags.push(tag)
      }
      
      if (!result.sources.has(tag)) {
        result.sources.set(tag, [])
      }
      result.sources.get(tag)!.push(source)
    }
  }

  private normalizeTags(tags: string[]): string[] {
    const normalized: string[] = []
    const seen = new Set<string>()

    for (const tag of tags) {
      let normalizedTag = tag.toLowerCase().trim()
      
      if (this.synonymMap.has(normalizedTag)) {
        normalizedTag = this.synonymMap.get(normalizedTag)!
      }

      if (!seen.has(normalizedTag)) {
        seen.add(normalizedTag)
        normalized.push(normalizedTag)
      }
    }

    return normalized.slice(0, 10)
  }

  addRule(rule: TagRule): void {
    this.rules.push(rule)
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r, i) => `${r.type}-${i}` !== ruleId)
  }

  addSynonym(from: string, to: string): void {
    this.synonymMap.set(from.toLowerCase(), to.toLowerCase())
  }
}
