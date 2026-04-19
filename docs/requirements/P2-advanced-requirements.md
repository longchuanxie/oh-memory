# P2 中期规划需求设计文档

> **文档版本**: v1.0  
> **创建日期**: 2026-04-19  
> **优先级**: P2 - 中期规划  
> **目标版本**: V2.0  

---

## 一、概述

P2 需求是高级特性功能，共 6 项。这些功能进一步提升用户体验，但可以在核心功能稳定后逐步实施。

### 核心目标

1. **增强编辑器集成** - 悬浮文档、内联提示、命令补全
2. **提升性能体验** - 后台预处理、预加载
3. **扩展项目支持** - 多语言项目、Monorepo

---

## 二、编辑器集成类需求

### REQ-028: 悬浮文档

#### 2.1.1 需求描述

鼠标悬停在代码上时，自动显示相关的 memory 知识卡片，无需手动查询。

#### 2.1.2 用户场景

**场景 1: 函数文档悬浮**
```typescript
// 用户鼠标悬停在 useAuth 上
const { user, login, logout } = useAuth()

// 显示悬浮卡片:
// ┌─────────────────────────────────────┐
// │ useAuth Hook                        │
// │ ─────────────────                   │
// │ 认证状态管理 Hook，提供用户信息和    │
// │ 登录/登出方法。                      │
// │                                     │
// │ 📖 查看完整文档                      │
// │ 🔗 [[auth-module]]                  │
// └─────────────────────────────────────┘
```

#### 2.1.3 功能规格

| 触发条件 | 显示内容 | 延迟 |
|---------|---------|------|
| 悬停在函数名 | 函数签名 + 简介 + 文档链接 | 300ms |
| 悬停在组件名 | 组件描述 + Props 说明 | 300ms |
| 悬停在类型名 | 类型定义 + 使用示例 | 300ms |
| 悬停在变量名 | 变量说明 + 来源 | 500ms |

#### 2.1.4 技术实现

**悬浮提供器**:
```typescript
interface HoverProvider {
  provideHover(document: TextDocument, position: Position): Promise<Hover | null>
}

interface Hover {
  contents: MarkedString | MarkedString[]
  range?: Range
  actions?: HoverAction[]
}

interface HoverAction {
  label: string
  command: string
  args?: any[]
}

class MemoryHoverProvider implements HoverProvider {
  async provideHover(document: TextDocument, position: Position): Promise<Hover | null> {
    // 获取当前位置的符号
    const symbol = await this.getSymbolAtPosition(document, position)
    if (!symbol) return null
    
    // 查找相关知识
    const knowledge = await this.findKnowledge(symbol)
    if (!knowledge) return null
    
    // 构建悬浮内容
    return {
      contents: [
        `**${knowledge.title}**`,
        knowledge.summary,
        `---`,
        `[📖 查看完整文档](memory://${knowledge.path})`
      ],
      range: symbol.range,
      actions: [
        { label: '打开知识页面', command: 'memory.open', args: [knowledge.path] },
        { label: '查看源代码', command: 'memory.goToSource', args: [knowledge.sourceFile] }
      ]
    }
  }
  
  private async findKnowledge(symbol: Symbol): Promise<KnowledgePage | null> {
    // 1. 精确匹配
    const exact = await this.kb.query(`"${symbol.name}"`)
    if (exact.length > 0 && exact[0].score > 0.9) {
      return exact[0]
    }
    
    // 2. 模糊匹配
    const fuzzy = await this.kb.query(symbol.name)
    if (fuzzy.length > 0) {
      return fuzzy[0]
    }
    
    return null
  }
}
```

**Markdown 渲染**:
```typescript
function renderHoverContent(knowledge: KnowledgePage): MarkdownString {
  const md = new MarkdownString()
  
  md.appendMarkdown(`## ${knowledge.title}\n\n`)
  md.appendMarkdown(knowledge.summary + '\n\n')
  
  if (knowledge.frontmatter.tags?.length) {
    md.appendMarkdown('**标签**: ')
    md.appendMarkdown(knowledge.frontmatter.tags.map(t => `\`${t}\``).join(' '))
    md.appendMarkdown('\n\n')
  }
  
  md.appendMarkdown('---\n\n')
  md.appendMarkdown(`[📖 查看完整文档](command:memory.open?${encodeURIComponent(JSON.stringify(knowledge.path))})`)
  
  return md
}
```

#### 2.1.5 验收标准

- [ ] 悬停延迟 < 300ms
- [ ] 显示相关知识的摘要
- [ ] 支持点击跳转到知识页面
- [ ] 支持点击跳转到源代码

---

### REQ-029: 内联知识提示

#### 2.2.1 需求描述

在复杂代码逻辑旁边显示简短的知识提示，帮助理解代码意图。

#### 2.2.2 用户场景

**场景 1: 复杂逻辑提示**
```typescript
// 在代码行尾显示灰色提示
if (user.hasPermission('admin')) { // 💡 权限检查逻辑，见 [[permission-check]]
  // ...
}

