# REQ-003 & REQ-004: 双向链接网络与标签系统 - 开发设计方案

> **需求编号**: REQ-003, REQ-004  
> **优先级**: P0 - 最高  
> **预计工时**: 3 天  
> **依赖**: REQ-012, REQ-013  
> **版本**: v1.1 (根据评审结果修订)  

---

## 一、需求概述

### 1.1 背景

现有系统已有基础的链接提取和标签支持，但功能不完善：

- **链接提取**: 已实现 `extractLinks`，但缺少反向链接索引
- **标签系统**: 已有 `tags` 字段，但需要手动添加标签
- **链接验证**: 已有 `findBrokenLinks`，但缺少自动修复

### 1.2 目标

- 完善双向链接索引
- **实现自动标签生成**（核心改进：减少人工参与）
- 实现标签索引和聚合
- 增强链接验证和修复

### 1.3 评审反馈响应

根据技术评审报告，本版本重点改进：

1. **自动标签生成** - 在摄入文件时系统自动分析并生成标签，无需人工干预
2. **复用现有代码** - 避免与 `knowledge-base.ts` 中现有功能重复
3. **标签规范化** - 统一标签格式，支持同义词合并

---

## 二、技术设计

### 2.1 双向链接索引

```typescript
// src/core/link-index.ts

import type { KnowledgeGraph, KnowledgeEdge } from '../types'

export interface LinkIndex {
  forward: Map<string, Set<string>>
  backward: Map<string, Set<string>>
  contexts: Map<string, LinkContext[]>
}

export interface LinkContext {
  source: string
  target: string
  displayText?: string
  line: number
  context: string
}

export class LinkIndexManager {
  private index: LinkIndex = {
    forward: new Map(),
    backward: new Map(),
    contexts: new Map()
  }

  addLink(source: string, target: string, context?: LinkContext): void {
    if (!this.index.forward.has(source)) {
      this.index.forward.set(source, new Set())
    }
    this.index.forward.get(source)!.add(target)

    if (!this.index.backward.has(target)) {
      this.index.backward.set(target, new Set())
    }
    this.index.backward.get(target)!.add(source)

    if (context) {
      const key = `${source}->${target}`
      if (!this.index.contexts.has(key)) {
        this.index.contexts.set(key, [])
      }
      this.index.contexts.get(key)!.push(context)
    }
  }

  removeLink(source: string, target: string): void {
    this.index.forward.get(source)?.delete(target)
    this.index.backward.get(target)?.delete(source)
    this.index.contexts.delete(`${source}->${target}`)
  }

  getForwardLinks(source: string): string[] {
    return Array.from(this.index.forward.get(source) || [])
  }

  getBackwardLinks(target: string): string[] {
    return Array.from(this.index.backward.get(target) || [])
  }

  getLinkContext(source: string, target: string): LinkContext[] {
    return this.index.contexts.get(`${source}->${target}`) || []
  }

  getOrphanPages(): string[] {
    const orphans: string[] = []
    for (const [page] of this.index.forward) {
      if (!this.index.backward.has(page) && page !== 'index') {
        orphans.push(page)
      }
    }
    return orphans
  }

  getHubPages(topN: number = 10): Array<{ page: string; connections: number }> {
    const connections: Array<{ page: string; connections: number }> = []
    
    for (const [page, sources] of this.index.backward) {
      const forward = this.index.forward.get(page)?.size || 0
      connections.push({
        page,
        connections: sources.size + forward
      })
    }
    
    return connections
      .sort((a, b) => b.connections - a.connections)
      .slice(0, topN)
  }

  rebuildFromGraph(graph: KnowledgeGraph): void {
    this.index = {
      forward: new Map(),
      backward: new Map(),
      contexts: new Map()
    }

    for (const edge of graph.edges) {
      this.addLink(edge.from, edge.to)
    }
  }

  export(): { forward: Record<string, string[]>; backward: Record<string, string[]> } {
    return {
      forward: Object.fromEntries(
        Array.from(this.index.forward.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      backward: Object.fromEntries(
        Array.from(this.index.backward.entries()).map(([k, v]) => [k, Array.from(v)])
      )
    }
  }
}
```

