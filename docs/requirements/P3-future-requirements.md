# P3 后期规划需求设计文档

> **文档版本**: v1.0  
> **创建日期**: 2026-04-19  
> **优先级**: P3 - 后期规划  
> **目标版本**: V2.0+  

---

## 一、概述

P3 需求是未来扩展功能，共 8 项。这些功能提供更高级的特性，可在产品成熟后根据用户反馈和市场需求逐步实施。

### 核心目标

1. **增强知识演进能力** - 版本化存储、时间线视图
2. **扩展查询方式** - 多模态查询、图探索
3. **深化集成能力** - 外部知识导入、Diff 增强、CI/CD 集成
4. **支持高级场景** - 分支知识隔离

---

## 二、知识演进类需求

### REQ-034: 版本化存储

#### 2.1.1 需求描述

记录知识的演进历史，支持回溯到任意版本，查看知识变更轨迹。

#### 2.1.2 用户场景

**场景 1: API 演进历史**
```
用户想了解某个 API 的演进过程，
查看从 v1.0 到 v2.0 的所有变更记录。
```

**场景 2: 决策追溯**
```
用户想了解为什么做出某个架构决策，
查看历史版本的决策记录和讨论。
```

#### 2.1.3 功能规格

| 功能 | 描述 |
|------|------|
| 版本快照 | 每次重要变更创建版本快照 |
| 变更历史 | 记录每次变更的内容、时间、原因 |
| 版本对比 | 对比任意两个版本的差异 |
| 版本回滚 | 回滚到指定版本 |

#### 2.1.4 技术实现

**版本存储结构**:
```
.memory/
├── entities/
│   └── auth-module.md
├── .versions/
│   └── entities/
│       └── auth-module/
│           ├── v1.0.0.md
│           ├── v1.1.0.md
│           ├── v1.2.0.md
│           └── history.json
```

**版本管理器**:
```typescript
interface VersionManager {
  createVersion(pagePath: string, reason: string): Promise<string>
  getVersion(pagePath: string, version: string): Promise<KnowledgePage | null>
  getVersionHistory(pagePath: string): Promise<VersionHistory>
  compareVersions(pagePath: string, v1: string, v2: string): Promise<VersionDiff>
  rollback(pagePath: string, version: string): Promise<void>
}

interface VersionHistory {
  current: string
  versions: Array<{
    version: string
    createdAt: Date
    reason: string
    author?: string
  }>
}

interface VersionDiff {
  added: string[]
  removed: string[]
  modified: Array<{ old: string; new: string }>
}

class GitBasedVersionManager implements VersionManager {
  async createVersion(pagePath: string, reason: string): Promise<string> {
    // 使用 Git tag 作为版本标记
    const version = this.generateVersion()
    
    // 创建 Git tag
    await exec(`git tag -a "memory/${pagePath}/${version}" -m "${reason}"`)
    
    // 记录版本信息
    const historyPath = this.getHistoryPath(pagePath)
    const history = await this.loadHistory(historyPath)
    
    history.versions.push({
      version,
      createdAt: new Date(),
      reason
    })
    
    await this.saveHistory(historyPath, history)
    
    return version
  }
  
  async getVersion(pagePath: string, version: string): Promise<KnowledgePage | null> {
    try {
      const content = await exec(`git show "memory/${pagePath}/${version}:${pagePath}"`)
      return this.parsePage(content.stdout)
    } catch {
      return null
    }
  }
  
  async compareVersions(pagePath: string, v1: string, v2: string): Promise<VersionDiff> {
    const diff = await exec(`git diff "memory/${pagePath}/${v1}" "memory/${pagePath}/${v2}" -- "${pagePath}"`)
    
    return this.parseDiff(diff.stdout)
  }
}
```

#### 2.1.5 验收标准

- [ ] 支持创建版本快照
- [ ] 支持查看版本历史
- [ ] 支持版本对比
- [ ] 支持版本回滚

---

### REQ-035: 时间线视图

#### 2.2.1 需求描述

按时间维度组织和浏览知识演进，可视化展示知识的生命周期。

#### 2.2.2 用户场景

**场景 1: 项目演进概览**
```
用户想了解项目在过去 6 个月的发展历程，
查看时间线视图，了解关键决策和重要变更。
```

#### 2.2.3 功能规格

