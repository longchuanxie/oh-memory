# P1 重要需求设计文档

> **文档版本**: v1.0  
> **创建日期**: 2026-04-19  
> **优先级**: P1 - 重要  
> **目标版本**: V1.1 ~ V1.3  

---

## 一、概述

P1 需求是增强用户体验的重要功能，共 11 项。这些功能提升知识管理的灵活性、可靠性和易用性，可根据实际情况分阶段实施。

### 核心目标

1. **提升知识组织灵活性** - 知识分层、项目模板
2. **增强检索智能性** - 语义搜索、历史记忆
3. **支持用户定制化** - 手动注入、知识导出
4. **保障系统可靠性** - 损坏恢复、自动备份、离线使用

---

## 二、知识组织类需求

### REQ-017: 知识分层

#### 2.1.1 需求描述

将知识按重要性和使用频率分层，实现差异化的加载策略和存储管理。

#### 2.1.2 分层定义

| 层级 | 名称 | 描述 | 加载策略 | 存储位置 |
|------|------|------|---------|---------|
| L1 | 核心知识 | 架构决策、关键 API、核心数据流 | 始终加载到内存 | `.memory/core/` |
| L2 | 辅助知识 | 工具函数、次要模块、配置细节 | 按需加载 | `.memory/auxiliary/` |
| L3 | 历史知识 | 废弃的 API、历史决策、迁移记录 | 归档存储 | `.memory/archive/` |
| L4 | 临时知识 | 调试信息、临时方案、待办事项 | 定期清理 | `.memory/temp/` |

#### 2.1.3 用户场景

**场景 1: 大型项目的智能加载**
```
项目有 500 个知识页面，但用户日常只关心 50 个核心模块。
系统自动将核心知识加载到内存，辅助知识按需加载，
历史知识归档，临时知识定期清理。
```

#### 2.1.4 技术实现

**分层标记**:
```yaml
---
title: Auth Module
type: entity
layer: core  # core | auxiliary | archive | temp
priority: critical
lastAccessed: 2026-04-19
accessCount: 150
---
```

**分层管理器**:
```typescript
interface LayerManager {
  classify(page: KnowledgePage): Layer
  promote(pagePath: string): void
  demote(pagePath: string): void
  getLayerPages(layer: Layer): string[]
  cleanup(): Promise<void>
}

class DefaultLayerManager implements LayerManager {
  classify(page: KnowledgePage): Layer {
    // 规则 1: 手动标记
    if (page.frontmatter.layer) {
      return page.frontmatter.layer
    }
    
    // 规则 2: 优先级标记
    if (page.frontmatter.priority === 'critical') {
      return 'core'
    }
    
    // 规则 3: 访问频率
    if (page.frontmatter.accessCount > 100) {
      return 'core'
    }
    
    // 规则 4: 时间衰减
    const daysSinceAccess = this.daysSince(page.frontmatter.lastAccessed)
    if (daysSinceAccess > 180) {
      return 'archive'
    }
    
    return 'auxiliary'
  }
  
  async cleanup(): Promise<void> {
    // 清理超过 30 天的临时知识
    const tempPages = this.getLayerPages('temp')
    for (const page of tempPages) {
      const lastAccess = await this.getLastAccess(page)
      if (this.daysSince(lastAccess) > 30) {
        await this.deletePage(page)
      }
    }
  }
}
```

#### 2.1.5 验收标准

- [ ] 支持手动标记知识层级
- [ ] 自动根据访问频率调整层级
- [ ] 核心知识始终加载到内存
- [ ] 临时知识自动清理

---

### REQ-018: 配置知识库

#### 2.2.1 需求描述

存储项目的配置文件解读、编码规范、最佳实践等非代码类知识。

#### 2.2.2 配置知识类型

| 类型 | 示例 | 存储位置 |
|------|------|---------|
| 项目配置 | tsconfig.json 解读、环境变量说明 | `.memory/config/` |
| 编码规范 | ESLint 规则、命名约定 | `.memory/conventions/` |
| 最佳实践 | 性能优化建议、安全指南 | `.memory/best-practices/` |
| 工具配置 | CI/CD 流程、部署配置 | `.memory/tools/` |

#### 2.2.3 用户场景

**场景 1: 新成员了解项目规范**
```
新成员加入项目，想了解项目的编码规范和配置。
查询配置知识库，快速了解 ESLint 规则、命名约定等。
```