### 2.2 自动标签生成器（核心新增）

```typescript
// src/core/auto-tagger.ts

import type { KnowledgeNode } from '../types'
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
      // === 路径规则 ===
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

      // === Import 规则 ===
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

      // === 函数名规则 ===
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

      // === 内容关键词规则 ===
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

      // === 技术栈规则 ===
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
      ['route', 'endpoint'],
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

    // 1. 路径分析
    const pathTags = this.analyzePath(filePath)
    this.mergeTags(result, pathTags, 'path')

    // 2. Import 分析
    if (metadata.imports?.length) {
      const importTags = this.analyzeImports(metadata.imports)
      this.mergeTags(result, importTags, 'import')
    }

    // 3. 函数名分析
    if (metadata.functions?.length) {
      const functionTags = this.analyzeFunctions(metadata.functions)
      this.mergeTags(result, functionTags, 'function')
    }

    // 4. 内容分析
    const contentTags = this.analyzeContent(content)
    this.mergeTags(result, contentTags, 'content')

    // 5. 技术栈分析
    if (metadata.techStack?.length) {
      const techTags = this.analyzeTechStack(metadata.techStack)
      this.mergeTags(result, techTags, 'tech-stack')
    }

    // 6. 标签规范化
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

    // 从路径提取目录名作为标签
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
    tags: Array<{ tag: string; confidence: number }>,
    source: string
  ): void {
    for (const { tag, confidence } of tags) {
      if (!result.sources.has(tag)) {
        result.sources.set(tag, [])
      }
      result.sources.get(tag)!.push(`${source}:${confidence.toFixed(2)}`)
    }
  }

  private normalizeTags(tags: string[]): string[] {
    const normalized = new Set<string>()

    for (const tag of tags) {
      const lower = tag.toLowerCase().trim()
      
      // 检查同义词
      const canonical = this.synonymMap.get(lower) || lower
      
      // 格式化：kebab-case
      const formatted = canonical.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      
      if (formatted.length > 1) {
        normalized.add(formatted)
      }
    }

    return Array.from(normalized).sort()
  }

  addRule(rule: TagRule): void {
    this.rules.push(rule)
  }

  addSynonym(from: string, to: string): void {
    this.synonymMap.set(from.toLowerCase(), to.toLowerCase())
  }

  addExclusion(pattern: RegExp): void {
    this.excludePatterns.push(pattern)
  }
}
```

### 2.3 标签索引管理器

