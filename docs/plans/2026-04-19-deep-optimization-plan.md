# Oh-Memory 深度优化方案 - 真正能解决问题的生产级方案

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **背景:** 本文档基于对 oh-memory 全命令的深度代码分析、开发者日常工作流理解、知识库专家最佳实践总结而成。
> **目标:** 让 oh-memory 从"能用"升级为"好用"，真正融入开发者的日常工作流。
>
> **评审状态:** ✅ CTO 已批准（修订版）
> **作者:** 架构智能体 (CTO + 开发者双重视角)
> **日期:** 2026-04-19
> **修订日期:** 2026-04-19

**Goal:** 将 oh-memory 从基础可用的知识库工具，升级为能真正融入开发者日常工作流的深度知识管理平台。

**Architecture:** 
1. 添加状态可见化命令（/memory-status），让知识库状态一目了然
2. 添加变更对比能力（/memory-diff），让每次 ingest 都有据可查
3. 进化引擎可见化，让自动更新不再是黑盒
4. 查询增强支持全文搜索，不只是摘要
5. 合并重叠命令，精简命令生态

**Tech Stack:** TypeScript, Bun runtime, gray-matter, 文件系统操作

---

## 〇、已修复的现有 Bug（CTO 审查发现）

以下问题已在方案实施前修复：

| 问题 | 严重程度 | 修复状态 |
|------|---------|---------|
| `QueryOptions` 重复定义导致 `includeSummaries` 失效 | 🔴 严重 | ✅ 已修复 |
| 进化引擎未启动（缺少 `start()` 调用） | 🔴 严重 | ✅ 已修复 |
| 缺少 `memory-search.md` 和 `memory-update.md` 命令文件 | 🟡 中等 | ✅ 已修复 |
| `memory-update-kb` 与 `memory-ingest-files` 功能完全重复 | 🟡 中等 | ✅ 已合并 |

---

## 一、当前问题深度剖析

### 1.1 核心矛盾：知识管理平台 vs 工具集合

**现状:** oh-memory 定位是"LLM-powered knowledge base"，但实际实现更像一组独立的工具命令。

**表现:**
- 用户不知道知识库整体状态如何（多少页面？健康吗？最后更新？）
- 每次 ingest 都是盲操作（不知道改了什么，不知道结果如何）
- 进化引擎在后台默默运行，用户看不见也控制不了
- 查询只能搜摘要，想要深度内容需要额外操作

**根因:** 缺少**元能力**（关于知识的能力），只有**操作能力**（对知识的操作）。

### 1.2 开发者工作流断裂点

```
正常开发流程:
  写代码 → git commit → 更新知识库 → 查询知识

当前 oh-memory 支持:
  ❌ 不知道知识库状态（需不需要更新？）
  ❌ 不知道 ingest 改了什么（安全吗？）
  ❌ 不知道进化引擎在干嘛（失控感）
  ❌ 查询不够深（找不到细节）

理想的开发者体验:
  ✅ 一条命令看状态
  ✅ ingest 前预览变更
  ✅ 进化引擎透明可控
  ✅ 查询能深入到代码级
```

### 1.3 知识库专家的核心诉求

| 诉求 | 当前支持 | 影响 |
|------|---------|------|
| **质量可控** | 基础 lint | 无法量化质量，无法持续改进 |
| **变更可追溯** | 无 | 不敢随意更新，怕破坏现有知识 |
| **检索够深** | 摘要级别 | 找不到细节，只能知道"可能有" |
| **知识可维护** | 手动 | 知识会过期，没有提醒机制 |
| **操作可逆** | 无 | 一旦操作错误无法回滚 |

---

## 二、优化方案（按优先级排序）

### Phase 1: 基础体验增强（P0 - 必须做）

**解决的问题:**
1. 用户不知道知识库状态 → 添加 `/memory-status`
2. ingest 是盲操作 → 添加 `/memory-diff`
3. search 和 query 功能重叠 → 合并精简

### Phase 2: 进化引擎可见化（P1 - 重要）

**解决的问题:**
1. 进化引擎是黑盒 → 添加状态查看和控制
2. 用户不知道自动更新发生了什么 → 添加历史记录

### Phase 3: 查询深度增强（P1 - 重要）

**解决的问题:**
1. 只能搜摘要 → 支持全文搜索
2. 搜索结果不精确 → 支持内容片段展示