#### 2.2.4 技术实现

**配置知识摄入**:
```typescript
interface ConfigKnowledgeExtractor {
  extract(configPath: string): Promise<ConfigKnowledge[]>
}

class TypeScriptConfigExtractor implements ConfigKnowledgeExtractor {
  async extract(configPath: string): Promise<ConfigKnowledge[]> {
    const content = await fs.readFile(configPath, 'utf-8')
    const config = JSON.parse(content)
    
    const knowledge: ConfigKnowledge[] = []
    
    // 解析 compilerOptions
    if (config.compilerOptions) {
      knowledge.push({
        title: 'TypeScript 编译选项',
        type: 'config',
        sourceFile: configPath,
        content: this.explainCompilerOptions(config.compilerOptions),
        tags: ['typescript', 'config', 'compiler']
      })
    }
    
    return knowledge
  }
  
  private explainCompilerOptions(options: any): string {
    const explanations: string[] = []
    
    if (options.strict) {
      explanations.push('**strict**: 启用所有严格类型检查选项')
    }
    
    if (options.target) {
      explanations.push(`**target**: 编译目标为 ${options.target}`)
    }
    
    return explanations.join('\n\n')
  }
}
```

#### 2.2.5 验收标准

- [ ] 支持常见配置文件的自动解读
- [ ] 配置变更时自动更新知识
- [ ] 支持手动添加编码规范

---

## 三、检索增强类需求

### REQ-019: 语义搜索

#### 3.1.1 需求描述

基于内容相似度进行智能匹配，而不仅仅是关键词匹配，提升查询召回率。

#### 3.1.2 用户场景

**场景 1: 同义词查询**
```
用户查询 "登录功能"，系统也能返回包含 "认证"、"鉴权"、"authentication" 的知识页面。
```

**场景 2: 概念关联查询**
```
用户查询 "数据存储"，系统返回包含 "数据库"、"持久化"、"ORM" 的相关知识。
```

#### 3.1.3 技术实现

**语义向量索引**:
```typescript
interface SemanticIndex {
  buildIndex(pages: KnowledgePage[]): Promise<void>
  search(query: string, topK: number): Promise<SearchResult[]>
}

class EmbeddingBasedSemanticIndex implements SemanticIndex {
  private embeddings: Map<string, number[]> = new Map()
  
  async buildIndex(pages: KnowledgePage[]): Promise<void> {
    for (const page of pages) {
      const text = this.extractSearchableText(page)
      const embedding = await this.getEmbedding(text)
      this.embeddings.set(page.path, embedding)
    }
  }
  
  async search(query: string, topK: number): Promise<SearchResult[]> {
    const queryEmbedding = await this.getEmbedding(query)
    
    const scores: Array<{ path: string; score: number }> = []
    
    for (const [path, embedding] of this.embeddings) {
      const similarity = this.cosineSimilarity(queryEmbedding, embedding)
      scores.push({ path, score: similarity })
    }
    
    scores.sort((a, b) => b.score - a.score)
    
    return scores.slice(0, topK).map(s => ({
      path: s.path,
      score: s.score,
      type: 'semantic'
    }))
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}
```

**同义词扩展**:
```typescript
interface SynonymExpander {
  expand(term: string): string[]
}

class BuiltInSynonymExpander implements SynonymExpander {
  private synonyms: Map<string, string[]> = new Map([
    ['登录', ['认证', '鉴权', 'authentication', 'login', 'signin']],
    ['数据库', ['database', 'db', '存储', 'storage', '持久化']],
    ['配置', ['config', 'configuration', '设置', 'settings']]
  ])
  
  expand(term: string): string[] {
    const lower = term.toLowerCase()
    const expanded = [term]
    
    for (const [key, values] of this.synonyms) {
      if (key.toLowerCase() === lower || values.some(v => v.toLowerCase() === lower)) {
        expanded.push(key, ...values.filter(v => v.toLowerCase() !== lower))
      }
    }
    
    return [...new Set(expanded)]
  }
}
```

#### 3.1.4 验收标准

- [ ] 同义词查询召回率 > 80%
- [ ] 语义搜索响应时间 < 500ms
- [ ] 支持中英文混合查询

---

### REQ-020: 历史查询记忆

#### 3.2.1 需求描述

