# Memory Query 性能优化方案 (v2 - 评审修订版)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> 
> **评审状态:** ✅ 有条件批准 - 已根据 CTO 评审意见修订
> **评审文档:** [technical-architecture-20260419-090600.md](file:///d:/workplace/visual/oh-mermory/docs/technical-architecture/technical-architecture-20260419-090600.md)

**Goal:** 解决 memory-query 命令长耗时且无响应的问题，通过实例复用、缓存优化将查询响应时间从分钟级降低到秒级。

**Architecture:** 
1. 使用现有模块级单例复用 `KnowledgeBase` 实例（简化方案，避免 Map 缓存复杂度）
2. 实现图索引的持久化缓存加载，带新鲜度验证机制
3. 纯查询不触发文件写入，避免写风暴
4. 优化查询逻辑，使用排序和相关性评分，支持中英文分词

**Tech Stack:** TypeScript, Bun runtime, 文件系统缓存

---

## 问题分析总结

### 当前性能瓶颈

| 问题 | 严重程度 | 影响 |
|------|---------|------|
| 每次查询创建新 KnowledgeBase 实例 | 严重 | graph 为 null，每次都触发全量 buildGraphIndex() |
| 文件 I/O 串行执行 | 严重 | 100 个文件 = 200+ 次串行 I/O 操作 |
| 同一文件重复读取 | 中等 | readMarkdownFile() + readFile() 读取两次 |
| 写风暴 | 中等 | 每次查询都更新所有页面文件和索引 |
| 图缓存未有效利用 | 中等 | 实例生命周期太短，缓存无法复用 |

### 评审发现的关键简化

**原方案**: 实现 `Map<string, KnowledgeBase>` 缓存系统 + LRU 策略

**评审建议**: OpenCode 是**单项目上下文**插件，直接使用现有模块级单例：

```typescript
// plugin.ts 已有（Line 33-34）:
let knowledgeBase: KnowledgeBase | null = null

// 在插件初始化时创建（Line 54）:
knowledgeBase = new KnowledgeBase(directory)

// 直接使用即可，无需 Map 缓存系统！
```

**收益**: 
- 减少 50% 代码量
- 避免内存管理复杂性
- 降低维护成本

### 优化目标

- **首次查询**: 从 30-60s 降低到 5-10s
- **后续查询**: 从 30-60s 降低到 < 1s
- **无响应问题**: 完全解决，确保查询总能返回结果

---

## 评审批准条件（必须满足）

- [x] **条件 1**: 简化 Task 3 为单例模式，移除 Map 缓存系统
- [x] **条件 2**: 添加缓存新鲜度验证机制
- [x] **条件 3**: 修复 tokenizeQuery 空查询和 n-gram 爆炸问题
- [x] **条件 4**: 纯查询不触发文件写入
- [x] **条件 5**: 测试提前到核心 Task 之后
- [x] **条件 6**: 优先级调整为 Task 3+1 → Task 6 → Task 4 → Task 5 → Task 2 → Task 7

---

## Task 3 (P0): 使用模块级单例复用实例

**目标**: 使用现有的 `knowledgeBase` 单例，避免每次查询都创建新实例

**评审变更**: ✅ 简化方案，移除 Map 缓存和 LRU 策略

**文件:**
- Modify: `src/plugin.ts:33-34, 147-171`

### Step 3.1: 使用现有单例

确认插件已有的单例声明（无需修改）：

```typescript
// src/plugin.ts:33-34（已有代码，保持不变）
let knowledgeBase: KnowledgeBase | null = null
let evolutionEngine: EvolutionEngine | null = null
```

### Step 3.2: 添加初始化确保函数

在插件函数中添加单例初始化保障：

```typescript
// 在 OhMemoryPlugin 函数开头（Line 36 之后）添加：
if (!knowledgeBase) {
  knowledgeBase = new KnowledgeBase(directory)
  
  const evolutionConfig = await loadEvolutionConfig(directory)
  evolutionEngine = new EvolutionEngine(evolutionConfig, knowledgeBase, context)
}
```

**文件位置**: `src/plugin.ts:54-57`，替换原有的直接赋值

### Step 3.3: 修改 memory-query-kb 工具使用单例

将工具改为使用单例而不是创建新实例：

```typescript
"memory-query-kb": tool({
  description: "Query the knowledge base and return relevant information",
  args: {
    query: tool.schema.string().describe("Search query string"),
    projectPath: tool.schema.string().describe("Project root directory path"),
    type: tool.schema.enum(["entity", "concept", "source", "synthesis", "all"]).optional().describe("Type of knowledge to search"),
  },
  async execute(args, context) {
    try {
      // 使用单例而不是创建新实例
      if (!knowledgeBase) {
        return JSON.stringify({
          success: false,
          error: "Knowledge base not initialized. Run /memory-init first.",
        }, null, 2)
      }
      
      const result = await knowledgeBase.query(args.query, { 
        type: args.type 
      })

      return JSON.stringify(result, null, 2)
    } catch (error) {
      return JSON.stringify(
        {
          success: false,
          error: (error as Error).message,
        },
        null,
        2
      )
    }
  },
}),
```

**文件位置**: `src/plugin.ts:147-171`，替换整个工具定义

### Step 3.4: 同步修改其他工具

将所有工具中的 `new KnowledgeBase(args.projectPath)` 替换为使用单例：

- `memory-init-kb`: 保持不变（初始化时需要创建）
- `memory-ingest-files`: 使用单例
- `memory-lint-kb`: 使用单例
- `memory-search`: 使用单例
- `memory-update-kb`: 使用单例

**关键变更点**: 每个工具的 `execute` 方法中，将 `const kb = new KnowledgeBase(args.projectPath)` 替换为使用 `knowledgeBase!`

---

## Task 1 (P0): 添加图缓存加载 + 新鲜度验证

**目标**: 加载 `graph.json` 缓存并验证其新鲜度，避免使用过期数据

**评审变更**: ✅ 新增缓存新鲜度验证机制

**文件:**
- Modify: `src/core/knowledge-base.ts:817-929`
- Modify: `src/types/index.ts` (添加新方法签名)

### Step 1.1: 添加 loadGraphCache() 方法

在 `KnowledgeBase` 类中添加缓存加载方法：

```typescript
// 添加到 KnowledgeBase 类中，位置：buildGraphIndex() 之前（Line 817 之前）
private async loadGraphCache(): Promise<boolean> {
  const graphPath = path.join(this.basePath, 'graph.json')
  
  if (!await fileExists(graphPath)) {
    return false
  }
  
  try {
    const content = await fs.readFile(graphPath, 'utf-8')
    this.graph = JSON.parse(content)
    return true
  } catch (error) {
    console.warn('[oh-memory] Failed to load graph cache:', error)
    return false
  }
}
```

### Step 1.2: 添加缓存新鲜度验证方法

添加验证图缓存是否过期的方法：

```typescript
// 添加在 loadGraphCache() 之后
private async isGraphCacheValid(): Promise<boolean> {
  const graphPath = path.join(this.basePath, 'graph.json')
  
  if (!await fileExists(graphPath)) {
    return false
  }
  
  try {
    const graphStats = await fs.stat(graphPath)
    const graphMtime = graphStats.mtime.getTime()
    
    // 检查知识文件是否有更新
    const categories = ['entities', 'concepts', 'sources', 'synthesis']
    for (const category of categories) {
      const categoryPath = path.join(this.basePath, category)
      if (!await fileExists(categoryPath)) continue
      
      const files = await listFiles(categoryPath, ['.md'])
      for (const file of files) {
        const stats = await fs.stat(file)
        if (stats.mtime.getTime() > graphMtime) {
          // 有文件比图缓存更新，缓存失效
          return false
        }
      }
    }
    
    return true
  } catch (error) {
    console.warn('[oh-memory] Failed to validate graph cache:', error)
    return false
  }
}
```

### Step 1.3: 修改 query() 方法使用缓存 + 验证

```typescript
async query(query: string, options?: { type?: string }): Promise<QueryResult> {
  const queryStart = Date.now()
  
  // 尝试加载或验证缓存
  if (!this.graph) {
    // 缓存不存在，尝试加载
    const loaded = await this.loadGraphCache()
    if (!loaded) {
      // 加载失败，需要构建
      await this.buildGraphIndex()
    }
  } else {
    // 缓存存在，验证新鲜度
    const isValid = await this.isGraphCacheValid()
    if (!isValid) {
      // 缓存过期，重新构建
      await this.buildGraphIndex()
    }
  }

  const results: QueryResult = {
    query,
    answer: '',
    sources: [],
    relatedPages: [],
  }

  if (!this.graph) {
    return results
  }

  // 处理搜索词（支持中英文）
  const searchTerms = this.tokenizeQuery(query)
  
  if (searchTerms.length === 0) {
    return results
  }
  
  // 计算分数并排序
  const scoredPages = this.graph.nodes
    .map(node => ({
      id: node.id,
      score: this.calculateMatchScore(node, searchTerms),
      type: node.type,
    }))
    .filter(item => item.score > 0)
    .filter(item => !options?.type || item.type === options.type || options.type === 'all')
    .sort((a, b) => b.score - a.score)
  
  results.relatedPages = scoredPages.slice(0, 10).map(item => item.id)
  results.sources = scoredPages.slice(0, 5).map(item => item.id)

  const duration = Date.now() - queryStart
  if (duration > 100) {
    console.log(`[oh-memory] Query "${query.substring(0, 30)}${query.length > 30 ? '...' : ''}": ${duration}ms, ${results.relatedPages.length} results`)
  }

  return results
}
```

**文件位置**: `src/core/knowledge-base.ts:817-841`，替换整个 query() 方法

### Step 1.4: 添加 tokenizeQuery 方法（修复边界问题）

```typescript
// 添加在 calculateMatchScore() 方法之前
private tokenizeQuery(query: string): string[] {
  const lower = query.toLowerCase().trim()
  
  // 处理空查询
  if (!lower) {
    return []
  }
  
  // 尝试按空格分割（英文）
  const spaceTokens = lower.split(/\s+/).filter(t => t.length > 0)
  
  if (spaceTokens.length > 1) {
    return spaceTokens
  }
  
  // 如果是中文或单个词，返回原始词和字符 n-gram
  const terms = [lower]
  
  // 添加 2-gram（适用于中文），限制最多 10 个
  if (lower.length > 2) {
    const maxGrams = Math.min(10, lower.length - 1)
    for (let i = 0; i < maxGrams; i++) {
      terms.push(lower.substring(i, i + 2))
    }
  }
  
  return terms
}
```

**文件位置**: `src/core/knowledge-base.ts`，在 calculateMatchScore() 之前添加

---

## Task 6 (P1): 测试验证

**目标**: 验证优化效果，确保功能正常

**评审变更**: ✅ 测试提前到核心 Task 之后

### Step 6.1: 构建项目

```bash
npm run build
```

**预期**: 编译成功，无 TypeScript 错误

### Step 6.2: 测试查询响应时间

在已有的知识库项目中执行查询测试：

```bash
# 首次查询（应该加载缓存或构建）
opencode-query "项目架构是什么"

# 第二次查询（应该使用缓存，速度更快）
opencode-query "如何添加新功能"
```

**预期**:
- 首次查询: 5-10s（如果图不存在）或 < 1s（如果图已缓存）
- 后续查询: < 1s
- 能看到性能日志输出（仅当耗时 > 100ms）

### Step 6.3: 验证查询结果

检查返回的 JSON 结果：

```json
{
  "query": "项目架构",
  "answer": "",
  "sources": ["architecture", "module-structure"],
  "relatedPages": ["architecture", "module-structure", "tech-stack"]
}
```

**预期**:
- relatedPages 按相关性排序
- sources 包含最相关的页面
- 响应时间 < 1s

### Step 6.4: 内存稳定性检查

连续执行 10 次查询，检查内存使用情况：

```bash
# 监控内存（使用系统监控工具）
tasklist /FI "IMAGENAME eq node.exe" /FO LIST
```

**预期**: 内存使用稳定，不持续增长

### Step 6.5: 缓存验证测试

1. 执行一次查询，确认使用缓存
2. 修改 `.memory/entities/` 下的某个文件
3. 再次执行查询，确认缓存失效并重建

**预期**: 第二步查询耗时较长（重建图），第三步查询快速（使用新缓存）

---

## Task 4 (P2): 优化写风暴

**目标**: 纯查询不触发任何文件写入，只在必要时更新图索引

**评审变更**: ✅ 完善所有写操作优化，不仅仅是 populateReverseRelations

**文件:**
- Modify: `src/core/knowledge-base.ts:858-929, 993-1056`

### Step 4.1: 分离查询和构建逻辑

修改 `buildGraphIndex()` 为两个版本：

```typescript
// 纯查询用的轻量级图加载（不触发写入）
private async loadGraphForQuery(): Promise<boolean> {
  // 尝试从缓存加载
  const loaded = await this.loadGraphCache()
  if (loaded && await this.isGraphCacheValid()) {
    return true
  }
  
  // 缓存无效，需要重建
  await this.buildGraphIndex()
  return this.graph !== null
}

// buildGraphIndex() 保持不变，但优化写入行为
```

### Step 4.2: 优化 generateGraphIndexes() 减少写入

修改 generateGraphIndexes() 方法签名，添加写入控制选项：

```typescript
private async generateGraphIndexes(
  pages: Map<string, any>,
  connectionStats: Map<string, ConnectionStats>,
  options: { 
    updateRelations: boolean
    generateIndexes: boolean
  } = { updateRelations: true, generateIndexes: true }
): Promise<void> {
  // 只在需要时更新反向关联
  if (options.updateRelations) {
    await this.populateReverseRelations(pages, connectionStats)
  }
  
  // 只在需要时生成索引文件
  if (options.generateIndexes) {
    await this.generateMainIndex(pages, connectionStats)
    await this.generateLayerIndexes(pages, connectionStats)
    await this.generateDOTFile(pages, connectionStats)
    await this.generateInteractiveHTML(pages, connectionStats)
  }
}
```

**文件位置**: `src/core/knowledge-base.ts:993-1002`，替换方法签名

### Step 4.3: buildGraphIndex() 中控制写入行为

修改 buildGraphIndex() 调用 generateGraphIndexes 的部分：

```typescript
// 查找这一行（Line 923）：
await this.generateGraphIndexes(pages, connectionStats)

// 替换为：
const hasChanges = updatePlan.addedNodes.length > 0 || updatePlan.updatedNodes.length > 0
await this.generateGraphIndexes(pages, connectionStats, { 
  updateRelations: hasChanges,
  generateIndexes: hasChanges
})
```

### Step 4.4: 优化 updatePagesWithConnectionStats()

修改 updatePagesWithConnectionStats() 只在有变更时执行：

```typescript
// 在 buildGraphIndex() 中查找（Line 913-915）：
if (shouldRebuild || updatePlan.updatedNodes.length > 0) {
  await this.updatePagesWithConnectionStats(pages, connectionStats)
}

// 保持不变，已经有条件执行
```

---

## Task 5 (P2): 添加性能监控

**目标**: 记录查询耗时，便于调试和监控

**文件:**
- Modify: `src/core/knowledge-base.ts:817-841`
- Modify: `src/plugin.ts` (可选)

### Step 5.1: 智能日志输出

已在 Task 1 的 Step 1.3 中实现：

```typescript
// 只在耗时 > 100ms 时输出日志
const duration = Date.now() - queryStart
if (duration > 100) {
  console.log(`[oh-memory] Query "${query.substring(0, 30)}${query.length > 30 ? '...' : ''}": ${duration}ms, ${results.relatedPages.length} results`)
}
```

### Step 5.2: 图构建日志

在 buildGraphIndex() 末尾添加日志：

```typescript
// 在 buildGraphIndex() 末尾（Line 928 之后）
const duration = Date.now() - startTime
if (duration > 500) {
  console.log(`[oh-memory] Graph build: ${duration}ms, ${pages.size} pages`)
}
```

---

## Task 2 (P3): 并发优化文件 I/O

**目标**: 将 `buildGraphIndex()` 中的串行文件读取改造为并发执行

**评审变更**: ✅ 优先级降低到 P3，实例复用后只在首次查询时触发

**文件:**
- Modify: `src/core/knowledge-base.ts:858-929`

### Step 2.1: 并发读取文件

将 buildGraphIndex() 中的文件读取部分改为并发：

```typescript
// 收集所有文件路径后，使用 Promise.all 并发读取
const allFiles: Array<{ category: string; path: string }> = []

for (const category of categories) {
  const categoryPath = path.join(this.basePath, category)
  
  if (!await fileExists(categoryPath)) {
    continue
  }

  const files = await listFiles(categoryPath, ['.md'])
  for (const file of files) {
    allFiles.push({ category, path: file })
  }
}

// 并发读取所有文件（限制并发数）
const CONCURRENCY_LIMIT = 10
const batches = this.chunkArray(allFiles, CONCURRENCY_LIMIT)

for (const batch of batches) {
  const results = await Promise.all(
    batch.map(async ({ path: filePath }) => {
      const page = await readMarkdownFile(filePath)
      if (!page) return null
      
      const stats = await fs.stat(filePath)
      const content = await fs.readFile(filePath, 'utf-8')
      const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 16)
      
      return { filePath, page, stats, hash }
    })
  )
  
  // 处理结果
  for (const result of results) {
    if (!result) continue
    
    const { filePath, page, stats, hash } = result
    const pageId = path.basename(filePath, '.md')
    
    pages.set(pageId, {
      links: page.links,
      metadata: page.frontmatter,
      filePath,
    })
    
    fileHashes.set(filePath, {
      hash,
      lastModified: stats.mtime.toISOString(),
      pageId,
    })
  }
}
```

**文件位置**: `src/core/knowledge-base.ts:858-895`，替换这部分代码

### Step 2.2: 添加 chunkArray 辅助方法

```typescript
// 添加到类末尾
private chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
```

**文件位置**: `src/core/knowledge-base.ts`，类末尾

---

## Task 7 (P4): 更新类型定义

**目标**: 更新 QueryOptions 类型定义

**文件:**
- Modify: `src/types/index.ts:115-120`

### Step 7.1: 添加 QueryOptions 接口

```typescript
// 在 QueryResult 接口后添加
export interface QueryOptions {
  type?: 'entity' | 'concept' | 'source' | 'synthesis' | 'all'
  limit?: number
  includeContent?: boolean
}
```

**文件位置**: `src/types/index.ts:120` 之后

### Step 7.2: 更新 QueryResult 接口（可选）

```typescript
export interface QueryResult {
  query: string
  answer: string
  sources: string[]
  relatedPages: string[]
  duration?: number  // 可选：添加响应时间
}
```

---

## 实施顺序（评审修订版）

```
Phase 1: 核心优化 (P0)
├── Task 3: 使用模块级单例        ██████████  解决根本问题
└── Task 1: 缓存加载 + 验证        ██████████  核心基础
          ↓
Phase 2: 测试验证 (P1)
└── Task 6: 测试验证              ██████████  质量保证
          ↓
Phase 3: 写操作优化 (P2)
├── Task 4: 优化写风暴            ████████    减少 I/O
└── Task 5: 性能监控              ██████      可观测性
          ↓
Phase 4: 次要优化 (P3-P4)
├── Task 2: 并发 I/O              ██████      性能提升（收益降低）
└── Task 7: 类型更新              ██          类型安全
```

**建议执行步骤**:
1. 实施 Task 3 + Task 1（核心优化）
2. 立即执行 Task 6（测试验证效果）
3. 如果测试通过，实施 Task 4 + Task 5
4. 最后实施 Task 2 + Task 7

---

## 预期效果

| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| 首次查询 | 30-60s | 5-10s | 6x |
| 后续查询 | 30-60s | < 1s | 30x+ |
| 文件 I/O 次数 | 200+ | 0 (缓存命中) | ∞ |
| 内存占用 | 每次新建 | 单例复用 | 稳定 |
| 无响应问题 | 经常发生 | 不再发生 | 100% |

---

## 风险和缓解措施（评审修订版）

| 风险 | 影响 | 缓解措施 | 状态 |
|------|------|---------|------|
| graph.json 损坏 | 查询失败 | 自动重新构建 + 警告日志 | ✅ 已处理 |
| 缓存不一致 | 数据过时 | 新鲜度验证 + 自动刷新 | ✅ 已处理 |
| 空查询/长查询 | 性能问题 | tokenizeQuery 边界处理 | ✅ 已处理 |
| 并发 I/O 过多 | 系统负载高 | 限制并发数为 10 | ✅ 已处理 |
| 日志输出过多 | 干扰用户 | 只在 > 100ms 时输出 | ✅ 已处理 |

---

## 评审意见对照表

| 评审意见 | 原方案 | 修订版 | 状态 |
|---------|--------|--------|------|
| Task 3 内存泄漏 | Map 缓存无限制 | 使用模块级单例 | ✅ 已解决 |
| Task 1 缓存一致性 | 无验证机制 | 添加 isGraphCacheValid() | ✅ 已解决 |
| Task 2 并发 I/O | Node.js 兼容层 | 保持但降级优先级 | ✅ 已调整 |
| tokenizeQuery 边界 | 空查询返回 [''] | 返回 []，限制 n-gram | ✅ 已解决 |
| Task 4 不完整 | 只优化部分写入 | 优化所有写入操作 | ✅ 已完善 |
| 日志控制 | 无级别控制 | > 100ms 才输出 | ✅ 已解决 |
| 测试位置 | Task 6 最后 | Task 6 提前到 P1 | ✅ 已调整 |
| 实施顺序 | 1+3 → 2 → 4+5 → 6+7 | 3+1 → 6 → 4 → 5 → 2 → 7 | ✅ 已调整 |

---

## 后续优化方向（不在本次范围内）

1. **向量搜索引擎**: 集成轻量级向量搜索（如 ml-distance）
2. **增量索引**: 只更新变更的文件
3. **查询结果缓存**: 缓存相同查询的结果
4. **后台索引构建**: 使用 Web Worker 或后台线程
5. **多项目支持**: 如需支持多项目，添加 LRU 缓存淘汰策略