// 复杂正则表达式
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/ // 📝 邮箱格式验证
```

#### 2.2.3 功能规格

| 提示类型 | 显示位置 | 触发条件 |
|---------|---------|---------|
| 知识关联 | 行尾 | 代码有关联的知识 |
| 警告提示 | 行尾 | 代码有注意事项 |
| 示例代码 | 代码块后 | 有相关示例 |

#### 2.2.4 技术实现

**代码镜头提供器**:
```typescript
interface CodeLensProvider {
  provideCodeLenses(document: TextDocument): Promise<CodeLens[]>
}

interface CodeLens {
  range: Range
  command: Command
}

class MemoryCodeLensProvider implements CodeLensProvider {
  async provideCodeLenses(document: TextDocument): Promise<CodeLens[]> {
    const lenses: CodeLens[] = []
    const lines = document.getText().split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // 检查是否有相关知识
      const knowledge = await this.findRelatedKnowledge(line, document.uri.fsPath)
      
      if (knowledge) {
        lenses.push({
          range: new Range(i, line.length, i, line.length),
          command: {
            title: `💡 ${knowledge.title}`,
            command: 'memory.open',
            arguments: [knowledge.path]
          }
        })
      }
    }
    
    return lenses
  }
}
```

**装饰器**:
```typescript
interface DecorationProvider {
  provideDecorations(document: TextDocument): Promise<Decoration[]>
}

interface Decoration {
  range: Range
  renderOptions: DecorationRenderOptions
}

class MemoryDecorationProvider implements DecorationProvider {
  async provideDecorations(document: TextDocument): Promise<Decoration[]> {
    const decorations: Decoration[] = []
    const lines = document.getText().split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // 检查是否有警告
      const warnings = await this.findWarnings(line, document.uri.fsPath)
      
      for (const warning of warnings) {
        decorations.push({
          range: new Range(i, line.length, i, line.length),
          renderOptions: {
            after: {
              contentText: ` ⚠️ ${warning.message}`,
              color: '#FFA500',
              fontStyle: 'italic'
            }
          }
        })
      }
    }
    
    return decorations
  }
}
```

#### 2.2.5 验收标准

- [ ] 正确识别需要提示的代码行
- [ ] 提示内容简洁明了
- [ ] 支持点击查看详情

---

### REQ-030: 命令参数补全

#### 2.3.1 需求描述

基于 memory 中的实体信息，智能补全命令参数。

#### 2.3.2 用户场景

**场景 1: memory-ingest 补全**
```
用户输入: /memory-ingest <TAB>

显示补全列表:
┌─────────────────────────────────────┐
│ src/              (推荐: 主要源码)   │
│ src/components/   (推荐: 组件目录)   │
│ src/services/     (推荐: 服务目录)   │
│ docs/             (文档目录)         │
└─────────────────────────────────────┘
```

**场景 2: memory-query 补全**
```
用户输入: /memory-query auth<TAB>

显示补全列表:
┌─────────────────────────────────────┐
│ authentication     (认证相关)        │
│ auth-module        (认证模块)        │
│ authorization      (授权相关)        │
└─────────────────────────────────────┘
```

#### 2.3.3 技术实现

**补全提供器**:
```typescript
interface CompletionProvider {
  provideCompletionItems(document: TextDocument, position: Position): Promise<CompletionItem[]>
}