记住用户的查询历史，提供上下文相关的连续查询体验。

#### 3.2.2 用户场景

**场景 1: 连续查询优化**
```
用户第一次查询: "如何实现用户认证"
用户第二次查询: "如何处理 token"（系统理解这是关于认证 token）
用户第三次查询: "如何刷新"（系统理解这是关于 token 刷新）
```

#### 3.2.3 技术实现

**查询历史管理**:
```typescript
interface QueryHistory {
  records: QueryRecord[]
  maxRecords: number
  
  add(query: string, results: QueryResult[]): void
  getRecent(count: number): QueryRecord[]
  getContext(): string
}

class SessionQueryHistory implements QueryHistory {
  records: QueryRecord[] = []
  maxRecords = 20
  
  add(query: string, results: QueryResult[]): void {
    this.records.unshift({
      query,
      results: results.slice(0, 5).map(r => r.path),
      timestamp: Date.now()
    })
    
    if (this.records.length > this.maxRecords) {
      this.records.pop()
    }
  }
  
  getContext(): string {
    // 提取最近查询的关键词
    const keywords = new Set<string>()
    
    for (const record of this.records.slice(0, 5)) {
      const tokens = this.tokenize(record.query)
      tokens.forEach(t => keywords.add(t))
    }
    
    return Array.from(keywords).join(' ')
  }
  
  private tokenize(query: string): string[] {
    return query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
  }
}
```

**上下文增强查询**:
```typescript
async queryWithContext(query: string): Promise<QueryResult[]> {
  // 获取历史上下文
  const context = this.history.getContext()
  
  // 组合查询
  const enhancedQuery = context ? `${query} (context: ${context})` : query
  
  // 执行查询
  return this.baseQuery(enhancedQuery)
}
```

#### 3.2.4 验收标准

- [ ] 记录最近 20 条查询历史
- [ ] 连续查询时自动关联上下文
- [ ] 支持清除查询历史

---

## 四、用户定制类需求

### REQ-021: 手动知识注入

#### 4.1.1 需求描述

支持通过命令手动添加决策、笔记、标注等知识，补充自动摄入无法覆盖的内容。

#### 4.1.2 命令设计

```
/memory-add --type <type> --title <title> --content <content> [options]

类型:
  decision  - 架构决策记录
  note      - 笔记
  warning   - 警告/注意事项
  example   - 代码示例
  link      - 外部链接

选项:
  --tags <tags>       标签（逗号分隔）
  --related <pages>   关联页面（逗号分隔）
  --layer <layer>     知识层级
```

#### 4.1.3 用户场景

**场景 1: 记录架构决策**
```
/memory-add --type decision --title "使用 PostgreSQL 而不是 MySQL" \
  --content "选择 PostgreSQL 因为需要 JSON 查询能力，MySQL 的 JSON 支持较弱" \
  --tags "database,architecture,decision"
```

**场景 2: 添加警告标注**
```
/memory-add --type warning --title "认证模块修改注意事项" \
  --content "修改认证逻辑时，需要同步更新 [[session-management]] 和 [[token-refresh]]" \
  --related "auth-module,session-management"
```

#### 4.1.4 技术实现

**命令处理器**:
```typescript
interface AddCommandHandler {
  execute(args: AddCommandArgs): Promise<KnowledgePage>
}

interface AddCommandArgs {
  type: 'decision' | 'note' | 'warning' | 'example' | 'link'
  title: string
  content: string
  tags?: string[]
  related?: string[]
  layer?: Layer
}

class MemoryAddHandler implements AddCommandHandler {
  async execute(args: AddCommandArgs): Promise<KnowledgePage> {
    // 确定存储路径
    const category = this.getCategory(args.type)
    const fileName = this.sanitizeFileName(args.title)
    const filePath = path.join(this.memoryPath, category, `${fileName}.md`)
    
    // 生成 frontmatter
    const frontmatter = {
      title: args.title,
      type: args.type,
      tags: args.tags || [],
      related: args.related || [],
      layer: args.layer || 'auxiliary',
      created: new Date().toISOString(),
      manual: true
    }
    
    // 写入文件
    const content = `---
${yaml.stringify(frontmatter)}
---