### Phase 4: 知识维护增强（P2 - 后续）

**解决的问题:**
1. 知识会过期 → 添加过期检测
2. 知识质量无法量化 → 添加质量评分
3. 浏览知识库不方便 → 添加探索命令

---

## Phase 1: 基础体验增强

### Task 1.1: 添加 /memory-status 命令

**为什么需要这个:**
- 用户执行任何操作前，需要知道"我的知识库现在是什么状态"
- 就像 `git status` 是 git 的第一个命令一样，status 是所有管理系统的入口
- 没有 status，用户处于信息盲区

**用户场景:**
```
开发者打开项目，输入: /memory-status

期望看到:
📊 Knowledge Base Status
━━━━━━━━━━━━━━━━━━━━━━━━
Pages: 45 total (12 entities, 15 concepts, 8 sources, 10 synthesis)
Graph: 128 connections, 85% connected
Last Update: 2 hours ago (memory-ingest src/auth/)
Health Score: 92/100 ✅
Evolution Engine: Running (watching 23 files)
Pending Updates: 3 files changed
```

**实现方案:**

**Step 1: 在 plugin.ts 中实现 memory-status 工具**

> ⚠️ **架构决策**: 状态聚合逻辑放在 `plugin.ts` 而非 `KnowledgeBase` 类中，因为：
> 1. 需要访问 `evolutionEngine`（模块级变量）
> 2. 需要使用 `Validator` 类（独立于 KnowledgeBase）
> 3. 保持 `KnowledgeBase` 类职责单一

文件: `src/plugin.ts` - 在 tool 对象中添加新工具

```typescript
"memory-status": tool({
  description: "Get comprehensive knowledge base status including page counts, graph stats, health score, and evolution engine status",
  args: {
    projectPath: tool.schema.string().describe("Project root directory path"),
  },
  async execute(args, context) {
    if (!knowledgeBase) {
      return JSON.stringify({
        success: false,
        error: "Knowledge base not initialized. Run /memory-init first.",
      }, null, 2)
    }
    
    try {
      // 页面计数 - 从图谱获取
      const graph = knowledgeBase.getGraph()
      const pageCounts = await getPageCounts(knowledgeBase.getBasePath())
      
      // 图谱统计
      const graphStats = {
        nodes: graph?.nodes.length ?? 0,
        edges: graph?.edges.length ?? 0,
        connectionRate: calculateConnectionRate(graph),
      }
      
      // 健康检查 - 使用 Validator 类
      const validator = new Validator(knowledgeBase.getBasePath(), graph)
      const lintResult = await validator.validate(false)
      const healthScore = {
        score: Math.max(0, 100 - lintResult.issues.filter(i => i.severity === 'error').length * 10 - lintResult.issues.filter(i => i.severity === 'warning').length * 2),
        errors: lintResult.issues.filter(i => i.severity === 'error').length,
        warnings: lintResult.issues.filter(i => i.severity === 'warning').length,
        level: 'healthy' as const,
      }
      if (healthScore.score < 90) healthScore.level = 'warning'
      if (healthScore.score < 70) healthScore.level = 'critical'
      
      // 进化状态 - 直接访问模块变量
      const pendingChanges = evolutionEngine ? await evolutionEngine.scanForChanges() : []
      const evolutionStatus = {
        running: evolutionEngine?.isRunning?.() ?? false,
        watchedFiles: evolutionEngine?.getWatchedFileCount?.() ?? 0,
        pendingChanges: pendingChanges.length,
        pendingFiles: pendingChanges.slice(0, 10),
      }
      
      // 最后更新时间
      const lastUpdate = await getLastUpdateTime(knowledgeBase.getBasePath())
      
      return JSON.stringify({
        success: true,
        basePath: knowledgeBase.getBasePath(),
        pages: pageCounts,
        graph: graphStats,
        health: healthScore,
        evolution: evolutionStatus,
        lastUpdate,
        initialized: true,
      }, null, 2)
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: (error as Error).message,
      }, null, 2)
    }
  },
}),
```

**Step 2: 添加辅助函数**

在 `plugin.ts` 文件末尾（`loadEvolutionConfig` 函数之后）添加：

