# Memory Query 性能优化 - 技术架构评审报告

> **评审人**: 技术架构智能体 (CTO Role)
> **评审日期**: 2026-04-19
> **评审对象**: [2026-04-19-memory-query-performance-optimization.md](file:///d:/workplace/visual/oh-mermory/docs/plans/2026-04-19-memory-query-performance-optimization.md)
> **评审结论**: **有条件批准** (详见结论部分)

---

## 一、总体评价

本方案准确识别了当前性能瓶颈的核心问题：每次查询都创建新的 `KnowledgeBase` 实例，导致 `graph` 始终为 `null`，进而触发全量 `buildGraphIndex()`。优化方向基本正确，但在并发安全、缓存一致性、内存管理和边界情况处理上存在需要修正的缺陷。

---

## 二、方案优点

### 2.1 问题分析准确
- 正确识别了"每次查询创建新实例"是根本原因。现有代码中 [plugin.ts:L156](file:///d:/workplace/visual/oh-mermory/src/plugin.ts#L156) 每次 `memory-query-kb` 调用都执行 `new KnowledgeBase(args.projectPath)`，`graph` 字段始终为初始值 `null`（见 [knowledge-base.ts:L41](file:///d:/workplace/visual/oh-mermory/src/knowledge-base.ts#L41)），这确实导致每次查询都重建图索引。
- 性能瓶颈排序合理，实例复用 > 缓存加载 > 并发 I/O > 减少写操作，优先级正确。

### 2.2 优化目标合理
- 首次查询 5-10s、后续查询 < 1s 的目标在技术上是可实现的。
- 使用 `graph.json` 持久化缓存的方案简单有效，避免了重建图结构的开销。

### 2.3 方案模块化设计
- 7 个 Task 划分清晰，依赖关系明确。建议的执行顺序（Task 1+3 → Task 2 → Task 4+5 → Task 6+7）合理。

### 2.4 风险意识
- 方案末尾列出了风险和缓解措施，显示了风险意识。

---

## 三、方案缺陷和风险

### 3.1 【严重】Task 3: 实例复用缓存的内存泄漏风险

**问题描述**:

方案使用简单的 `Map<string, KnowledgeBase>` 作为实例缓存，没有 TTL、LRU 或大小限制。

```typescript
// 方案中的代码 - 问题代码
const knowledgeBaseCache = new Map<string, KnowledgeBase>()
function getOrCreateKnowledgeBase(projectPath: string): KnowledgeBase {
  if (!knowledgeBaseCache.has(projectPath)) {
    knowledgeBaseCache.set(projectPath, new KnowledgeBase(projectPath))
  }
  return knowledgeBaseCache.get(projectPath)!
}
```

**风险**:
1. **Map 无限增长**: 每个不同的 `projectPath` 都会在缓存中创建一个 `KnowledgeBase` 实例，永远不会被清除。在多项目环境中，缓存会持续增长。
2. **KnowledgeBase 持有的引用链**: 每个 `KnowledgeBase` 实例持有 `graph` (可能包含数百上千个节点)、`updater`、`orchestrator`、`analyzer` 的引用。这些对象的内存占用不可忽略。
3. **Bun 进程的长期运行**: 作为 OpenCode 插件，进程可能长时间运行。没有清理策略的缓存会逐渐成为内存负担。

**影响**: 在单用户单项目场景下，风险较低（只有一个实例）。但如果用户频繁切换项目，内存会持续累积。

### 3.2 【严重】Task 1: 缓存一致性问题

**问题描述**:

方案中的 `loadGraphCache()` 只加载 `graph.json`，但没有考虑以下情况：

1. **外部修改导致的数据不一致**: 其他工具（如 `memory-ingest-files`、`memory-update-kb`）可能修改了 `.memory/` 目录下的文件，但 `graph.json` 仍然是旧的。缓存实例中的 `graph` 不会自动刷新。

2. **现有代码的变更检测机制被绕过**: 当前 [buildGraphIndex()](file:///d:/workplace/visual/oh-mermory/src/core/knowledge-base.ts#L897-L903) 使用了 `updater.detectChanges(fileHashes)` 来检测文件变更。如果直接加载缓存而不运行变更检测，缓存可能过期。

3. **并发写入的竞态条件**: 在 Bun 的单线程事件循环中，虽然不会出现真正的并行，但多个异步操作可能导致 `graph.json` 的读写时序问题。例如，一个查询正在加载缓存时，另一个操作正在写入新的 `graph.json`。

**影响**: 查询结果可能不准确，返回过时的知识页面。

### 3.3 【中等】Task 2: 并发 I/O 在 Bun 环境下的表现

**问题描述**:

1. **Bun 的 I/O 模型**: Bun 使用自己的文件系统 API (`Bun.file()`)，比 Node.js 的 `fs.promises` 性能更好。但方案使用的是 Node.js 兼容层的 `fs.readFile`，没有利用 Bun 的原生优势。

2. **并发限制策略过于简单**: 使用 `chunkArray` + `Promise.all` 的批量并发方式，每批 10 个文件串行执行。这种方式不够灵活：
   - 如果某一批中有 1 个文件读取特别慢，整批都会阻塞
   - 没有考虑 I/O 错误重试

3. **`readMarkdownFile` 和 `fs.readFile` 的双重读取**: 当前代码中 [knowledge-base.ts:L875-L886](file:///d:/workplace/visual/oh-mermory/src/core/knowledge-base.ts#L875-L886) 对同一文件执行两次读取。方案没有解决这个问题（虽然提到了，但没有实现）。

**影响**: 并发优化效果可能不如预期，在大量小文件场景下改善有限。

### 3.4 【中等】Task 1: `tokenizeQuery` 方法的边界情况

**问题描述**:

```typescript
private tokenizeQuery(query: string): string[] {
  const lower = query.toLowerCase()
  const spaceTokens = lower.split(/\s+/).filter(t => t.length > 0)
  
  if (spaceTokens.length > 1) {
    return spaceTokens
  }
  
  // 单个词生成 n-gram
  const terms = [lower]
  if (lower.length > 2) {
    for (let i = 0; i < lower.length - 1; i++) {
      terms.push(lower.substring(i, i + 2))
    }
  }
  return terms
}
```

**边界问题**:
1. **空查询**: 如果 `query` 为空字符串或全是空格，`spaceTokens` 为空数组（length=0），会进入 n-gram 分支但 `lower.length` 为 0，最终返回 `['']`，包含一个空字符串。
2. **n-gram 数量爆炸**: 对于长中文查询（如 50 个字符），会生成 49 个 2-gram + 原始词 = 50 个搜索词，对每个节点都要匹配 50 次。
3. **`calculateMatchScore` 使用 `any` 类型**: 方案中 `node: any` 应该使用 `KnowledgeNode` 类型。

### 3.5 【中等】Task 4: `populateReverseRelations` 优化不完整

**问题描述**:

方案通过 `updateRelations` 参数控制是否调用 `populateReverseRelations`，但没有解决根本问题：

1. **`updatePagesWithConnectionStats` 也是写操作**: [knowledge-base.ts:L976-L991](file:///d:/workplace/visual/oh-mermory/src/core/knowledge-base.ts#L976-L991) 同样会写回所有页面文件。方案没有提到优化这个。

2. **`generateGraphIndexes` 还包含 4 个文件生成操作**: `generateMainIndex`、`generateLayerIndexes`、`generateDOTFile`、`generateInteractiveHTML`，这些每次都会写文件。

3. **缓存场景下的过度写入**: 如果只是从缓存加载图并查询，根本不需要执行 `buildGraphIndex()`，自然也不会触发这些写操作。方案没有充分利用"纯查询不需要重建索引"这一前提。

### 3.6 【轻微】性能日志的日志级别和输出控制

**问题描述**:

方案中的 `console.log` 没有日志级别控制。在生产环境中：
- 每次查询都打印日志会产生大量输出
- 没有考虑日志开关或级别配置
- 使用了字符串截取 `query.substring(0, 30)` 但没有处理空查询

---

## 四、被忽略的更简单解决方案

### 4.1 最简方案：利用现有模块级单例

现有代码 [plugin.ts:L33-L34](file:///d:/workplace/visual/oh-mermory/src/plugin.ts#L33-L34) 已经有模块级变量 `knowledgeBase`，在插件初始化时 [plugin.ts:L54](file:///d:/workplace/visual/oh-mermory/src/plugin.ts#L54) 创建了实例。

**更简单的方案**: 直接使用这个已有实例，而不是创建新的 Map 缓存系统。将 `memory-query-kb` 工具改为：

```typescript
"memory-query-kb": tool({
  async execute(args, context) {
    // 直接使用插件级实例，不需要 projectPath 参数
    const result = await knowledgeBase!.query(args.query)
    return JSON.stringify(result, null, 2)
  }
})
```

这只需要修改 tool 的 execute 方法，不需要新增缓存 Map、辅助函数等。

**为什么方案选择了更复杂的路径**: 方案可能考虑了多项目支持（通过 `projectPath` 区分不同项目）。但 OpenCode 插件的上下文是单项目的（`directory` 是固定的），当前架构下多项目支持不是必需。

### 4.2 图缓存加载可以集成到现有 `buildGraphIndex`

方案新增了独立的 `loadGraphCache()` 方法。但更优雅的做法是在 `buildGraphIndex()` 入口处检查 `graph.json` 是否存在，如果存在且无变更则直接加载。这样不需要修改 `query()` 方法的逻辑。

### 4.3 `memory-search` 工具是冗余的

[plugin.ts:L202-L225](file:///d:/workplace/visual/oh-mermory/src/plugin.ts#L202-L225) 中的 `memory-search` 工具与 `memory-query-kb` 功能完全重复，只是调用了同一个 `kb.query()` 方法。应该合并或废弃其中一个。

---

## 五、改进建议

### 5.1 Task 3 改进：增加缓存清理策略

```typescript
// 改进方案：带 LRU 的实例缓存
const MAX_CACHE_SIZE = 5
const knowledgeBaseCache = new Map<string, { kb: KnowledgeBase; lastUsed: number }>()

function getOrCreateKnowledgeBase(projectPath: string): KnowledgeBase {
  const cached = knowledgeBaseCache.get(projectPath)
  if (cached) {
    cached.lastUsed = Date.now()
    return cached.kb
  }
  
  // 如果缓存已满，淘汰最久未使用的
  if (knowledgeBaseCache.size >= MAX_CACHE_SIZE) {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    for (const [key, value] of knowledgeBaseCache) {
      if (value.lastUsed < oldestTime) {
        oldestTime = value.lastUsed
        oldestKey = key
      }
    }
    if (oldestKey) {
      knowledgeBaseCache.delete(oldestKey)
    }
  }
  
  const kb = new KnowledgeBase(projectPath)
  knowledgeBaseCache.set(projectPath, { kb, lastUsed: Date.now() })
  return kb
}
```

### 5.2 Task 1 改进：增加缓存版本和变更检测

```typescript
private async loadGraphCache(): Promise<boolean> {
  const graphPath = path.join(this.basePath, 'graph.json')
  
  if (!await fileExists(graphPath)) {
    return false
  }
  
  try {
    const content = await fs.readFile(graphPath, 'utf-8')
    this.graph = JSON.parse(content)
    
    // 加载缓存后，仍然需要检查文件是否有变更
    // 通过快速扫描文件修改时间来验证
    const isStale = await this.checkGraphStaleness()
    if (isStale) {
      this.graph = null
      return false
    }
    
    return true
  } catch (error) {
    console.warn('[oh-memory] Failed to load graph cache:', error)
    return false
  }
}

private async checkGraphStaleness(): Promise<boolean> {
  // 快速检查：比较 graph.json 的修改时间与知识文件的最新修改时间
  const graphPath = path.join(this.basePath, 'graph.json')
  const graphStats = await fs.stat(graphPath)
  const graphMtime = graphStats.mtimeMs
  
  const categories = ['entities', 'concepts', 'sources', 'synthesis']
  for (const category of categories) {
    const categoryPath = path.join(this.basePath, category)
    if (!await fileExists(categoryPath)) continue
    
    const files = await listFiles(categoryPath, ['.md'])
    for (const file of files) {
      const stats = await fs.stat(file)
      if (stats.mtimeMs > graphMtime) {
        return true // 有文件比 graph.json 更新
      }
    }
  }
  return false
}
```

### 5.3 Task 2 改进：使用 Bun 原生 API + 合并文件读取

```typescript
// 使用 Bun.file() 并发读取，性能更好
const results = await Promise.all(
  allFiles.map(async ({ category, path: filePath }) => {
    // Bun.file() 返回 File 对象，不会立即读取，由 text() 触发 I/O
    const bunFile = Bun.file(filePath)
    const [content, stats] = await Promise.all([
      bunFile.text(),
      fs.stat(filePath),
    ])
    
    // 手动解析 markdown 内容，避免二次读取
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
    const frontmatter = frontmatterMatch 
      ? parseFrontmatter(frontmatterMatch[1]) 
      : {}
    const bodyContent = frontmatterMatch ? frontmatterMatch[2] : content
    
    // 提取 wiki 链接
    const links = extractWikiLinks(content)
    
    return {
      filePath,
      links,
      frontmatter,
      content: bodyContent,
      hash: this.calculateHash(content),
      stats,
    }
  })
)
```

### 5.4 Task 1 改进：修复 tokenizeQuery 边界情况

```typescript
private tokenizeQuery(query: string): string[] {
  const trimmed = query.trim()
  if (trimmed.length === 0) {
    return [] // 空查询返回空数组
  }
  
  const lower = trimmed.toLowerCase()
  const spaceTokens = lower.split(/\s+/).filter(t => t.length > 0)
  
  if (spaceTokens.length > 1) {
    return spaceTokens
  }
  
  // 单个词：限制 n-gram 数量
  const terms: string[] = [lower]
  
  // 仅对中等长度的词生成 n-gram，限制最多 10 个
  if (lower.length > 2 && lower.length <= 20) {
    const maxNgrams = Math.min(lower.length - 1, 10)
    for (let i = 0; i < maxNgrams; i++) {
      terms.push(lower.substring(i, i + 2))
    }
  }
  
  return terms
}
```

### 5.5 Task 4 改进：纯查询不触发任何写操作

当从缓存加载图并只执行查询时，不应调用 `buildGraphIndex()`。修改 `query()` 方法：

```typescript
async query(query: string, options?: { type?: string }): Promise<QueryResult> {
  if (!this.graph) {
    // 先尝试加载缓存
    const loaded = await this.loadGraphCache()
    if (!loaded) {
      // 缓存不存在或过期，才需要完整构建
      await this.buildGraphIndex()
    }
  }
  // 注意：这里不调用 buildGraphIndex() 的后续逻辑
  // 纯查询只需要 graph.nodes 和 graph.edges，不需要更新文件或生成索引
  // ...
}
```

### 5.6 Task 5 改进：使用结构化日志

```typescript
// 添加日志级别控制
const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }
let currentLogLevel = LOG_LEVELS.INFO

function log(level: number, message: string, data?: Record<string, unknown>) {
  if (level >= currentLogLevel) {
    console.log(`[oh-memory] ${message}`, data ? JSON.stringify(data) : '')
  }
}

// 使用示例
log(LOG_LEVELS.DEBUG, 'Query completed', { 
  query: query.substring(0, 30), 
  duration: queryDuration,
  resultCount: results.relatedPages.length 
})
```

---

## 六、测试策略评审

### 6.1 当前测试方案的问题

方案中 Task 6 的测试仅包含手动测试，缺少：

1. **单元测试**: `tokenizeQuery`、`calculateMatchScore`、`loadGraphCache` 等核心方法需要单元测试覆盖。

2. **并发安全测试**: 需要验证多个并发查询不会导致 `graph.json` 损坏或数据不一致。

3. **内存泄漏测试**: 方案提到"连续执行 10 次查询"，但方法不明确。应该使用 `process.memoryUsage()` 在查询前后对比：

```typescript
const before = process.memoryUsage()
for (let i = 0; i < 50; i++) {
  await kb.query(`test query ${i}`)
}
const after = process.memoryUsage()
console.log('Heap growth:', after.heapUsed - before.heapUsed)
```

4. **缓存一致性测试**: 需要在修改知识文件后验证缓存是否正确刷新。

5. **性能基准测试**: 应该有量化的基准测试，而不是仅凭肉眼观察。

### 6.2 建议的测试矩阵

| 测试场景 | 测试方法 | 通过标准 |
|---------|---------|---------|
| 空查询 | `query("")` | 返回空结果，不崩溃 |
| 中文查询 | `query("项目架构")` | 正确匹配相关页面 |
| 混合查询 | `query("如何 init KB")` | 中英文都能匹配 |
| 缓存命中 | 连续两次相同查询 | 第二次 < 100ms |
| 缓存过期 | 修改文件后查询 | 自动重建索引 |
| 缓存损坏 | 破坏 graph.json 后查询 | 自动重建，不崩溃 |
| 并发查询 | 10 个并发查询 | 全部正确返回 |
| 内存稳定性 | 50 次查询后对比内存 | 堆内存增长 < 10MB |
| 大知识库 | 1000+ 页面 | 首次查询 < 15s |

---

## 七、优先级调整建议

| 原 Task | 原优先级 | 调整后优先级 | 理由 |
|---------|---------|-------------|------|
| Task 3: 实例复用 | P1 | P1 | 根本问题，保持不变 |
| Task 1: 缓存加载 | P1 | P1 | 核心基础，保持不变 |
| Task 2: 并发 I/O | P2 | P3 | 在实例复用 + 缓存命中后，并发 I/O 只在首次查询时触发，重要性降低 |
| Task 4: 写风暴优化 | P3 | P2 | 纯查询场景下不会触发写操作，但如果缓存未命中仍会写，需要优化 |
| Task 5: 性能监控 | P4 | P4 | 可观测性重要但非阻塞 |
| Task 6: 测试验证 | P5 | P1 | 测试应与代码同步实施，而非最后 |
| Task 7: 类型更新 | P6 | P5 | 类型安全，可以最后做 |

**建议的新实施顺序**:
1. Task 3 + Task 1（核心优化，解决根本问题）
2. Task 6（测试框架建立）
3. Task 4（减少不必要的写操作）
4. Task 5（添加性能监控）
5. Task 2（并发 I/O 优化，收益相对较小）
6. Task 7（类型完善）

---

## 八、评审总结

### 方案优点
1. 问题定位准确，优化方向正确
2. 模块化设计，便于分步实施
3. 优化目标现实可达
4. 有风险意识

### 方案缺陷和风险
1. **内存泄漏风险**: 无限制的 Map 缓存在多项目场景下会持续增长
2. **缓存一致性风险**: 没有缓存验证和过期检测机制
3. **并发 I/O 方案未充分利用 Bun 特性**: 使用 Node.js 兼容层而非 Bun 原生 API
4. **边界情况处理不足**: 空查询、长查询 n-gram 爆炸、类型安全
5. **写风暴优化不完整**: 遗漏了 `updatePagesWithConnectionStats` 和 4 个索引生成操作
6. **日志缺乏级别控制**

### 被忽略的更简单方案
1. 直接使用现有的模块级 `knowledgeBase` 单例，不需要新建 Map 缓存
2. 纯查询场景下不需要调用 `buildGraphIndex()`，可以避免所有写操作

### 改进建议核心要点
1. 实例缓存必须增加 LRU/TTL 清理策略（MAX_CACHE_SIZE = 5）
2. 缓存加载后必须验证文件新鲜度（`checkGraphStaleness`）
3. 纯查询不触发任何文件写入
4. `tokenizeQuery` 需要处理空查询和限制 n-gram 数量
5. 测试应与代码同步实施，而非最后

---

## 九、评审结论

### 是否批准实施：**有条件批准**

**批准条件**:
1. 必须增加实例缓存的 LRU 清理策略（5.1 节）
2. 必须增加缓存一致性验证机制（5.2 节）
3. `tokenizeQuery` 必须处理空查询边界（5.4 节）
4. 必须补充单元测试覆盖核心方法
5. 优先级调整为：Task 3+1 → Task 6 → Task 4 → Task 5 → Task 2 → Task 7

**不满足上述条件时，建议重新设计后再次评审。**

---

*评审完成。此文档已保存至 `docs/technical-architecture/` 目录。*