${args.content}
`
    
    await fs.writeFile(filePath, content, 'utf-8')
    
    // 更新索引
    await this.indexer.addToIndex(filePath)
    
    return { path: filePath, frontmatter, content: args.content }
  }
  
  private getCategory(type: string): string {
    const mapping: Record<string, string> = {
      decision: 'synthesis',
      note: 'concepts',
      warning: 'concepts',
      example: 'entities',
      link: 'sources'
    }
    return mapping[type] || 'concepts'
  }
}
```

#### 4.1.5 验收标准

- [ ] 支持所有类型的知识注入
- [ ] 自动更新索引
- [ ] 支持关联已有知识

---

### REQ-022: 项目类型模板

#### 4.2.1 需求描述

根据项目类型（前端/后端/全栈/库）自动适配知识结构和分类。

#### 4.2.2 预设模板

**前端项目模板**:
```yaml
projectType: frontend
categories:
  entities:
    - components
    - pages
    - hooks
    - utils
    - styles
  concepts:
    - architecture
    - state-management
    - routing
    - performance
  sources:
    - documentation
    - api-docs
```

**后端项目模板**:
```yaml
projectType: backend
categories:
  entities:
    - api
    - models
    - services
    - middleware
    - utils
  concepts:
    - architecture
    - database
    - authentication
    - caching
  sources:
    - documentation
    - api-specs
```

**库/SDK 模板**:
```yaml
projectType: library
categories:
  entities:
    - api
    - types
    - utils
  concepts:
    - design-principles
    - compatibility
    - migration
  sources:
    - documentation
    - examples
    - changelog
```

#### 4.2.3 技术实现

**模板管理器**:
```typescript
interface ProjectTemplateManager {
  detectProjectType(rootPath: string): Promise<ProjectType>
  applyTemplate(template: ProjectTemplate): Promise<void>
}

class DefaultTemplateManager implements ProjectTemplateManager {
  async detectProjectType(rootPath: string): Promise<ProjectType> {
    // 检查 package.json
    const packageJson = await this.readPackageJson(rootPath)
    
    // 前端项目特征
    if (this.hasFrontendDeps(packageJson)) {
      return 'frontend'
    }
    
    // 后端项目特征
    if (this.hasBackendDeps(packageJson)) {
      return 'backend'
    }
    
    // 库项目特征
    if (packageJson.main && !packageJson.scripts?.start) {
      return 'library'
    }
    
    return 'fullstack'
  }
  
  async applyTemplate(template: ProjectTemplate): Promise<void> {
    // 创建目录结构
    for (const [category, subcategories] of Object.entries(template.categories)) {
      for (const sub of subcategories) {
        const dir = path.join(this.memoryPath, category, sub)
        await fs.mkdir(dir, { recursive: true })
      }
    }
    
    // 创建模板配置文件
    const templatePath = path.join(this.memoryPath, 'template.yaml')
    await fs.writeFile(templatePath, yaml.stringify(template))
  }
}
```

#### 4.2.4 验收标准

- [ ] 自动检测项目类型
- [ ] 正确应用对应模板
- [ ] 支持自定义模板

---

### REQ-023: 知识质量评分

#### 4.3.1 需求描述

自动评估知识的新鲜度、完整性、准确性，帮助用户识别需要更新的知识。

#### 4.3.2 评分维度

| 维度 | 权重 | 计算方式 |
|------|------|---------|
| 新鲜度 | 30% | 距上次更新的天数，越近越高 |
| 完整性 | 40% | 必要字段是否存在、内容长度 |
| 准确性 | 20% | 与源文件的一致性 |
| 引用度 | 10% | 被其他页面引用的次数 |

#### 4.3.3 技术实现