```typescript
// src/core/tag-index.ts

import type { KnowledgeNode } from '../types'

export interface TagIndex {
  tagToPages: Map<string, Set<string>>
  pageToTags: Map<string, Set<string>>
  tagStats: Map<string, TagStats>
}

export interface TagStats {
  count: number
  types: Record<string, number>
  lastUpdated: string
}

export class TagIndexManager {
  private index: TagIndex = {
    tagToPages: new Map(),
    pageToTags: new Map(),
    tagStats: new Map()
  }

  addTag(page: string, tag: string, type?: string): void {
    if (!this.index.tagToPages.has(tag)) {
      this.index.tagToPages.set(tag, new Set())
    }
    this.index.tagToPages.get(tag)!.add(page)

    if (!this.index.pageToTags.has(page)) {
      this.index.pageToTags.set(page, new Set())
    }
    this.index.pageToTags.get(page)!.add(tag)

    if (!this.index.tagStats.has(tag)) {
      this.index.tagStats.set(tag, {
        count: 0,
        types: {},
        lastUpdated: new Date().toISOString()
      })
    }
    
    const stats = this.index.tagStats.get(tag)!
    stats.count++
    if (type) {
      stats.types[type] = (stats.types[type] || 0) + 1
    }
    stats.lastUpdated = new Date().toISOString()
  }

  removeTag(page: string, tag: string): void {
    this.index.tagToPages.get(tag)?.delete(page)
    this.index.pageToTags.get(page)?.delete(tag)
    
    const stats = this.index.tagStats.get(tag)
    if (stats) {
      stats.count--
    }
  }

  setPageTags(page: string, tags: string[], type?: string): void {
    const existingTags = this.index.pageToTags.get(page)
    if (existingTags) {
      for (const tag of existingTags) {
        this.index.tagToPages.get(tag)?.delete(page)
      }
    }
    
    this.index.pageToTags.set(page, new Set(tags))
    
    for (const tag of tags) {
      this.addTag(page, tag, type)
    }
  }

  getPagesByTag(tag: string): string[] {
    return Array.from(this.index.tagToPages.get(tag) || [])
  }

  getTagsByPage(page: string): string[] {
    return Array.from(this.index.pageToTags.get(page) || [])
  }

  getAllTags(): string[] {
    return Array.from(this.index.tagToPages.keys())
  }

  getTagStats(tag: string): TagStats | undefined {
    return this.index.tagStats.get(tag)
  }

  getPopularTags(topN: number = 20): Array<{ tag: string; count: number }> {
    return Array.from(this.index.tagStats.entries())
      .map(([tag, stats]) => ({ tag, count: stats.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN)
  }

  getRelatedTags(tag: string): Array<{ tag: string; cooccurrence: number }> {
    const pages = this.index.tagToPages.get(tag)
    if (!pages) return []

    const cooccurrence = new Map<string, number>()
    
    for (const page of pages) {
      const pageTags = this.index.pageToTags.get(page)
      if (pageTags) {
        for (const t of pageTags) {
          if (t !== tag) {
            cooccurrence.set(t, (cooccurrence.get(t) || 0) + 1)
          }
        }
      }
    }

    return Array.from(cooccurrence.entries())
      .map(([tag, count]) => ({ tag, cooccurrence: count }))
      .sort((a, b) => b.cooccurrence - a.cooccurrence)
      .slice(0, 10)
  }

  rebuildFromNodes(nodes: KnowledgeNode[]): void {
    this.index = {
      tagToPages: new Map(),
      pageToTags: new Map(),
      tagStats: new Map()
    }

    for (const node of nodes) {
      for (const tag of node.tags) {
        this.addTag(node.id, tag, node.type)
      }
    }
  }

  export(): { tagToPages: Record<string, string[]>; tagStats: Record<string, TagStats> } {
    return {
      tagToPages: Object.fromEntries(
        Array.from(this.index.tagToPages.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      tagStats: Object.fromEntries(this.index.tagStats)
    }
  }
}
```

### 2.4 集成到知识库摄入流程