interface CompletionItem {
  label: string
  kind: CompletionItemKind
  detail?: string
  documentation?: string
  insertText: string
}

class MemoryCompletionProvider implements CompletionProvider {
  async provideCompletionItems(document: TextDocument, position: Position): Promise<CompletionItem[]> {
    const line = document.getText(new Range(position.line, 0, position.line, position.character))
    
    // 检测命令类型
    const commandMatch = line.match(/\/memory-(\w+)\s+(.*)/)
    if (!commandMatch) return []
    
    const [, command, partial] = commandMatch
    
    switch (command) {
      case 'ingest':
        return this.provideIngestCompletions(partial)
      case 'query':
        return this.provideQueryCompletions(partial)
      case 'open':
        return this.provideOpenCompletions(partial)
      default:
        return []
    }
  }
  
  private async provideIngestCompletions(partial: string): Promise<CompletionItem[]> {
    // 获取项目目录结构
    const directories = await this.getDirectories()
    
    // 获取知识库中已知的目录
    const knownDirs = await this.getKnownDirectories()
    
    return directories
      .filter(d => d.startsWith(partial))
      .map(d => ({
        label: d,
        kind: CompletionItemKind.Folder,
        detail: knownDirs.includes(d) ? '已在知识库中' : undefined,
        insertText: d
      }))
  }
  
  private async provideQueryCompletions(partial: string): Promise<CompletionItem[]> {
    // 获取知识库中的关键词
    const keywords = await this.getKeywords()
    
    // 获取最近的查询
    const recentQueries = this.getRecentQueries()
    
    const items: CompletionItem[] = []
    
    // 添加关键词
    for (const keyword of keywords) {
      if (keyword.startsWith(partial.toLowerCase())) {
        items.push({
          label: keyword,
          kind: CompletionItemKind.Keyword,
          insertText: keyword
        })
      }
    }
    
    // 添加最近查询
    for (const query of recentQueries) {
      if (query.startsWith(partial)) {
        items.push({
          label: query,
          kind: CompletionItemKind.Text,
          detail: '最近查询',
          insertText: query
        })
      }
    }
    
    return items
  }
}
```

#### 2.3.4 验收标准

- [ ] 支持 memory-ingest 目录补全
- [ ] 支持 memory-query 关键词补全
- [ ] 支持 memory-open 页面补全
- [ ] 补全延迟 < 100ms

---

## 三、性能优化类需求

### REQ-031: 后台预处理

#### 3.1.1 需求描述

在系统空闲时预测并预加载可能需要的知识，提升查询响应速度。

#### 3.1.2 预处理策略

| 策略 | 描述 | 触发条件 |
|------|------|---------|
| 热点预加载 | 预加载高频访问的知识 | 系统空闲 5 秒后 |
| 关联预加载 | 预加载当前知识的相关知识 | 用户访问某知识时 |
| 上下文预加载 | 预加载当前文件相关的知识 | 用户打开文件时 |

#### 3.1.3 技术实现

**预加载管理器**:
```typescript
interface PreloadManager {
  start(): void
  stop(): void
  preload(paths: string[]): Promise<void>
}

class IdlePreloadManager implements PreloadManager {
  private idleCallback: number | null = null
  private preloadQueue: string[] = []
  
  start(): void {
    // 监听空闲事件
    this.idleCallback = requestIdleCallback(this.onIdle.bind(this))
    
    // 监听文件打开事件
    this.onFileOpen((filePath) => {
      this.scheduleContextPreload(filePath)
    })
    
    // 监听知识访问事件
    this.onKnowledgeAccess((knowledgePath) => {
      this.scheduleRelatedPreload(knowledgePath)
    })
  }
  
  private onIdle(deadline: IdleDeadline): void {
    // 在空闲时执行预加载
    while (deadline.timeRemaining() > 0 && this.preloadQueue.length > 0) {
      const path = this.preloadQueue.shift()!
      this.preloadPage(path)
    }
    
    // 继续监听
    this.idleCallback = requestIdleCallback(this.onIdle.bind(this))
  }
  