**质量评估器**:
```typescript
interface QualityAssessor {
  assess(page: KnowledgePage): QualityScore
}

interface QualityScore {
  overall: number  // 0-100
  dimensions: {
    freshness: number
    completeness: number
    accuracy: number
    references: number
  }
  issues: QualityIssue[]
}

class DefaultQualityAssessor implements QualityAssessor {
  assess(page: KnowledgePage): QualityScore {
    const freshness = this.assessFreshness(page)
    const completeness = this.assessCompleteness(page)
    const accuracy = this.assessAccuracy(page)
    const references = this.assessReferences(page)
    
    const overall = 
      freshness * 0.3 + 
      completeness * 0.4 + 
      accuracy * 0.2 + 
      references * 0.1
    
    return {
      overall,
      dimensions: { freshness, completeness, accuracy, references },
      issues: this.collectIssues(page)
    }
  }
  
  private assessFreshness(page: KnowledgePage): number {
    const lastUpdated = new Date(page.frontmatter.lastUpdated || page.frontmatter.created)
    const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
    
    if (daysSinceUpdate < 7) return 100
    if (daysSinceUpdate < 30) return 80
    if (daysSinceUpdate < 90) return 60
    if (daysSinceUpdate < 180) return 40
    return 20
  }
  
  private assessCompleteness(page: KnowledgePage): number {
    let score = 0
    
    // 必要字段检查
    if (page.frontmatter.title) score += 20
    if (page.frontmatter.type) score += 20
    if (page.frontmatter.tags?.length > 0) score += 20
    
    // 内容长度检查
    if (page.content.length > 100) score += 20
    if (page.content.length > 500) score += 20
    
    return score
  }
  
  private assessAccuracy(page: KnowledgePage): number {
    // 检查源文件是否存在
    if (page.frontmatter.sourceFile) {
      const exists = fs.existsSync(page.frontmatter.sourceFile)
      return exists ? 100 : 0
    }
    return 100  // 手动添加的知识默认准确
  }
  
  private assessReferences(page: KnowledgePage): number {
    const backlinks = this.getBacklinks(page.path)
    return Math.min(100, backlinks.length * 20)
  }
}
```

#### 4.3.4 验收标准

- [ ] 自动计算质量分数
- [ ] 识别质量问题
- [ ] 支持质量报告生成

---

### REQ-024: 知识导出

#### 4.4.1 需求描述

支持将知识库导出为 Markdown、PDF、JSON、HTML 等格式，便于分享和归档。

#### 4.4.2 导出格式

| 格式 | 用途 | 特点 |
|------|------|------|
| Markdown | 文档网站 | 保持原始格式，支持 Hugo/Jekyll |
| PDF | 离线阅读 | 格式固定，便于打印 |
| JSON | 工具集成 | 结构化数据，便于程序处理 |
| HTML | 可视化展示 | 自包含，可直接浏览 |

#### 4.4.3 命令设计

```
/memory-export --format <format> --output <path> [options]

格式:
  markdown  - Markdown 格式
  pdf       - PDF 文档
  json      - JSON 数据
  html      - HTML 页面

选项:
  --category <category>  只导出指定分类
  --tag <tag>            只导出指定标签
  --include-index        包含索引页面
  --include-graph        包含知识图谱
```

#### 4.4.4 技术实现

**导出器接口**:
```typescript
interface KnowledgeExporter {
  export(pages: KnowledgePage[], options: ExportOptions): Promise<void>
}

interface ExportOptions {
  format: 'markdown' | 'pdf' | 'json' | 'html'
  outputPath: string
  category?: string
  tag?: string
  includeIndex?: boolean
  includeGraph?: boolean
}

class MarkdownExporter implements KnowledgeExporter {
  async export(pages: KnowledgePage[], options: ExportOptions): Promise<void> {
    const outputDir = options.outputPath
    
    // 创建目录
    await fs.mkdir(outputDir, { recursive: true })
    
    // 导出每个页面
    for (const page of pages) {
      const relativePath = page.path.replace(this.memoryPath, '')
      const outputPath = path.join(outputDir, relativePath)
      
      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      await fs.writeFile(outputPath, page.raw)
    }
    
    // 导出索引
    if (options.includeIndex) {
      const indexContent = this.generateIndex(pages)
      await fs.writeFile(path.join(outputDir, 'INDEX.md'), indexContent)
    }
    
    // 导出图谱
    if (options.includeGraph) {
      const graphContent = await this.generateGraph(pages)
      await fs.writeFile(path.join(outputDir, 'graph.json'), graphContent)
    }
  }
}

class JsonExporter implements KnowledgeExporter {
  async export(pages: KnowledgePage[], options: ExportOptions): Promise<void> {
    const data = {
      exportedAt: new Date().toISOString(),
      pages: pages.map(p => ({
        path: p.path,
        frontmatter: p.frontmatter,
        content: p.content,
        links: extractWikiLinks(p.content)
      }))
    }
    
    await fs.writeFile(options.outputPath, JSON.stringify(data, null, 2))
  }
}
```

#### 4.4.5 验收标准