```typescript
async function getPageCounts(basePath: string): Promise<PageCounts> {
  const categories = ['entities', 'concepts', 'sources', 'synthesis']
  const counts: Record<string, number> = {}
  
  for (const category of categories) {
    const categoryPath = path.join(basePath, category)
    if (await fileExists(categoryPath)) {
      const files = await listFiles(categoryPath, ['.md'])
      counts[category] = files.length
    } else {
      counts[category] = 0
    }
  }
  
  return {
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    ...counts,
  }
}

function calculateConnectionRate(graph: KnowledgeGraph | null): number {
  if (!graph || graph.nodes.length === 0) return 0
  
  const connectedNodes = new Set<string>()
  for (const edge of graph.edges) {
    connectedNodes.add(edge.from)
    connectedNodes.add(edge.to)
  }
  
  return Math.round((connectedNodes.size / graph.nodes.length) * 100)
}

async function getLastUpdateTime(basePath: string): Promise<string> {
  const logPath = path.join(basePath, 'log.md')
  if (!await fileExists(logPath)) return 'Never'
  
  const stats = await fs.stat(logPath)
  return formatTimeAgo(stats.mtime)
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffDays > 0) return `${diffDays} day(s) ago`
  if (diffHours > 0) return `${diffHours} hour(s) ago`
  return 'Just now'
}
```

**Step 3: 添加必要的导入**

在 `plugin.ts` 文件顶部添加：

```typescript
import path from 'path'
import { promises as fs } from 'fs'
import { fileExists, listFiles } from './utils/file-utils'
```

**Step 4: 添加类型定义**

文件: `src/types/index.ts`

```typescript
export interface KnowledgeBaseStatus {
  success: boolean
  basePath: string
  pages: PageCounts
  graph: GraphStats
  health: HealthScore
  evolution: EvolutionStatus
  lastUpdate: string
  initialized: boolean
}

export interface PageCounts {
  total: number
  entities: number
  concepts: number
  sources: number
  synthesis: number
}

export interface GraphStats {
  nodes: number
  edges: number
  connectionRate: number
}

export interface HealthScore {
  score: number
  errors: number
  warnings: number
  level: 'healthy' | 'warning' | 'critical'
}

export interface EvolutionStatus {
  running: boolean
  watchedFiles?: number
  pendingChanges?: number
  pendingFiles?: string[]
}
```

**Step 5: 创建命令模板**

文件: `commands/memory-status.md`

```markdown
---
description: Show knowledge base status
agent: build
---

Show the current status of the knowledge base.

Please use the `memory-status` tool to get the following information:
- Total page counts by category
- Graph statistics (nodes, edges, connection rate)
- Health score and issues
- Evolution engine status
- Last update time

After receiving the status:

1. **Format it nicely** using markdown tables and emojis
2. **Highlight any issues** (errors in red, warnings in yellow)
3. **Suggest actions** based on the status:
   - If pending changes > 0: suggest running /memory-ingest
   - If health score < 70: suggest running /memory-lint --auto-fix
   - If evolution is not running: suggest checking evolution config
4. **Keep it concise** - focus on what the user needs to know

Project directory: $ARGUMENTS
```

**测试:**
```bash
# 构建
npm run build

# 在已有知识库中测试
# 预期输出: 格式化的状态信息，包含页面数、图谱、健康分、进化引擎状态
```

---

### Task 1.2: 添加 /memory-diff 命令

**为什么需要这个:**
- ingest 现在是盲操作：用户不知道会改什么
- 没有 diff 就没有信任：开发者不敢随意更新知识库
- 变更追踪是知识管理的基本要求

**用户场景:**
```
场景 1: ingest 前预览
  开发者: /memory-diff src/auth/
  看到:
  📋 Preview Changes
  ━━━━━━━━━━━━━━━━━━
  + New Pages (2):
    - jwt-auth (from src/auth/jwt.ts)
    - auth-middleware (from src/auth/middleware.ts)
  
  ~ Updated Pages (1):
    - auth-module (content changed)
  
  - Deleted Pages (0):
  
  Run /memory-ingest src/auth/ to apply these changes

场景 2: ingest 后回顾
  开发者: /memory-diff --last
  看到: 上次 ingest 的变更摘要
```

**实现方案:**

**Step 1: 在 KnowledgeBase 中实现 previewChanges() 方法**

文件: `src/core/knowledge-base.ts`