| 视图类型 | 描述 |
|---------|------|
| 日视图 | 显示当天的所有知识变更 |
| 周视图 | 显示本周的知识演进 |
| 月视图 | 显示本月的知识演进 |
| 年视图 | 显示全年的知识演进 |

#### 2.2.4 技术实现

**时间线生成器**:
```typescript
interface TimelineGenerator {
  generate(options: TimelineOptions): Promise<Timeline>
}

interface TimelineOptions {
  startDate: Date
  endDate: Date
  granularity: 'day' | 'week' | 'month' | 'year'
  filters?: {
    types?: string[]
    tags?: string[]
  }
}

interface Timeline {
  events: TimelineEvent[]
  stats: TimelineStats
}

interface TimelineEvent {
  date: Date
  type: 'created' | 'updated' | 'deleted'
  page: string
  summary: string
  importance: 'high' | 'medium' | 'low'
}

class DefaultTimelineGenerator implements TimelineGenerator {
  async generate(options: TimelineOptions): Promise<Timeline> {
    const events: TimelineEvent[] = []
    
    // 获取时间范围内的所有变更
    const changes = await this.getChanges(options.startDate, options.endDate)
    
    for (const change of changes) {
      events.push({
        date: change.timestamp,
        type: change.type,
        page: change.path,
        summary: this.generateSummary(change),
        importance: this.assessImportance(change)
      })
    }
    
    // 按时间排序
    events.sort((a, b) => a.date.getTime() - b.date.getTime())
    
    return {
      events,
      stats: this.calculateStats(events)
    }
  }
  
  private assessImportance(change: Change): 'high' | 'medium' | 'low' {
    // 根据变更类型和内容评估重要性
    if (change.type === 'created' && change.frontmatter.priority === 'critical') {
      return 'high'
    }
    
    if (change.type === 'updated' && change.linesChanged > 50) {
      return 'medium'
    }
    
    return 'low'
  }
}
```

**时间线可视化**:
```typescript
function renderTimeline(timeline: Timeline): string {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Knowledge Timeline</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div class="timeline">
    ${timeline.events.map(event => `
      <div class="event ${event.importance}">
        <div class="date">${formatDate(event.date)}</div>
        <div class="content">
          <span class="type">${event.type}</span>
          <a href="memory://${event.page}">${event.page}</a>
          <p>${event.summary}</p>
        </div>
      </div>
    `).join('')}
  </div>
  <canvas id="stats"></canvas>
  <script>
    new Chart(document.getElementById('stats'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(timeline.stats.labels)},
        datasets: [{
          label: 'Changes',
          data: ${JSON.stringify(timeline.stats.data)}
        }]
      }
    });
  </script>
</body>
</html>
  `
  
  return html
}
```

#### 2.2.5 验收标准

- [ ] 支持多种时间粒度视图
- [ ] 正确显示知识变更事件
- [ ] 支持筛选和过滤

---

## 三、查询扩展类需求

### REQ-036: 多模态查询

#### 3.1.1 需求描述

支持代码片段、错误堆栈、JSON 等多种输入形式的查询。

#### 3.1.2 用户场景

**场景 1: 代码片段查询**
```
用户粘贴一段代码:
const result = await fetch('/api/users', { method: 'GET' })

系统自动识别:
- 这是一个 fetch API 调用
- 关联到 [[api-client]] 知识
- 提供相关的错误处理和最佳实践
```

**场景 2: 错误堆栈查询**
```
用户粘贴错误堆栈:
TypeError: Cannot read property 'id' of undefined
  at UserController.findById (src/controllers/user.ts:42)
  at Router.handle (src/router.ts:15)

系统自动识别:
- 错误位置: UserController.findById
- 关联到 [[user-controller]] 知识
- 提供可能的修复方案
```

#### 3.1.3 技术实现

**多模态解析器**:
```typescript
interface MultiModalParser {
  parse(input: string): Promise<ParsedInput>
}

interface ParsedInput {
  type: 'text' | 'code' | 'error' | 'json' | 'url'
  content: string
  entities?: ExtractedEntity[]
  suggestions?: string[]
}

interface ExtractedEntity {
  type: 'function' | 'class' | 'variable' | 'error'
  name: string
  location?: { file: string; line: number }
}