- [ ] 支持所有导出格式
- [ ] 导出内容完整
- [ ] 支持筛选导出

---

## 五、可靠性保障类需求

### REQ-025: 损坏恢复

#### 5.1.1 需求描述

自动检测并修复损坏的知识文件，保证知识库的完整性。

#### 5.1.2 损坏类型

| 类型 | 描述 | 检测方式 | 修复方式 |
|------|------|---------|---------|
| 格式错误 | YAML frontmatter 格式不正确 | 解析失败 | 自动修复或提示 |
| 链接断裂 | Wiki 链接指向不存在的页面 | 索引检查 | 删除或标记 |
| 内容缺失 | 必要字段为空 | Schema 验证 | 补充默认值 |
| 编码错误 | 文件编码不正确 | 读取失败 | 转换编码 |

#### 5.1.3 技术实现

**健康检查器**:
```typescript
interface HealthChecker {
  check(): Promise<HealthReport>
  repair(issues: HealthIssue[]): Promise<RepairResult[]>
}

interface HealthReport {
  total: number
  healthy: number
  issues: HealthIssue[]
}

interface HealthIssue {
  path: string
  type: 'format' | 'link' | 'content' | 'encoding'
  severity: 'error' | 'warning'
  message: string
  autoFixable: boolean
}

class DefaultHealthChecker implements HealthChecker {
  async check(): Promise<HealthReport> {
    const pages = await this.getAllPages()
    const issues: HealthIssue[] = []
    
    for (const page of pages) {
      // 检查格式
      const formatIssues = await this.checkFormat(page)
      issues.push(...formatIssues)
      
      // 检查链接
      const linkIssues = await this.checkLinks(page)
      issues.push(...linkIssues)
      
      // 检查内容
      const contentIssues = await this.checkContent(page)
      issues.push(...contentIssues)
    }
    
    return {
      total: pages.length,
      healthy: pages.length - new Set(issues.map(i => i.path)).size,
      issues
    }
  }
  
  async repair(issues: HealthIssue[]): Promise<RepairResult[]> {
    const results: RepairResult[] = []
    
    for (const issue of issues) {
      if (!issue.autoFixable) {
        results.push({ issue, success: false, message: 'Cannot auto-repair' })
        continue
      }
      
      try {
        await this.repairIssue(issue)
        results.push({ issue, success: true })
      } catch (error) {
        results.push({ issue, success: false, message: error.message })
      }
    }
    
    return results
  }
}
```

#### 5.1.4 验收标准

- [ ] 检测所有类型的损坏
- [ ] 自动修复可修复的问题
- [ ] 生成健康报告

---

### REQ-026: 自动备份

#### 5.2.1 需求描述

定期自动备份知识库，支持恢复到历史版本。

#### 5.2.2 备份策略

| 策略 | 频率 | 保留数量 |
|------|------|---------|
| 每日备份 | 每天凌晨 2 点 | 7 个 |
| 每周备份 | 每周日凌晨 3 点 | 4 个 |
| 手动备份 | 用户触发 | 无限制 |

#### 5.2.3 技术实现

**备份管理器**:
```typescript
interface BackupManager {
  createBackup(type: 'daily' | 'weekly' | 'manual'): Promise<string>
  listBackups(): Promise<BackupInfo[]>
  restore(backupId: string): Promise<void>
  cleanup(): Promise<void>
}

interface BackupInfo {
  id: string
  type: 'daily' | 'weekly' | 'manual'
  createdAt: Date
  size: number
  path: string
}

class DefaultBackupManager implements BackupManager {
  private backupDir = '.memory/backups'
  
  async createBackup(type: 'daily' | 'weekly' | 'manual'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupId = `${type}-${timestamp}`
    const backupPath = path.join(this.backupDir, backupId)
    
    // 复制整个知识库
    await fs.mkdir(backupPath, { recursive: true })
    await this.copyDirectory(this.memoryPath, backupPath)
    
    // 记录备份信息
    const info: BackupInfo = {
      id: backupId,
      type,
      createdAt: new Date(),
      size: await this.getDirectorySize(backupPath),
      path: backupPath
    }
    
    await fs.writeFile(
      path.join(backupPath, 'backup-info.json'),
      JSON.stringify(info, null, 2)
    )
    
    // 清理旧备份
    await this.cleanup()
    
    return backupId
  }
  
  async restore(backupId: string): Promise<void> {
    const backupPath = path.join(this.backupDir, backupId)
    
    if (!await fs.exists(backupPath)) {
      throw new Error(`Backup not found: ${backupId}`)
    }
    
    // 备份当前状态
    await this.createBackup('manual')
    
    // 清空当前知识库
    await this.clearDirectory(this.memoryPath)
    
    // 恢复备份
    await this.copyDirectory(backupPath, this.memoryPath)
  }
  
  async cleanup(): Promise<void> {
    const backups = await this.listBackups()
    
    // 按类型分组
    const daily = backups.filter(b => b.type === 'daily').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    const weekly = backups.filter(b => b.type === 'weekly').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    
    // 删除超出保留数量的备份
    for (const backup of daily.slice(7)) {
      await fs.rm(backup.path, { recursive: true })
    }
    
    for (const backup of weekly.slice(4)) {
      await fs.rm(backup.path, { recursive: true })
    }
  }
}
```