```typescript
async previewChanges(files: string[]): Promise<ChangePreview> {
  const result: ChangePreview = {
    newPages: [],
    updatedPages: [],
    deletedPages: [],
    unchangedPages: [],
  }
  
  // 1. 检测新增和更新（基于源文件 hash 对比）
  for (const file of files) {
    if (!await fileExists(file)) continue
    
    // 使用正确的方法名：generatePageName 和 determinePageType
    const pageId = this.generatePageName(file)
    const pageType = this.determinePageType(file)
    const category = pageType === 'entity' ? 'entities' : 
                     pageType === 'concept' ? 'concepts' : 
                     pageType === 'source' ? 'sources' : 'synthesis'
    const pagePath = path.join(this.basePath, category, `${pageId}.md`)
    
    // 计算当前源文件 hash
    const content = await fs.readFile(file, 'utf-8')
    const currentHash = this.calculateHash(content)
    
    if (await fileExists(pagePath)) {
      // 页面已存在，检查 hash 是否变更
      const page = await readMarkdownFile(pagePath)
      const existingHash = page?.frontmatter?.source?.hash
      
      if (existingHash !== currentHash) {
        result.updatedPages.push({
          pageId,
          filePath: pagePath,
          sourceFile: file,
          changeType: 'content',
        })
      } else {
        result.unchangedPages.push({ pageId, sourceFile: file })
      }
    } else {
      // 新页面
      result.newPages.push({
        pageId,
        category,
        sourceFile: file,
      })
    }
  }
  
  return result
}
```

> ⚠️ **实现说明**: 
> - 使用 `generatePageName()` 而非 `generatePageId()`（实际代码中的方法名）
> - 使用 `determinePageType()` 而非 `determineCategory()`（实际代码中的方法名）
> - 基于 hash 对比而非预生成内容对比（因为 `generatePageContent` 方法不存在）

**Step 2: 添加工具定义**

文件: `src/plugin.ts`

```typescript
"memory-diff": tool({
  description: "Preview changes before ingesting files into the knowledge base",
  args: {
    projectPath: tool.schema.string().describe("Project root directory path"),
    files: tool.schema.array(tool.schema.string()).describe("Files or directories to preview"),
    last: tool.schema.boolean().optional().describe("Show changes from last ingest operation"),
  },
  async execute(args, context) {
    if (!knowledgeBase) {
      return JSON.stringify({
        success: false,
        error: "Knowledge base not initialized. Run /memory-init first.",
      }, null, 2)
    }
    
    let result: ChangePreview
    
    if (args.last) {
      // 显示上次 ingest 的变更
      result = await knowledgeBase.getLastIngestChanges()
    } else if (args.files && args.files.length > 0) {
      // 预览指定文件的变更
      result = await knowledgeBase.previewChanges(args.files)
    } else {
      // 预览所有待变更文件（通过进化引擎扫描）
      const changedFiles = await evolutionEngine?.scanForChanges() || []
      result = await knowledgeBase.previewChanges(changedFiles)
    }
    
    return JSON.stringify(result, null, 2)
  },
}),
```

**Step 3: 添加类型**

文件: `src/types/index.ts`

```typescript
export interface ChangePreview {
  newPages: Array<{
    pageId: string
    category: string
    sourceFile: string
  }>
  updatedPages: Array<{
    pageId: string
    filePath: string
    sourceFile: string
    changeType: 'content' | 'links' | 'metadata'
  }>
  deletedPages: Array<{
    pageId: string
    filePath: string
  }>
  unchangedPages: Array<{
    pageId: string
    sourceFile: string
  }>
}
```

**Step 4: 命令模板**

文件: `commands/memory-diff.md`

```markdown
---
description: Preview changes before ingesting files
agent: build
---

Preview the changes that would be made when ingesting files into the knowledge base.

Please use the `memory-diff` tool to show what would change.

**Arguments:**
- `files`: The files or directories to preview (from user input)
- `projectPath`: The project root directory

After receiving the preview:

1. **Format as a clear change list** using:
   - `+` for new pages (green)
   - `~` for updated pages (yellow)  
   - `-` for deleted pages (red)
   - `=` for unchanged pages (gray)

2. **Show counts** at the top: "X new, Y updated, Z deleted, W unchanged"

3. **Suggest next steps:**
   - If there are changes: "Run `/memory-ingest <files>` to apply these changes"
   - If no changes: "Knowledge base is up to date"

4. **If `last` flag is used:** Show this as "Last ingest summary"

Files to preview: $ARGUMENTS
```