class SmartMultiModalParser implements MultiModalParser {
  async parse(input: string): Promise<ParsedInput> {
    // 检测输入类型
    const type = this.detectType(input)
    
    switch (type) {
      case 'code':
        return this.parseCode(input)
      case 'error':
        return this.parseError(input)
      case 'json':
        return this.parseJson(input)
      default:
        return { type: 'text', content: input }
    }
  }
  
  private detectType(input: string): ParsedInput['type'] {
    // 检测是否是代码
    if (this.looksLikeCode(input)) {
      return 'code'
    }
    
    // 检测是否是错误堆栈
    if (this.looksLikeError(input)) {
      return 'error'
    }
    
    // 检测是否是 JSON
    if (this.looksLikeJson(input)) {
      return 'json'
    }
    
    return 'text'
  }
  
  private looksLikeCode(input: string): boolean {
    const codePatterns = [
      /^(const|let|var|function|class|import|export)\s/m,
      /^(public|private|protected)\s/m,
      /[{}\[\]();]/
    ]
    
    return codePatterns.some(p => p.test(input))
  }
  
  private looksLikeError(input: string): boolean {
    const errorPatterns = [
      /^(TypeError|ReferenceError|SyntaxError|Error):/m,
      /^\s+at\s+\w+/m,
      /at\s+\w+\s+\([^)]+\)/
    ]
    
    return errorPatterns.some(p => p.test(input))
  }
  
  private async parseCode(input: string): Promise<ParsedInput> {
    const entities: ExtractedEntity[] = []
    
    // 提取函数名
    const funcMatches = input.matchAll(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/g)
    for (const match of funcMatches) {
      entities.push({
        type: 'function',
        name: match[1] || match[2]
      })
    }
    
    // 提取类名
    const classMatches = input.matchAll(/class\s+(\w+)/g)
    for (const match of classMatches) {
      entities.push({
        type: 'class',
        name: match[1]
      })
    }
    
    // 生成查询建议
    const suggestions = entities.map(e => e.name)
    
    return {
      type: 'code',
      content: input,
      entities,
      suggestions
    }
  }
  
  private async parseError(input: string): Promise<ParsedInput> {
    const entities: ExtractedEntity[] = []
    
    // 提取错误类型
    const errorTypeMatch = input.match(/^(\w+Error):/m)
    if (errorTypeMatch) {
      entities.push({
        type: 'error',
        name: errorTypeMatch[1]
      })
    }
    
    // 提取堆栈位置
    const stackMatches = input.matchAll(/at\s+(\w+)\s+\(([^:]+):(\d+):\d+\)/g)
    for (const match of stackMatches) {
      entities.push({
        type: 'function',
        name: match[1],
        location: { file: match[2], line: parseInt(match[3]) }
      })
    }
    
    return {
      type: 'error',
      content: input,
      entities,
      suggestions: entities.map(e => e.name)
    }
  }
}
```

#### 3.1.4 验收标准

- [ ] 正确识别代码片段
- [ ] 正确识别错误堆栈
- [ ] 提供相关的知识建议

---

### REQ-037: 图探索查询

#### 3.2.1 需求描述

通过可视化图界面进行探索式知识发现，支持交互式导航。

#### 3.2.2 用户场景

**场景 1: 探索关联知识**
```
用户在查看 [[auth-module]] 时，
想了解与之相关的所有知识。
点击图中的节点，逐步探索关联网络。
```

#### 3.2.3 功能规格

| 交互方式 | 描述 |
|---------|------|
| 点击节点 | 显示节点详情和相关链接 |
| 拖拽节点 | 重新布局图结构 |
| 缩放 | 放大/缩小视图 |
| 筛选 | 按类型、标签筛选节点 |
| 搜索 | 在图中搜索节点 |

#### 3.2.4 技术实现

**图可视化组件**:
```typescript
interface GraphVisualizer {
  render(graph: KnowledgeGraph, container: HTMLElement): void
  highlightNode(nodeId: string): void
  filterNodes(predicate: (node: KnowledgeNode) => boolean): void
  searchNodes(query: string): string[]
}

class D3GraphVisualizer implements GraphVisualizer {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
  private simulation: d3.Simulation<KnowledgeNode, KnowledgeEdge>
  