#### 5.2.4 验收标准

- [ ] 按计划自动创建备份
- [ ] 支持恢复到指定备份
- [ ] 自动清理旧备份

---

### REQ-027: 离线使用

#### 5.3.1 需求描述

无网络时仍可正常查询和编辑知识，所有数据存储在本地。

#### 5.3.2 离线能力

| 功能 | 离线状态 | 在线状态 |
|------|---------|---------|
| 知识查询 | ✅ 完全可用 | ✅ 完全可用 |
| 知识摄入 | ✅ 完全可用 | ✅ 完全可用 |
| 知识编辑 | ✅ 完全可用 | ✅ 完全可用 |
| LLM 增强 | ❌ 不可用 | ✅ 可用 |
| 同步 | ❌ 不可用 | ✅ 可用 |

#### 5.3.3 技术实现

**离线检测**:
```typescript
interface OfflineDetector {
  isOnline(): boolean
  onStatusChange(callback: (online: boolean) => void): void
}

class DefaultOfflineDetector implements OfflineDetector {
  private online = navigator.onLine
  
  isOnline(): boolean {
    return this.online
  }
  
  onStatusChange(callback: (online: boolean) => void): void {
    window.addEventListener('online', () => {
      this.online = true
      callback(true)
    })
    
    window.addEventListener('offline', () => {
      this.online = false
      callback(false)
    })
  }
}
```

**功能降级**:
```typescript
class OfflineAwareQueryEngine {
  async query(query: string): Promise<QueryResult[]> {
    // 本地查询始终可用
    const localResults = await this.localQuery(query)
    
    // 在线时尝试 LLM 增强
    if (this.offlineDetector.isOnline()) {
      try {
        const enhancedResults = await this.llmEnhancedQuery(query, localResults)
        return enhancedResults
      } catch (error) {
        console.warn('LLM enhancement failed, falling back to local results')
      }
    }
    
    return localResults
  }
}
```

#### 5.3.4 验收标准

- [ ] 离线时查询功能正常
- [ ] 离线时编辑功能正常
- [ ] 网络恢复后自动同步

---

## 六、实施计划

### V1.1 版本

| 需求 | 预计工时 |
|------|---------|
| REQ-017 知识分层 | 2 天 |
| REQ-018 配置知识库 | 2 天 |
| REQ-025 损坏恢复 | 2 天 |
| REQ-026 自动备份 | 1 天 |
| REQ-027 离线使用 | 1 天 |

### V1.2 版本

| 需求 | 预计工时 |
|------|---------|
| REQ-019 语义搜索 | 3 天 |
| REQ-020 历史查询记忆 | 1 天 |
| REQ-021 手动知识注入 | 2 天 |

### V1.3 版本

| 需求 | 预计工时 |
|------|---------|
| REQ-022 项目类型模板 | 2 天 |
| REQ-023 知识质量评分 | 2 天 |
| REQ-024 知识导出 | 2 天 |

---

## 七、验收清单

### 功能验收

- [ ] 所有 11 项需求功能完整实现
- [ ] 单元测试覆盖率 > 80%

### 性能验收

- [ ] 语义搜索响应 < 500ms
- [ ] 备份创建时间 < 30 秒

### 可靠性验收

- [ ] 损坏检测准确率 100%
- [ ] 备份恢复成功率 100%

---

**文档结束**