---

### Task 1.3: 合并 memory-search 和 memory-query

**为什么需要这个:**
- 当前两个命令功能几乎相同，都是调用 `kb.query()`
- search 只返回 ID，query 返回 ID + 摘要
- 用户困惑：该用哪个？
- 维护成本：两处逻辑需要分别更新

**方案:**
- 保留 `memory-query` 作为主查询命令
- 移除 `memory-search` 命令
- 在 `memory-query.md` 中说明支持多种查询模式

**实施步骤:**

**Step 1: 从 plugin.ts 中移除 memory-search 工具**

```typescript
// 删除整个 "memory-search" tool 定义
```

**Step 2: 删除 commands/memory-search.md**

```bash
rm commands/memory-search.md
```

**Step 3: 增强 memory-query 支持多种模式**

修改 `src/plugin.ts` 中的 memory-query-kb 工具:

```typescript
"memory-query-kb": tool({
  description: "Query the knowledge base with natural language. Supports quick ID-only mode and detailed summary mode.",
  args: {
    query: tool.schema.string().describe("Search query string"),
    projectPath: tool.schema.string().describe("Project root directory path"),
    type: tool.schema.enum(["entity", "concept", "source", "synthesis", "all"]).optional().describe("Type of knowledge to search"),
    mode: tool.schema.enum(["quick", "detailed"]).optional().describe("quick: return page IDs only; detailed: return page summaries (default)"),
  },
  async execute(args, context) {
    if (!knowledgeBase) {
      return JSON.stringify({ success: false, error: "Not initialized" }, null, 2)
    }
    
    const includeSummaries = args.mode !== 'quick'
    
    const result = await knowledgeBase.query(args.query, {
      type: args.type,
      includeSummaries,
      maxSummaryLength: includeSummaries ? 500 : 0,
    })
    
    return JSON.stringify(result, null, 2)
  },
}),
```

---

## Phase 2: 进化引擎可见化

### Task 2.1: 添加 /memory-evolve 命令

**为什么需要这个:**
- 进化引擎现在对用户是透明的（看不见的后台进程）
- 用户不知道它在运行，也不知道它做了什么
- 无法控制：不能暂停/恢复/查看历史

**用户场景:**
```
场景 1: 查看状态
  开发者: /memory-evolve status
  看到:
  🔄 Evolution Engine Status
  ━━━━━━━━━━━━━━━━━━━━━━━
  Status: Running ✅
  Watching: 23 files (src/**/*.ts, docs/**/*.md)
  Last Update: 30 min ago
  Updates Today: 5 automatic updates
  Pending Changes: 2 files

场景 2: 暂停
  开发者: /memory-evolve pause
  看到: Evolution engine paused

场景 3: 查看历史
  开发者: /memory-evolve history
  看到: 最近的自动更新记录
```

**实现方案:**

**Step 1: 在 EvolutionEngine 中添加状态方法**

文件: `src/core/evolution-engine.ts`

```typescript
private updateHistory: Array<{
  timestamp: Date
  files: string[]
  createdPages: number
  updatedPages: number
}> = []

isRunning(): boolean {
  return this.watcher !== null
}

getWatchedFileCount(): number {
  return this.fileHashes.size
}

getUpdateHistory(limit: number = 20): Array<any> {
  return this.updateHistory.slice(-limit)
}

async getStatus(): Promise<EvolutionEngineStatus> {
  const pendingChanges = await this.scanForChanges()
  
  return {
    running: this.isRunning(),
    watchedFiles: this.getWatchedFileCount(),
    pendingChanges: pendingChanges.length,
    pendingFiles: pendingChanges.slice(0, 10),
    updateHistory: this.getUpdateHistory(5),
    config: {
      watchPatterns: this.config.watchPatterns,
      ignorePatterns: this.config.ignorePatterns,
      requireApproval: this.config.requireApproval,
    },
  }
}
```

**Step 2: 在 updateKnowledgeBase 中记录历史**

```typescript
private async updateKnowledgeBase(files: string[]): Promise<void> {
  try {
    const result = await this.knowledgeBase.ingestFiles(files)
    
    // 记录更新历史
    this.updateHistory.push({
      timestamp: new Date(),
      files,
      createdPages: result.createdPages.length,
      updatedPages: result.updatedPages.length,
    })
    
    // 保持历史不超过 100 条
    if (this.updateHistory.length > 100) {
      this.updateHistory = this.updateHistory.slice(-100)
    }
    
    // ... 日志输出
  }
}
```