  render(graph: KnowledgeGraph, container: HTMLElement): void {
    // 创建 SVG
    this.svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
    
    // 创建力导向图模拟
    this.simulation = d3.forceSimulation(graph.nodes)
      .force('link', d3.forceLink(graph.edges).id(d => d.id))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2))
    
    // 绘制边
    const links = this.svg.append('g')
      .selectAll('line')
      .data(graph.edges)
      .enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
    
    // 绘制节点
    const nodes = this.svg.append('g')
      .selectAll('circle')
      .data(graph.nodes)
      .enter()
      .append('circle')
      .attr('r', 5)
      .attr('fill', d => this.getNodeColor(d.type))
      .call(this.drag())
      .on('click', (event, d) => this.onNodeClick(d))
    
    // 添加标签
    const labels = this.svg.append('g')
      .selectAll('text')
      .data(graph.nodes)
      .enter()
      .append('text')
      .text(d => d.title)
      .attr('font-size', 10)
      .attr('dx', 8)
      .attr('dy', 3)
    
    // 更新位置
    this.simulation.on('tick', () => {
      links
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)
      
      nodes
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
      
      labels
        .attr('x', d => d.x)
        .attr('y', d => d.y)
    })
  }
  
  highlightNode(nodeId: string): void {
    this.svg.selectAll('circle')
      .attr('stroke', d => d.id === nodeId ? '#ff0000' : 'none')
      .attr('stroke-width', d => d.id === nodeId ? 3 : 0)
  }
  
  private onNodeClick(node: KnowledgeNode): void {
    // 显示节点详情
    this.showNodeDetails(node)
    
    // 高亮相关节点
    this.highlightRelatedNodes(node.id)
  }
}
```

#### 3.2.5 验收标准

- [ ] 正确渲染知识图谱
- [ ] 支持交互式导航
- [ ] 支持筛选和搜索

---

## 四、集成扩展类需求

### REQ-038: 外部知识导入

#### 4.1.1 需求描述

从文档网站、API 规范、代码注释等外部来源导入知识。

#### 4.1.2 支持的导入源

| 来源 | 格式 | 导入方式 |
|------|------|---------|
| 文档网站 | HTML/Markdown | URL 抓取 |
| API 规范 | OpenAPI/Swagger | 文件解析 |
| 代码注释 | JSDoc/TSDoc/Docstring | AST 提取 |
| Issue/PR | Markdown | API 获取 |

#### 4.1.3 技术实现

**导入器接口**:
```typescript
interface KnowledgeImporter {
  import(source: ImportSource): Promise<KnowledgePage[]>
}

interface ImportSource {
  type: 'url' | 'file' | 'api'
  location: string
  options?: ImportOptions
}

class OpenApiImporter implements KnowledgeImporter {
  async import(source: ImportSource): Promise<KnowledgePage[]> {
    const spec = await this.loadSpec(source.location)
    const pages: KnowledgePage[] = []
    
    // 为每个 API 端点创建知识页面
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        pages.push({
          path: `entities/api/${method}-${this.sanitizePath(path)}.md`,
          frontmatter: {
            title: operation.summary || `${method.toUpperCase()} ${path}`,
            type: 'api',
            tags: ['api', method, ...this.extractTags(operation)],
            source: source.location,
            imported: new Date().toISOString()
          },
          content: this.generateApiDoc(operation, path, method)
        })
      }
    }
    
    return pages
  }
  
  private generateApiDoc(operation: any, path: string, method: string): string {
    let doc = `## ${operation.summary || 'API Endpoint'}\n\n`
    
    doc += `**Method**: \`${method.toUpperCase()}\`\n\n`
    doc += `**Path**: \`${path}\`\n\n`
    
    if (operation.description) {
      doc += `### Description\n\n${operation.description}\n\n`
    }
    
    if (operation.parameters?.length) {
      doc += `### Parameters\n\n`
      doc += `| Name | In | Type | Required | Description |\n`
      doc += `|------|-----|------|----------|-------------|\n`
      
      for (const param of operation.parameters) {
        doc += `| ${param.name} | ${param.in} | ${param.schema?.type || 'any'} | ${param.required ? 'Yes' : 'No'} | ${param.description || ''} |\n`
      }
      doc += '\n'
    }
    
    if (operation.requestBody) {
      doc += `### Request Body\n\n`
      doc += '```json\n'
      doc += JSON.stringify(operation.requestBody.content?.['application/json']?.schema?.example || {}, null, 2)
      doc += '\n```\n\n'
    }
    
    if (operation.responses) {
      doc += `### Responses\n\n`
      for (const [code, response] of Object.entries(operation.responses)) {
        doc += `**${code}**: ${response.description}\n\n`
      }
    }
    
    return doc
  }
}
```

#### 4.1.4 验收标准

- [ ] 支持 OpenAPI/Swagger 导入
- [ ] 支持文档网站抓取
- [ ] 导入内容格式正确

---

### REQ-039: Diff 增强

#### 4.2.1 需求描述

在代码 diff 视图中显示相关的知识变更，帮助理解代码变更的影响。

#### 4.2.2 用户场景

**场景 1: PR 审阅**
```
用户在审阅 PR 时，看到代码变更，
同时显示相关的知识变更建议。
```

#### 4.2.3 技术实现

**Diff 分析器**:
```typescript
interface DiffAnalyzer {
  analyze(diff: string): Promise<DiffAnalysis>
}