```typescript
// src/core/knowledge-base.ts 修改

import { LinkIndexManager } from './link-index'
import { TagIndexManager } from './tag-index'
import { AutoTagger } from './auto-tagger'

export class KnowledgeBase {
  private linkIndex: LinkIndexManager
  private tagIndex: TagIndexManager
  private autoTagger: AutoTagger

  constructor(projectPath: string) {
    this.projectPath = projectPath
    this.basePath = path.join(projectPath, '.memory')
    this.updater = new GraphUpdater(this.basePath)
    this.orchestrator = new IngestOrchestrator(this.basePath)
    this.analyzer = new ProjectAnalyzer(projectPath, this.basePath)
    
    this.linkIndex = new LinkIndexManager()
    this.tagIndex = new TagIndexManager()
    this.autoTagger = new AutoTagger()
  }

  async ingestFile(filePath: string): Promise<IngestResult> {
    const content = await fs.readFile(filePath, 'utf-8')
    
    // 敏感信息过滤
    const filterResult = this.sensitiveFilter.filter(content, filePath)
    const filteredContent = filterResult.filtered
    
    // 提取代码元数据
    const metadata = await this.extractCodeMetadata(filePath, filteredContent)
    
    // 自动生成标签
    const tagResult = this.autoTagger.generateTags(filePath, filteredContent, metadata)
    
    // 生成知识页面
    const page = await this.generateKnowledgePage(filePath, filteredContent, {
      ...metadata,
      autoTags: tagResult.tags,
      tagSources: Object.fromEntries(tagResult.sources)
    })
    
    return {
      success: true,
      page,
      autoTags: tagResult.tags
    }
  }

  private async extractCodeMetadata(
    filePath: string,
    content: string
  ): Promise<CodeMetadata> {
    const ext = path.extname(filePath)
    const metadata: CodeMetadata = {
      imports: [],
      functions: [],
      classes: [],
      techStack: []
    }

    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      metadata.imports = this.extractImports(content)
      metadata.functions = this.extractFunctions(content)
      metadata.classes = this.extractClasses(content)
    }

    // 从 package.json 提取技术栈
    const packageJsonPath = path.join(this.projectPath, 'package.json')
    if (await this.fileExists(packageJsonPath)) {
      metadata.techStack = await this.extractTechStack(packageJsonPath)
    }

    return metadata
  }

  private extractImports(content: string): string[] {
    const imports: string[] = []
    const patterns = [
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    ]

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        imports.push(match[1])
      }
    }

    return [...new Set(imports)]
  }

  private extractFunctions(content: string): string[] {
    const functions: string[] = []
    const patterns = [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
      /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/g,
      /(?:export\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*{/g
    ]

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        functions.push(match[1])
      }
    }

    return [...new Set(functions)]
  }

  private extractClasses(content: string): string[] {
    const classes: string[] = []
    const pattern = /(?:export\s+)?class\s+(\w+)/g
    
    let match
    while ((match = pattern.exec(content)) !== null) {
      classes.push(match[1])
    }

    return [...new Set(classes)]
  }

  private async extractTechStack(packageJsonPath: string): Promise<string[]> {
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8')
      const pkg = JSON.parse(content)
      
      const deps = [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {})
      ]

      const techStackMap: Record<string, string> = {
        'react': 'React',
        'vue': 'Vue',
        'angular': 'Angular',
        'next': 'Next.js',
        'express': 'Express',
        'fastify': 'Fastify',
        'typescript': 'TypeScript',
        'tailwindcss': 'TailwindCSS',
        'prisma': 'Prisma',
        'mongoose': 'MongoDB',
        'pg': 'PostgreSQL',
        'mysql2': 'MySQL'
      }

      const techStack: string[] = []
      for (const dep of deps) {
        const tech = techStackMap[dep]
        if (tech && !techStack.includes(tech)) {
          techStack.push(tech)
        }
      }

      return techStack
    } catch {
      return []
    }
  }

  async buildGraphIndex(): Promise<void> {
    // ... 现有逻辑

    if (this.graph) {
      this.linkIndex.rebuildFromGraph(this.graph)
      this.tagIndex.rebuildFromNodes(this.graph.nodes)
    }

    await this.saveIndexes()
  }

  private async saveIndexes(): Promise<void> {
    const linkIndexPath = path.join(this.basePath, 'link-index.json')
    const tagIndexPath = path.join(this.basePath, 'tag-index.json')

    await fs.writeFile(linkIndexPath, JSON.stringify(this.linkIndex.export(), null, 2), 'utf-8')
    await fs.writeFile(tagIndexPath, JSON.stringify(this.tagIndex.export(), null, 2), 'utf-8')
  }

  // 公开方法
  getBacklinks(pageId: string): string[] {
    return this.linkIndex.getBackwardLinks(pageId)
  }

  getForwardLinks(pageId: string): string[] {
    return this.linkIndex.getForwardLinks(pageId)
  }

  getPagesByTag(tag: string): string[] {
    return this.tagIndex.getPagesByTag(tag)
  }

  getPopularTags(topN: number = 20): Array<{ tag: string; count: number }> {
    return this.tagIndex.getPopularTags(topN)
  }

  getRelatedTags(tag: string): Array<{ tag: string; cooccurrence: number }> {
    return this.tagIndex.getRelatedTags(tag)
  }

  getAllTags(): string[] {
    return this.tagIndex.getAllTags()
  }

  getOrphanPages(): string[] {
    return this.linkIndex.getOrphanPages()
  }

  getHubPages(topN: number = 10): Array<{ page: string; connections: number }> {
    return this.linkIndex.getHubPages(topN)
  }
}
```

---

## 三、新增命令

### 3.1 memory-links 命令