**Step 3: 添加工具定义**

文件: `src/plugin.ts`

```typescript
"memory-evolve": tool({
  description: "View and control the evolution engine (auto-update)",
  args: {
    projectPath: tool.schema.string().describe("Project root directory path"),
    action: tool.schema.enum(["status", "pause", "resume", "history"]).describe("Action to perform"),
  },
  async execute(args, context) {
    if (!evolutionEngine) {
      return JSON.stringify({ success: false, error: "Evolution engine not available" }, null, 2)
    }
    
    switch (args.action) {
      case 'status':
        return JSON.stringify(await evolutionEngine.getStatus(), null, 2)
      
      case 'pause':
        evolutionEngine.stop()
        return JSON.stringify({ success: true, message: "Evolution engine paused" }, null, 2)
      
      case 'resume':
        await evolutionEngine.start()
        return JSON.stringify({ success: true, message: "Evolution engine resumed" }, null, 2)
      
      case 'history':
        return JSON.stringify({
          history: evolutionEngine.getUpdateHistory(20),
        }, null, 2)
      
      default:
        return JSON.stringify({ success: false, error: "Unknown action" }, null, 2)
    }
  },
}),
```

**Step 4: 命令模板**

文件: `commands/memory-evolve.md`

```markdown
---
description: Control the evolution engine (auto-update)
agent: build
---

View and control the evolution engine that automatically updates the knowledge base when source files change.

Please use the `memory-evolve` tool with the following action:

**If no action specified, use "status"**

Available actions:
- `status`: Show evolution engine status
- `pause`: Pause automatic updates
- `resume`: Resume automatic updates  
- `history`: Show recent update history

After receiving the result:

1. **Format the status nicely** with emojis and sections
2. **If paused:** Remind the user that automatic updates are disabled
3. **If history:** Show the most recent updates with timestamps
4. **If errors:** Explain what went wrong and suggest fixes

Project directory: $ARGUMENTS
```

---

## Phase 3: 查询深度增强

### Task 3.1: 添加全文搜索能力

**为什么需要这个:**
- 当前查询只能匹配页面标题和标签
- 用户想知道"这段代码在哪个页面提到过"
- 摘要不足以回答深度问题

**实现方案:**

**Step 1: 在 KnowledgeBase 中添加 searchContent() 方法**

文件: `src/core/knowledge-base.ts`

```typescript
async searchContent(query: string, options?: {
  limit?: number
  contextLength?: number
}): Promise<ContentSearchResult> {
  const limit = options?.limit || 10
  const contextLength = options?.contextLength || 200
  
  const searchTerms = this.tokenizeQuery(query)
  const results: ContentSearchResult = {
    query,
    matches: [],
  }
  
  const categories = ['entities', 'concepts', 'sources', 'synthesis']
  
  for (const category of categories) {
    const categoryPath = path.join(this.basePath, category)
    if (!await fileExists(categoryPath)) continue
    
    const files = await listFiles(categoryPath, ['.md'])
    
    // 并发搜索
    const batches = this.chunkArray(files, 10)
    
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (filePath) => {
          const content = await fs.readFile(filePath, 'utf-8')
          const { data: frontmatter, content: body } = matter(content)
          
          const matches = this.findMatchesInContent(body, searchTerms, contextLength)
          
          if (matches.length > 0) {
            return {
              pageId: path.basename(filePath, '.md'),
              title: frontmatter?.title || path.basename(filePath, '.md'),
              category,
              tags: frontmatter?.tags || [],
              matches,
            }
          }
          return null
        })
      )
      
      results.matches.push(...batchResults.filter(r => r !== null))
    }
  }
  
  // 按匹配数量排序，截取 limit
  results.matches.sort((a, b) => b.matches.length - a.matches.length)
  results.matches = results.matches.slice(0, limit)
  
  return results
}

private findMatchesInContent(
  content: string,
  searchTerms: string[],
  contextLength: number
): Array<{
  term: string
  context: string
  lineNumber: number
}> {
  const lines = content.split('\n')
  const matches: any[] = []
  
  for (const term of searchTerms) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(term)) {
        const start = Math.max(0, i - Math.floor(contextLength / 100))
        const end = Math.min(lines.length, i + Math.ceil(contextLength / 100))
        const context = lines.slice(start, end).join('\n')
        
        matches.push({
          term,
          context: context.length > contextLength 
            ? context.substring(0, contextLength) + '...' 
            : context,
          lineNumber: i + 1,
        })
      }
    }
  }
  
  return matches
}
```