  private async scheduleContextPreload(filePath: string): Promise<void> {
    // 获取文件相关的知识
    const related = await this.kb.getRelatedKnowledge(filePath)
    
    // 添加到预加载队列
    this.preloadQueue.push(...related.map(r => r.path))
  }
  
  private async scheduleRelatedPreload(knowledgePath: string): Promise<void> {
    // 获取相关知识
    const related = await this.kb.getRelatedPages(knowledgePath)
    
    // 添加到预加载队列
    this.preloadQueue.push(...related.map(r => r.path))
  }
  
  async preload(paths: string[]): Promise<void> {
    for (const path of paths) {
      await this.preloadPage(path)
    }
  }
  
  private async preloadPage(path: string): Promise<void> {
    // 检查是否已在缓存中
    if (this.cache.has(path)) return
    
    // 加载到缓存
    const page = await this.kb.loadPage(path)
    this.cache.set(path, page)
  }
}
```

**热点分析**:
```typescript
interface HotspotAnalyzer {
  analyze(): Promise<HotspotReport>
  getHotPages(count: number): string[]
}

interface HotspotReport {
  hotPages: Array<{ path: string; accessCount: number }>
  coldPages: Array<{ path: string; lastAccess: Date }>
}

class AccessBasedHotspotAnalyzer implements HotspotAnalyzer {
  private accessLog: Array<{ path: string; timestamp: number }> = []
  
  recordAccess(path: string): void {
    this.accessLog.push({ path, timestamp: Date.now() })
  }
  
  async analyze(): Promise<HotspotReport> {
    // 统计访问频率
    const accessCounts = new Map<string, number>()
    
    for (const { path } of this.accessLog) {
      accessCounts.set(path, (accessCounts.get(path) || 0) + 1)
    }
    
    // 排序
    const sorted = Array.from(accessCounts.entries())
      .sort((a, b) => b[1] - a[1])
    
    return {
      hotPages: sorted.slice(0, 20).map(([path, count]) => ({ path, accessCount: count })),
      coldPages: sorted.slice(-20).map(([path]) => ({ path, lastAccess: new Date() }))
    }
  }
  
  getHotPages(count: number): string[] {
    const report = this.analyze()
    return report.hotPages.slice(0, count).map(p => p.path)
  }
}
```

#### 3.1.4 验收标准

- [ ] 空闲时自动预加载热点知识
- [ ] 打开文件时预加载相关知识
- [ ] 预加载不影响正常操作

---

## 四、项目支持类需求

### REQ-032: 多语言项目支持

#### 4.1.1 需求描述

同时支持 Python、Go、Java、TypeScript 等多语言项目的知识管理。

#### 4.1.2 支持的语言

| 语言 | 文件扩展名 | 依赖提取 | 注释解析 |
|------|-----------|---------|---------|
| TypeScript | .ts, .tsx | ✅ import | ✅ JSDoc/TSDoc |
| JavaScript | .js, .jsx | ✅ import/require | ✅ JSDoc |
| Python | .py | ✅ import | ✅ docstring |
| Go | .go | ✅ import | ✅ godoc |
| Java | .java | ✅ import | ✅ Javadoc |
| Rust | .rs | ✅ use | ✅ rustdoc |

#### 4.1.3 技术实现

**语言适配器**:
```typescript
interface LanguageAdapter {
  language: string
  extensions: string[]
  
  extractDependencies(content: string, filePath: string): Dependency[]
  extractComments(content: string): Comment[]
  extractSymbols(content: string): Symbol[]
  parseDocComment(comment: string): DocComment | null
}

interface Comment {
  type: 'line' | 'block' | 'doc'
  content: string
  location: { line: number; start: number; end: number }
}

interface DocComment {
  description: string
  params: Array<{ name: string; description: string }>
  returns?: string
  examples?: string[]
}

class TypeScriptAdapter implements LanguageAdapter {
  language = 'typescript'
  extensions = ['.ts', '.tsx']
  