```typescript
"memory-links": tool({
  description: "Query link relationships for a page",
  args: {
    pageId: tool.schema.string().describe("Page ID to query links for"),
    direction: tool.schema.enum(["forward", "backward", "both"]).optional().describe("Link direction"),
  },
  async execute(args, context) {
    if (!knowledgeBase) {
      return JSON.stringify({ success: false, error: "KB not initialized" }, null, 2)
    }

    const forward = args.direction !== 'backward' ? knowledgeBase.getForwardLinks(args.pageId) : []
    const backward = args.direction !== 'forward' ? knowledgeBase.getBacklinks(args.pageId) : []

    return JSON.stringify({
      success: true,
      pageId: args.pageId,
      forwardLinks: forward,
      backwardLinks: backward,
      totalConnections: forward.length + backward.length
    }, null, 2)
  }
})
```

### 3.2 memory-tags 命令

```typescript
"memory-tags": tool({
  description: "Query and analyze tags in the knowledge base",
  args: {
    action: tool.schema.enum(["list", "pages", "popular", "related", "stats"]).describe("Action to perform"),
    tag: tool.schema.string().optional().describe("Tag name (for pages/related actions)"),
    topN: tool.schema.number().optional().describe("Number of results"),
  },
  async execute(args, context) {
    if (!knowledgeBase) {
      return JSON.stringify({ success: false, error: "KB not initialized" }, null, 2)
    }

    switch (args.action) {
      case 'list':
        return JSON.stringify({
          success: true,
          tags: knowledgeBase.getAllTags()
        }, null, 2)

      case 'pages':
        if (!args.tag) {
          return JSON.stringify({ success: false, error: "Tag required" }, null, 2)
        }
        return JSON.stringify({
          success: true,
          tag: args.tag,
          pages: knowledgeBase.getPagesByTag(args.tag)
        }, null, 2)

      case 'popular':
        return JSON.stringify({
          success: true,
          tags: knowledgeBase.getPopularTags(args.topN || 20)
        }, null, 2)

      case 'related':
        if (!args.tag) {
          return JSON.stringify({ success: false, error: "Tag required" }, null, 2)
        }
        return JSON.stringify({
          success: true,
          tag: args.tag,
          relatedTags: knowledgeBase.getRelatedTags(args.tag)
        }, null, 2)

      case 'stats':
        return JSON.stringify({
          success: true,
          totalTags: knowledgeBase.getAllTags().length,
          popularTags: knowledgeBase.getPopularTags(10)
        }, null, 2)

      default:
        return JSON.stringify({ success: false, error: "Unknown action" }, null, 2)
    }
  }
})
```

---

## 四、测试方案

### 4.1 自动标签生成测试

```typescript
// tests/auto-tagger.test.ts

import { describe, it, expect } from 'bun:test'
import { AutoTagger } from '../src/core/auto-tagger'

describe('AutoTagger', () => {
  const tagger = new AutoTagger()

  it('should generate tags from file path', () => {
    const result = tagger.generateTags(
      '/src/auth/login.ts',
      'export function login() {}',
      { imports: [], functions: ['login'], classes: [] }
    )

    expect(result.tags).toContain('authentication')
    expect(result.tags).toContain('security')
  })

  it('should generate tags from imports', () => {
    const result = tagger.generateTags(
      '/src/app.ts',
      'import express from "express"',
      { imports: ['express'], functions: [], classes: [] }
    )

    expect(result.tags).toContain('express')
    expect(result.tags).toContain('backend')
    expect(result.tags).toContain('api')
  })

  it('should generate tags from function names', () => {
    const result = tagger.generateTags(
      '/src/user.ts',
      'export function validateUser() {}',
      { imports: [], functions: ['validateUser'], classes: [] }
    )

    expect(result.tags).toContain('validation')
  })

  it('should normalize tags using synonyms', () => {
    const result = tagger.generateTags(
      '/src/auth.ts',
      'export function login() {}',
      { imports: [], functions: ['login'], classes: [] }
    )

    expect(result.tags).toContain('authentication')
    expect(result.tags).not.toContain('login')
  })

  it('should track tag sources', () => {
    const result = tagger.generateTags(
      '/src/api/users.ts',
      'import express from "express"',
      { imports: ['express'], functions: [], classes: [] }
    )

    expect(result.sources.has('api')).toBe(true)
    expect(result.sources.has('express')).toBe(true)
  })
})
```