**Step 2: 添加类型**

文件: `src/types/index.ts`

```typescript
export interface ContentSearchResult {
  query: string
  matches: Array<{
    pageId: string
    title: string
    category: string
    tags: string[]
    matches: Array<{
      term: string
      context: string
      lineNumber: number
    }>
  }>
}
```

**Step 3: 在查询方法中集成全文搜索**

修改 `query()` 方法，添加 `searchContent` 选项:

```typescript
// 在 query() 方法中添加分支
if (options?.searchContent) {
  return await this.searchContent(query, {
    limit: options.limit || 10,
    contextLength: 200,
  })
}
```

---

## Phase 4: 知识维护增强（规划）

### Task 4.1: 知识过期检测

**概念:** 
- 定期检查源文件 hash 是否与页面生成时一致
- 标记可能过期的知识页面
- 建议重新摄入

### Task 4.2: 知识质量评分

**概念:**
- 基于多个维度计算知识库质量分数
- 页面连接度（有多少链接）
- 内容完整性
- 更新及时性
- 链接有效性

### Task 4.3: /memory-explore 浏览命令

**概念:**
- 非查询式的知识库浏览
- 按类别/标签浏览
- 查看图谱连接

---

## 三、实施路线图

```
Week 1: Phase 1 基础体验
├── Task 1.1: /memory-status (2天)
├── Task 1.2: /memory-diff (2天)
├── Task 1.3: 合并 search/query (1天)
└── 测试 + 文档 (2天)

Week 2: Phase 2 进化引擎可见化
├── Task 2.1: /memory-evolve (3天)
├── 测试 (1天)
└── Phase 3 查询增强 (3天)

Week 3: Phase 4 + 优化
├── 知识过期检测 (2天)
├── 质量评分 (2天)
├── 性能优化 (2天)
└── 全面测试 (3天)
```

---

## 四、风险评估

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| getStatus 性能慢 | 低 | 中 | 缓存结果，异步计算 |
| diff 计算耗时 | 中 | 中 | 增量计算，只比对指定文件 |
| 全文搜索内存占用 | 低 | 低 | 分批处理，限制并发 |
| 进化引擎状态丢失 | 低 | 高 | 持久化历史到文件 |

---

## 五、预期效果

| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| 状态可见性 | 0% (无) | 100% | 从盲操作到全透明 |
| 变更可追溯 | 0% | 100% | 每次变更有据可查 |
| 查询深度 | 摘要级 | 全文级 | 能找到代码细节 |
| 进化可控性 | 0% | 100% | 随时查看/暂停/恢复 |
| 命令简洁度 | 7个命令 | 5个命令 | 减少认知负担 |

---

## 六、验收标准

### 已完成的修复（CTO 审查发现的问题）

- [x] `QueryOptions` 重复定义 Bug 已修复
- [x] 进化引擎已启动（添加 `start()` 调用）
- [x] 缺失的命令文件已添加（`memory-search.md`, `memory-update.md`）
- [x] `memory-update-kb` 已合并到 `memory-ingest-files`
- [x] 所有 TypeScript 编译通过

### 待实施的功能（Phase 1-4）

- [ ] `/memory-status` 返回完整状态信息（页面数、图谱、健康分、进化状态）
- [ ] `/memory-diff` 能正确预览变更
- [ ] `/memory-evolve status` 显示进化引擎状态
- [ ] `/memory-evolve pause/resume` 能控制进化引擎
- [ ] 全文搜索能匹配页面内容而不仅是标题
- [ ] 在实际知识库中测试通过

---

## 七、总结

这个优化方案的核心思路是：**让 oh-memory 从一个工具集合，变成一个完整的知识管理系统**。

关键改进:
1. **可见化**: 状态、变更、进化引擎全部可见
2. **可控化**: 能暂停进化、能预览变更
3. **深度化**: 查询能深入到代码内容
4. **精简**: 合并重叠命令，减少认知负担

这不仅是功能的增加，更是**用户体验的质变**。
