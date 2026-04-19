import path from 'path'
import type { Category } from './content-classifier.js'

export interface KnowledgePath {
  category: Category
  subcategories: string[]
  name: string
  fullPath: string
}

export interface PathMappingRule {
  pattern: RegExp
  category: Category
  subcategories: string[]
  priority: number
}

export class PathMapper {
  private rules: PathMappingRule[] = []
  private maxDepth: number = 5
  
  private static readonly CATEGORY_TO_DIR: Record<Category, string> = {
    'entity': 'entities',
    'concept': 'concepts',
    'source': 'sources',
    'synthesis': 'synthesis'
  }
  
  constructor() {
    this.initializeDefaultRules()
  }
  
  mapToKnowledgePath(sourcePath: string, category: Category): KnowledgePath {
    const customPath = this.applyCustomRules(sourcePath)
    if (customPath) return customPath
    
    return this.defaultMapping(sourcePath, category)
  }
  
  parseKnowledgePath(knowledgePath: string): KnowledgePath {
    const parts = knowledgePath.split('/')
    
    const category = parts[0] as Category
    const name = parts[parts.length - 1]
    const subcategories = parts.slice(1, -1)
    
    return {
      category,
      subcategories,
      name,
      fullPath: knowledgePath
    }
  }
  
  generateFilePath(knowledgePath: KnowledgePath): string {
    const categoryDir = PathMapper.CATEGORY_TO_DIR[knowledgePath.category] || 
                        `${knowledgePath.category}s`
    
    const parts = [
      categoryDir,
      ...knowledgePath.subcategories,
      `${knowledgePath.name}.md`
    ]
    
    return path.join(...parts)
  }
  
  validateDepth(knowledgePath: KnowledgePath): boolean {
    const depth = knowledgePath.subcategories.length + 1
    return depth <= this.maxDepth
  }
  
  sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }
  
  addRule(rule: PathMappingRule): void {
    this.rules.push(rule)
    this.rules.sort((a, b) => b.priority - a.priority)
  }
  
  removeRule(pattern: RegExp): void {
    this.rules = this.rules.filter(r => r.pattern.source !== pattern.source)
  }
  
  getRules(): PathMappingRule[] {
    return [...this.rules]
  }
  
  setMaxDepth(depth: number): void {
    this.maxDepth = Math.max(1, Math.min(depth, 10))
  }
  
  getMaxDepth(): number {
    return this.maxDepth
  }
  
  private initializeDefaultRules(): void {
    this.rules = [
      {
        pattern: /\/docs\/adr\//i,
        category: 'synthesis',
        subcategories: ['decisions'],
        priority: 200
      },
      {
        pattern: /\/docs?\//i,
        category: 'source',
        subcategories: ['docs'],
        priority: 150
      },
      {
        pattern: /\/tests?\//i,
        category: 'entity',
        subcategories: ['tests'],
        priority: 150
      },
      {
        pattern: /\/__tests__\//i,
        category: 'entity',
        subcategories: ['tests'],
        priority: 150
      },
      {
        pattern: /\.(config|conf|settings)\./i,
        category: 'source',
        subcategories: ['config'],
        priority: 140
      },
    ]
  }
  
  private applyCustomRules(sourcePath: string): KnowledgePath | null {
    const normalizedPath = sourcePath.replace(/\\/g, '/')
    
    for (const rule of this.rules) {
      if (rule.pattern.test(normalizedPath)) {
        const fileName = path.basename(sourcePath, path.extname(sourcePath))
        const name = this.sanitizeName(fileName)
        
        const subcategories = this.resolveSubcategories(
          rule.subcategories,
          normalizedPath,
          rule.pattern
        )
        
        return {
          category: rule.category,
          subcategories: subcategories.slice(0, this.maxDepth - 1),
          name,
          fullPath: [rule.category, ...subcategories, name].join('/')
        }
      }
    }
    
    return null
  }
  
  private defaultMapping(sourcePath: string, category: Category): KnowledgePath {
    const parts = sourcePath.split(/[/\\]/)
    const srcIndex = parts.findIndex(p => p === 'src')
    
    let subcategories: string[] = []
    
    if (srcIndex >= 0 && srcIndex + 1 < parts.length) {
      const relativeParts = parts.slice(srcIndex + 1, -1)
      subcategories = relativeParts.slice(0, this.maxDepth - 1)
    }
    
    const fileName = path.basename(sourcePath, path.extname(sourcePath))
    const name = this.sanitizeName(fileName)
    
    return {
      category,
      subcategories,
      name,
      fullPath: [category, ...subcategories, name].join('/')
    }
  }
  
  private resolveSubcategories(
    template: string[],
    sourcePath: string,
    pattern: RegExp
  ): string[] {
    const match = sourcePath.match(pattern)
    
    return template.map(part => {
      if (part.startsWith('$')) {
        const groupIndex = parseInt(part.substring(1))
        if (match && match[groupIndex]) {
          return this.sanitizeName(match[groupIndex])
        }
      }
      return part
    }).filter(Boolean)
  }
}