interface DiffAnalysis {
  changedFiles: ChangedFile[]
  knowledgeImpacts: KnowledgeImpact[]
  suggestions: string[]
}

interface KnowledgeImpact {
  knowledgePath: string
  impactType: 'update-needed' | 'review-needed' | 'deprecated'
  reason: string
}

class DefaultDiffAnalyzer implements DiffAnalyzer {
  async analyze(diff: string): Promise<DiffAnalysis> {
    const changedFiles = this.parseDiff(diff)
    const knowledgeImpacts: KnowledgeImpact[] = []
    
    for (const file of changedFiles) {
      // 查找与该文件相关的知识
      const relatedKnowledge = await this.kb.getRelatedKnowledge(file.path)
      
      for (const knowledge of relatedKnowledge) {
        // 判断影响类型
        const impactType = this.assessImpact(file, knowledge)
        
        knowledgeImpacts.push({
          knowledgePath: knowledge.path,
          impactType,
          reason: this.generateReason(file, knowledge, impactType)
        })
      }
    }
    
    return {
      changedFiles,
      knowledgeImpacts,
      suggestions: this.generateSuggestions(knowledgeImpacts)
    }
  }
  
  private assessImpact(file: ChangedFile, knowledge: KnowledgePage): KnowledgeImpact['impactType'] {
    // 如果知识中引用的代码被删除
    if (file.deletedLines.some(line => knowledge.content.includes(line))) {
      return 'update-needed'
    }
    
    // 如果文件是知识的主要来源
    if (knowledge.frontmatter.sourceFile === file.path) {
      return 'update-needed'
    }
    
    // 如果文件与知识相关
    return 'review-needed'
  }
}
```

#### 4.2.4 验收标准

- [ ] 正确分析代码变更对知识的影响
- [ ] 提供合理的更新建议
- [ ] 支持 Git diff 格式

---

### REQ-040: 分支知识隔离

#### 4.3.1 需求描述

支持不同代码分支对应不同的知识版本，实现分支间的知识隔离。

#### 4.3.2 用户场景

**场景 1: 功能分支开发**
```
用户在 feature/new-auth 分支开发新功能，
该分支的知识变更不会影响 main 分支的知识。
合并分支时，知识也一并合并。
```

#### 4.3.3 技术实现

**分支知识管理器**:
```typescript
interface BranchKnowledgeManager {
  getCurrentBranch(): Promise<string>
  switchBranch(branch: string): Promise<void>
  mergeBranch(source: string, target: string): Promise<MergeResult>
}

interface MergeResult {
  success: boolean
  conflicts: MergeConflict[]
  merged: string[]
}

class GitBranchKnowledgeManager implements BranchKnowledgeManager {
  private branchKnowledgeDir = '.memory/branches'
  
  async getCurrentBranch(): Promise<string> {
    const result = await exec('git branch --show-current')
    return result.stdout.trim()
  }
  
  async switchBranch(branch: string): Promise<void> {
    const currentBranch = await this.getCurrentBranch()
    
    // 保存当前分支的知识
    await this.saveBranchKnowledge(currentBranch)
    
    // 切换分支
    await exec(`git checkout ${branch}`)
    
    // 加载目标分支的知识
    await this.loadBranchKnowledge(branch)
  }
  