### 4.2 标签索引测试

```typescript
// tests/tag-index.test.ts

import { describe, it, expect, beforeEach } from 'bun:test'
import { TagIndexManager } from '../src/core/tag-index'

describe('TagIndexManager', () => {
  let manager: TagIndexManager

  beforeEach(() => {
    manager = new TagIndexManager()
  })

  it('should add and retrieve tags', () => {
    manager.addTag('page-1', 'authentication', 'entity')
    manager.addTag('page-1', 'security', 'entity')
    
    const tags = manager.getTagsByPage('page-1')
    expect(tags).toContain('authentication')
    expect(tags).toContain('security')
  })

  it('should retrieve pages by tag', () => {
    manager.addTag('page-2', 'api', 'entity')
    manager.addTag('page-3', 'api', 'entity')
    
    const pages = manager.getPagesByTag('api')
    expect(pages).toContain('page-2')
    expect(pages).toContain('page-3')
  })

  it('should compute popular tags', () => {
    manager.addTag('p1', 'popular-tag', 'entity')
    manager.addTag('p2', 'popular-tag', 'entity')
    manager.addTag('p3', 'popular-tag', 'entity')
    
    const popular = manager.getPopularTags(10)
    expect(popular.find(t => t.tag === 'popular-tag')?.count).toBe(3)
  })

  it('should find related tags', () => {
    manager.addTag('page-1', 'authentication', 'entity')
    manager.addTag('page-1', 'security', 'entity')
    manager.addTag('page-2', 'authentication', 'entity')
    manager.addTag('page-2', 'jwt', 'entity')
    
    const related = manager.getRelatedTags('authentication')
    expect(related.some(r => r.tag === 'security')).toBe(true)
    expect(related.some(r => r.tag === 'jwt')).toBe(true)
  })

  it('should set page tags', () => {
    manager.setPageTags('page-1', ['tag1', 'tag2'], 'entity')
    
    const tags = manager.getTagsByPage('page-1')
    expect(tags).toEqual(['tag1', 'tag2'])
    
    manager.setPageTags('page-1', ['tag3'], 'entity')
    
    const newTags = manager.getTagsByPage('page-1')
    expect(newTags).toEqual(['tag3'])
  })
})
```

---

## 五、验收标准

### 5.1 功能验收

- [ ] 正确提取所有类型的 Wiki 链接
- [ ] 自动维护反向链接索引
- [ ] 检测并报告断裂链接
- [ ] **摄入文件时自动生成标签**
- [ ] 标签来源可追溯
- [ ] 标签同义词自动合并
- [ ] 支持标签索引和聚合
- [ ] 支持相关标签查询

### 5.2 性能验收

- [ ] 链接索引构建 < 1 秒（1000 页面）
- [ ] 标签索引构建 < 500ms（1000 页面）
- [ ] 自动标签生成 < 50ms（单个文件）
- [ ] 反向链接查询 < 10ms

### 5.3 质量验收

- [ ] 自动标签准确率 > 80%
- [ ] 标签覆盖率 > 90%（所有页面都有标签）
- [ ] 无重复标签

---

## 六、实施计划

| 任务 | 预计时间 |
|------|---------|
| 实现 LinkIndexManager | 2h |
| 实现 AutoTagger | 4h |
| 实现 TagIndexManager | 2h |
| 集成到 KnowledgeBase 摄入流程 | 3h |
| 新增命令 | 2h |
| 单元测试 | 3h |
| 集成测试 | 2h |

**总计: 18h (约 3 天)**

---

## 七、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 自动标签不准确 | 中 | 提供置信度分数，支持手动修正 |
| 标签过多 | 低 | 限制标签数量，优先高置信度标签 |
| 同义词遗漏 | 低 | 支持用户自定义同义词 |
| 性能影响 | 低 | 异步处理，缓存结果 |

---

**设计完成 (v1.1)。已根据评审结果增加自动标签生成功能。**