  extractDependencies(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = []
    
    // 解析 AST
    const ast = parseTypeScript(content)
    
    traverse(ast, {
      ImportDeclaration(node) {
        dependencies.push({
          type: node.source.value.startsWith('.') ? 'internal' : 'external',
          source: filePath,
          target: node.source.value,
          location: { line: node.loc.start.line, column: node.loc.start.column }
        })
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          dependencies.push({
            type: 'internal',
            source: filePath,
            target: node.source.value,
            location: { line: node.loc.start.line, column: node.loc.start.column }
          })
        }
      }
    })
    
    return dependencies
  }
  
  extractComments(content: string): Comment[] {
    const comments: Comment[] = []
    const lines = content.split('\n')
    
    let inBlock = false
    let blockStart = 0
    let blockContent = ''
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // 单行注释
      if (line.match(/^\s*\/\//)) {
        comments.push({
          type: 'line',
          content: line.replace(/^\s*\/\//, '').trim(),
          location: { line: i + 1, start: 0, end: line.length }
        })
      }
      
      // 块注释开始
      if (line.includes('/*') && !line.includes('*/')) {
        inBlock = true
        blockStart = i
        blockContent = line.replace(/.*\/\*/, '')
      }
      
      // 块注释结束
      if (inBlock && line.includes('*/')) {
        inBlock = false
        blockContent += '\n' + line.replace(/\*\//, '')
        comments.push({
          type: 'block',
          content: blockContent.trim(),
          location: { line: blockStart + 1, start: 0, end: line.length }
        })
        blockContent = ''
      }
      
      // 块注释中间
      if (inBlock) {
        blockContent += '\n' + line
      }
    }
    
    return comments
  }
  
  parseDocComment(comment: string): DocComment | null {
    // JSDoc 格式解析
    const lines = comment.split('\n').map(l => l.replace(/^\s*\*?\s*/, ''))
    
    let description = ''
    const params: Array<{ name: string; description: string }> = []
    let returns: string | undefined
    
    for (const line of lines) {
      if (line.startsWith('@param')) {
        const match = line.match(/@param\s+(\w+)\s+(.*)/)
        if (match) {
          params.push({ name: match[1], description: match[2] })
        }
      } else if (line.startsWith('@returns')) {
        returns = line.replace('@returns', '').trim()
      } else if (!line.startsWith('@')) {
        description += line + ' '
      }
    }
    
    return {
      description: description.trim(),
      params,
      returns
    }
  }
}
```

**语言注册表**:
```typescript
class LanguageRegistry {
  private adapters: Map<string, LanguageAdapter> = new Map()
  
  register(adapter: LanguageAdapter): void {
    this.adapters.set(adapter.language, adapter)
  }
  
  getAdapter(filePath: string): LanguageAdapter | null {
    const ext = path.extname(filePath)
    
    for (const adapter of this.adapters.values()) {
      if (adapter.extensions.includes(ext)) {
        return adapter
      }
    }
    
    return null
  }
}
```

#### 4.1.4 验收标准

- [ ] 支持 TypeScript/JavaScript 项目
- [ ] 支持 Python 项目
- [ ] 支持 Go 项目
- [ ] 支持 Java 项目

---

### REQ-033: Monorepo 支持

#### 4.2.1 需求描述

支持 Monorepo 结构的项目，能够识别和管理多个包的知识。

#### 4.2.2 Monorepo 结构

```
project/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   └── package.json
│   ├── ui/
│   │   ├── src/
│   │   └── package.json
│   └── utils/
│       ├── src/
│       └── package.json
├── .memory/
│   ├── packages/
│   │   ├── core/
│   │   ├── ui/
│   │   └── utils/
│   └── shared/
└── package.json
```

#### 4.2.3 技术实现

**Monorepo 检测器**:
```typescript
interface MonorepoDetector {
  detect(rootPath: string): Promise<MonorepoInfo | null>
}

interface MonorepoInfo {
  type: 'npm-workspaces' | 'pnpm' | 'yarn' | 'lerna' | 'rush'
  packages: Package[]
}

interface Package {
  name: string
  path: string
  dependencies: string[]
}

class NpmWorkspacesDetector implements MonorepoDetector {
  async detect(rootPath: string): Promise<MonorepoInfo | null> {
    const packageJsonPath = path.join(rootPath, 'package.json')
    
    if (!await fs.exists(packageJsonPath)) {
      return null
    }
    
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
    
    if (!packageJson.workspaces) {
      return null
    }
    
    // 解析 workspaces
    const workspacePatterns = Array.isArray(packageJson.workspaces)
      ? packageJson.workspaces
      : packageJson.workspaces.packages || []
    
    const packages: Package[] = []
    
    for (const pattern of workspacePatterns) {
      const matches = await glob(pattern, { cwd: rootPath })
      
      for (const match of matches) {
        const pkgPath = path.join(rootPath, match)
        const pkgJsonPath = path.join(pkgPath, 'package.json')
        
        if (await fs.exists(pkgJsonPath)) {
          const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'))
          
          packages.push({
            name: pkgJson.name,
            path: pkgPath,
            dependencies: Object.keys(pkgJson.dependencies || {})
          })
        }
      }
    }
    
    return {
      type: 'npm-workspaces',
      packages
    }
  }
}
```

**包知识管理器**:
```typescript
interface PackageKnowledgeManager {
  indexPackage(pkg: Package): Promise<void>
  getPackageKnowledge(pkgName: string): KnowledgePage[]
  getCrossPackageLinks(): CrossPackageLink[]
}

interface CrossPackageLink {
  from: { package: string; page: string }
  to: { package: string; page: string }
  type: 'dependency' | 'import' | 'reference'
}

class DefaultPackageKnowledgeManager implements PackageKnowledgeManager {
  async indexPackage(pkg: Package): Promise<void> {
    // 为每个包创建独立的知识目录
    const pkgMemoryPath = path.join(this.memoryPath, 'packages', pkg.name)
    
    // 摄入包的源码
    await this.ingestDirectory(path.join(pkg.path, 'src'), pkgMemoryPath)
    
    // 标记包依赖
    await this.markPackageDependencies(pkg)
  }
  
  getCrossPackageLinks(): CrossPackageLink[] {
    const links: CrossPackageLink[] = []
    
    // 遍历所有包的知识
    for (const pkg of this.getPackages()) {
      const pages = this.getPackageKnowledge(pkg.name)
      
      for (const page of pages) {
        // 检查是否有跨包引用
        const wikiLinks = extractWikiLinks(page.content)
        
        for (const link of wikiLinks) {
          const targetPkg = this.findPackageForPage(link.target)
          
          if (targetPkg && targetPkg !== pkg.name) {
            links.push({
              from: { package: pkg.name, page: page.path },
              to: { package: targetPkg, page: link.target },
              type: 'reference'
            })
          }
        }
      }
    }
    
    return links
  }
}
```

#### 4.2.4 验收标准

- [ ] 自动检测 Monorepo 结构
- [ ] 为每个包创建独立知识目录
- [ ] 支持跨包知识关联
- [ ] 支持共享知识区域

---

## 五、实施计划

### V2.0 版本（4-5 周）

| 需求 | 预计工时 | 依赖 |
|------|---------|------|
| REQ-028 悬浮文档 | 4 天 | P0 核心功能 |
| REQ-029 内联知识提示 | 3 天 | REQ-028 |
| REQ-030 命令参数补全 | 2 天 | P0 核心功能 |
| REQ-031 后台预处理 | 3 天 | P0 性能优化 |
| REQ-032 多语言项目支持 | 4 天 | P0 核心功能 |
| REQ-033 Monorepo 支持 | 3 天 | P0 核心功能 |

---

## 六、验收清单

### 功能验收

- [ ] 所有 6 项需求功能完整实现
- [ ] 单元测试覆盖率 > 70%

### 性能验收

- [ ] 悬浮延迟 < 300ms
- [ ] 补全延迟 < 100ms
- [ ] 预加载不影响正常操作

### 兼容性验收

- [ ] 支持 TypeScript/JavaScript
- [ ] 支持 Python
- [ ] 支持 Monorepo 结构

---

**文档结束**