  async mergeBranch(source: string, target: string): Promise<MergeResult> {
    const conflicts: MergeConflict[] = []
    const merged: string[] = []
    
    // 获取两个分支的知识
    const sourceKnowledge = await this.getBranchKnowledge(source)
    const targetKnowledge = await this.getBranchKnowledge(target)
    
    // 合并知识
    for (const [path, sourcePage] of Object.entries(sourceKnowledge)) {
      const targetPage = targetKnowledge[path]
      
      if (targetPage) {
        // 检查冲突
        if (this.hasConflict(sourcePage, targetPage)) {
          conflicts.push({
            path,
            sourceVersion: sourcePage.version,
            targetVersion: targetPage.version
          })
        } else {
          // 自动合并
          await this.mergePage(path, sourcePage, targetPage)
          merged.push(path)
        }
      } else {
        // 直接添加
        await this.addPage(path, sourcePage)
        merged.push(path)
      }
    }
    
    return {
      success: conflicts.length === 0,
      conflicts,
      merged
    }
  }
}
```

#### 4.3.4 验收标准

- [ ] 支持分支切换时知识隔离
- [ ] 支持分支合并时知识合并
- [ ] 正确处理合并冲突

---

### REQ-041: CI/CD 集成

#### 4.4.1 需求描述

在 CI/CD 流水线中触发知识更新和验证，实现自动化知识管理。

#### 4.4.2 用户场景

**场景 1: PR 检查**
```yaml
# .github/workflows/memory-check.yml
name: Memory Check
on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check Knowledge
        run: |
          npm install -g oh-memory
          memory-lint --ci
          memory-diff --base origin/main
```

#### 4.4.3 技术实现

**CI 命令**:
```typescript
// memory-lint --ci
class CiLintCommand {
  async execute(): Promise<CiResult> {
    const report = await this.linter.check()
    
    // 输出 CI 友好的结果
    if (report.issues.length > 0) {
      console.log('::error::Knowledge base has issues')
      
      for (const issue of report.issues) {
        console.log(`::error file=${issue.path},line=${issue.line}::${issue.message}`)
      }
      
      return { success: false, exitCode: 1 }
    }
    
    return { success: true, exitCode: 0 }
  }
}

// memory-diff --base origin/main
class CiDiffCommand {
  async execute(base: string): Promise<CiResult> {
    const diff = await this.analyzer.analyze(base)
    
    // 输出知识影响报告
    console.log('## Knowledge Impact Report\n')
    
    if (diff.knowledgeImpacts.length === 0) {
      console.log('No knowledge impact detected.')
      return { success: true, exitCode: 0 }
    }
    
    console.log('### Affected Knowledge\n')
    
    for (const impact of diff.knowledgeImpacts) {
      const icon = impact.impactType === 'update-needed' ? '🔴' : '🟡'
      console.log(`${icon} [[${impact.knowledgePath}]] - ${impact.reason}`)
    }
    
    return { success: true, exitCode: 0 }
  }
}
```

#### 4.4.4 验收标准

- [ ] 支持 CI 环境运行
- [ ] 输出 CI 友好的结果
- [ ] 支持常见 CI 平台

---

## 五、实施计划

### V2.0+ 版本

| 需求 | 预计工时 | 优先级 |
|------|---------|--------|
| REQ-034 版本化存储 | 4 天 | 中 |
| REQ-035 时间线视图 | 3 天 | 低 |
| REQ-036 多模态查询 | 4 天 | 中 |
| REQ-037 图探索查询 | 3 天 | 低 |
| REQ-038 外部知识导入 | 4 天 | 中 |
| REQ-039 Diff 增强 | 3 天 | 中 |
| REQ-040 分支知识隔离 | 4 天 | 中 |
| REQ-041 CI/CD 集成 | 2 天 | 高 |

---

## 六、验收清单

### 功能验收

- [ ] 所有 8 项需求功能完整实现
- [ ] 单元测试覆盖率 > 60%

### 性能验收

- [ ] 版本对比响应 < 1 秒
- [ ] 图探索渲染流畅

### 集成验收

- [ ] 支持 GitHub Actions
- [ ] 支持 GitLab CI
- [ ] 支持 Jenkins

---

**文档结束**
