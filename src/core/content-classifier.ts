import path from 'path'

import { Logger } from '../utils/logger.js'

export type Category = 'entity' | 'concept' | 'source' | 'synthesis'

export interface ClassificationResult {
  category: Category
  confidence: number
  reasons: string[]
}

export interface ClassificationRule {
  name: string
  category: Category
  condition: (context: ClassificationContext) => boolean
  weight: number
}

export interface ClassificationContext {
  filePath: string
  extension: string
  content: string
  fileName: string
  dirName: string
}

export class ContentClassifier {
  private rules: ClassificationRule[] = []
  private logger = Logger.getInstance()
  
  constructor() {
    this.initializeRules()
  }
  
  classify(filePath: string, content: string): ClassificationResult {
    const context = this.buildContext(filePath, content)
    const scores = this.calculateScores(context)
    return this.makeDecision(scores, context)
  }
  
  private initializeRules(): void {
    this.rules = [
      // ==================== Entity Rules ====================
      
      {
        name: 'source-code-extension',
        category: 'entity',
        weight: 0.9,
        condition: (ctx) => {
          const codeExtensions = [
            '.ts', '.tsx', '.js', '.jsx', 
            '.py', '.java', '.go', '.rs', '.rb',
            '.vue', '.svelte', '.angular'
          ]
          return codeExtensions.includes(ctx.extension)
        }
      },
      
      {
        name: 'has-class-or-function',
        category: 'entity',
        weight: 0.7,
        condition: (ctx) => {
          const patterns = [
            /^(export\s+)?(class|interface|function|const|let|var)\s+\w+/m,
            /^(public|private|protected)?\s*(async\s+)?function\s+\w+/m,
            /^def\s+\w+\s*\(/m,
            /^class\s+\w+/m,
          ]
          return patterns.some(p => p.test(ctx.content))
        }
      },
      
      {
        name: 'component-file',
        category: 'entity',
        weight: 0.8,
        condition: (ctx) => {
          return /\.(component|service|controller|model|repository|util|helper|factory|provider)/i.test(ctx.fileName)
        }
      },
      
      {
        name: 'has-imports',
        category: 'entity',
        weight: 0.6,
        condition: (ctx) => {
          const patterns = [
            /import\s+.*from\s+['"]/,
            /require\s*\(\s*['"]/,
            /^from\s+\w+\s+import/m,
          ]
          return patterns.some(p => p.test(ctx.content))
        }
      },
      
      // ==================== Concept Rules ====================
      
      {
        name: 'architecture-doc',
        category: 'concept',
        weight: 0.7,
        condition: (ctx) => {
          const patterns = [
            /(architecture|design\s+pattern|system\s+design)/i,
            /(how\s+to|guide|tutorial|walkthrough)/i,
            /(api\s+design|data\s+model|workflow)/i,
            /(best\s+practice|pattern|principle)/i,
          ]
          return ctx.extension === '.md' && patterns.some(p => p.test(ctx.content))
        }
      },
      
      {
        name: 'concept-filename',
        category: 'concept',
        weight: 0.5,
        condition: (ctx) => {
          const patterns = [
            /(design|architecture|pattern|flow|guide|tutorial)/i,
            /(concept|theory|principle|approach|methodology)/i,
            /(workflow|process|pipeline)/i,
          ]
          return patterns.some(p => p.test(ctx.fileName))
        }
      },
      
      {
        name: 'has-diagrams',
        category: 'concept',
        weight: 0.7,
        condition: (ctx) => {
          const patterns = [
            /```(mermaid|graph|flowchart|sequence|class)/,
            /\[.*\]\(.*\.(png|jpg|svg|drawio)\)/i,
            /(sequence|flow|state|class)\s+diagram/i,
            /graph\s+(TD|LR|TB)/i,
          ]
          return patterns.some(p => p.test(ctx.content))
        }
      },
      
      {
        name: 'conceptual-content',
        category: 'concept',
        weight: 0.5,
        condition: (ctx) => {
          const patterns = [
            /^#{1,3}\s+(overview|introduction|background)/m,
            /(this\s+document|this\s+guide|this\s+tutorial)/i,
            /(following\s+sections?|below\s+we\s+will)/i,
          ]
          return ctx.extension === '.md' && patterns.some(p => p.test(ctx.content))
        }
      },
      
      // ==================== Source Rules ====================
      
      {
        name: 'standard-docs',
        category: 'source',
        weight: 1.0,
        condition: (ctx) => {
          const patterns = [
            /^(README|CHANGELOG|CONTRIBUTING|LICENSE|AUTHORS)$/i,
            /^(INSTALL|SETUP|USAGE|FAQ|NOTES)$/i,
            /^(HISTORY|CHANGES|NEWS)$/i,
          ]
          return patterns.some(p => p.test(ctx.fileName))
        }
      },
      
      {
        name: 'config-files',
        category: 'source',
        weight: 0.95,
        condition: (ctx) => {
          const configPatterns = [
            /\.(config|conf|settings|env)/i,
            /^(tsconfig|package|docker|webpack|vite|rollup)/i,
          ]
          const configExtensions = ['.json', '.yaml', '.yml', '.toml', '.ini', '.env']
          
          return configPatterns.some(p => p.test(ctx.fileName)) ||
                 configExtensions.includes(ctx.extension)
        }
      },
      
      {
        name: 'external-references',
        category: 'source',
        weight: 0.6,
        condition: (ctx) => {
          const patterns = [
            /\[.*\]\(https?:\/\//,
            /(reference|documentation|external|third-party|official)/i,
            /(see\s+also|related\s+links|resources)/i,
          ]
          return patterns.some(p => p.test(ctx.content))
        }
      },
      
      {
        name: 'docs-directory',
        category: 'source',
        weight: 0.6,
        condition: (ctx) => {
          return /\/docs?\//i.test(ctx.filePath) && ctx.extension === '.md'
        }
      },
      
      // ==================== Synthesis Rules ====================
      
      {
        name: 'cross-module-analysis',
        category: 'synthesis',
        weight: 1.0,
        condition: (ctx) => {
          const patterns = [
            /(migration|upgrade|refactor|comparison)/i,
            /(architecture|system)\s+(decision|overview)/i,
          ]
          return ctx.extension === '.md' && patterns.some(p => p.test(ctx.fileName))
        }
      },
      
      {
        name: 'multi-module-references',
        category: 'synthesis',
        weight: 1.0,
        condition: (ctx) => {
          const linkPattern = /\[\[([^\]]+)\]\]/g
          const links = ctx.content.match(linkPattern) || []
          const uniqueModules = new Set(
            links.map(link => link.replace(/\[\[|\]\]/g, '').split('/')[0])
          )
          return uniqueModules.size >= 3
        }
      },
      
      {
        name: 'decision-records',
        category: 'synthesis',
        weight: 0.9,
        condition: (ctx) => {
          const patterns = [
            /^(ADR|RFC|RFP)-\d+/,
            /(decision|choice|rationale|why\s+we\s+chose)/i,
            /(pros\s+and\s+cons|trade-off|alternatives?|options?)/i,
            /(accepted|rejected|superseded)/i,
          ]
          return patterns.some(p => p.test(ctx.fileName) || p.test(ctx.content))
        }
      },
      
      {
        name: 'synthesis-content',
        category: 'synthesis',
        weight: 0.65,
        condition: (ctx) => {
          const patterns = [
            /^#{1,3}\s+(summary|conclusion|recommendation)/m,
            /(overall|in\s+summary|to\s+conclude)/i,
            /(comparative\s+analysis|cross-cutting)/i,
          ]
          return ctx.extension === '.md' && patterns.some(p => p.test(ctx.content))
        }
      },
      
      {
        name: 'retrospective-docs',
        category: 'synthesis',
        weight: 0.75,
        condition: (ctx) => {
          const patterns = [
            /(retrospective|post-mortem|lessons\s+learned)/i,
            /(what\s+we\s+learned|key\s+takeaways)/i,
            /(improvements?|next\s+steps)/i,
          ]
          return ctx.extension === '.md' && patterns.some(p => p.test(ctx.fileName) || p.test(ctx.content))
        }
      },
    ]
  }
  
  private buildContext(filePath: string, content: string): ClassificationContext {
    const ext = path.extname(filePath)
    const fileName = path.basename(filePath, ext)
    const dirName = path.dirname(filePath)
    
    return {
      filePath,
      extension: ext.toLowerCase(),
      content,
      fileName,
      dirName,
    }
  }
  
  private calculateScores(context: ClassificationContext): Map<Category, number> {
    const scores = new Map<Category, number>([
      ['entity', 0],
      ['concept', 0],
      ['source', 0],
      ['synthesis', 0]
    ])
    
    const matchedRules = new Map<Category, string[]>()
    
    for (const rule of this.rules) {
      try {
        if (rule.condition(context)) {
          const currentScore = scores.get(rule.category) || 0
          scores.set(rule.category, currentScore + rule.weight)
          
          if (!matchedRules.has(rule.category)) {
            matchedRules.set(rule.category, [])
          }
          matchedRules.get(rule.category)!.push(rule.name)
        }
      } catch (error) {
        this.logger.warn(`Rule "${rule.name}" failed`, { error: error instanceof Error ? error.message : String(error) })
      }
    }
    
    return scores
  }
  
  private makeDecision(
    scores: Map<Category, number>,
    context: ClassificationContext
  ): ClassificationResult {
    let maxScore = 0
    let bestCategory: Category = 'source'
    const reasons: string[] = []
    
    for (const [category, score] of scores) {
      if (score > maxScore) {
        maxScore = score
        bestCategory = category
      }
    }
    
    if (maxScore === 0) {
      if (['.ts', '.tsx', '.js', '.jsx', '.py'].includes(context.extension)) {
        bestCategory = 'entity'
        reasons.push('fallback: source code extension')
      } else if (context.extension === '.md') {
        bestCategory = 'concept'
        reasons.push('fallback: markdown file')
      } else {
        bestCategory = 'source'
        reasons.push('fallback: default')
      }
    } else {
      for (const [category, score] of scores) {
        if (score > 0) {
          const percentage = ((score / maxScore) * 100).toFixed(0)
          reasons.push(`${category}: ${percentage}%`)
        }
      }
    }
    
    const confidence = maxScore > 0 ? Math.min(maxScore / 2.5, 1) : 0.5
    
    return {
      category: bestCategory,
      confidence,
      reasons,
    }
  }
  
  addRule(rule: ClassificationRule): void {
    this.rules.push(rule)
  }
  
  removeRule(ruleName: string): void {
    this.rules = this.rules.filter(r => r.name !== ruleName)
  }
  
  getRules(): ClassificationRule[] {
    return [...this.rules]
  }
}
