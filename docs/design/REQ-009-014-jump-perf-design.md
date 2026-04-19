# REQ-009 & REQ-014: 代码跳转与查询性能指标 - 开发设计方案

> **需求编号**: REQ-009, REQ-014  
> **优先级**: P0 - 最高  
> **预计工时**: 2 天  
> **依赖**: REQ-012, REQ-013  
> **版本**: v1.1 (根据评审结果修订)  

---

## 一、需求概述

### 1.1 背景

- **代码跳转**: 现有系统已存储 `sourceInfo.path`，但缺少从知识页面跳转到源代码的功能
- **性能指标**: 当前系统缺少性能监控和报告功能

### 1.2 目标

- 实现从知识页面一键跳转到源代码位置
- 实现性能监控和报告功能
- 提供性能优化建议

### 1.3 评审反馈响应

根据技术评审报告，本版本重点改进：

1. **定义跳转协议** - 标准化跳转命令格式，支持 IDE 集成
2. **实现持久化** - 性能监控数据保存到文件
3. **前端集成** - 支持通过命令面板触发跳转

---

## 二、技术设计

### 2.1 跳转协议定义（新增）

```typescript
// src/protocols/jump-protocol.ts

export interface JumpProtocol {
  action: 'jump-to-source' | 'jump-to-knowledge' | 'list-targets'
  pageId: string
  targetPath?: string
  line?: number
  column?: number
}

export interface JumpResult {
  success: boolean
  message?: string
  actions?: Array<{
    title: string
    protocol: JumpProtocol
  }>
}

export const JUMP_COMMAND_PREFIX = 'memory-jump:'

export function encodeJumpProtocol(protocol: JumpProtocol): string {
  return `${JUMP_COMMAND_PREFIX}${Buffer.from(JSON.stringify(protocol)).toString('base64')}`
}

export function decodeJumpProtocol(encoded: string): JumpProtocol | null {
  if (!encoded.startsWith(JUMP_COMMAND_PREFIX)) {
    return null
  }
  
  try {
    const json = Buffer.from(encoded.slice(JUMP_COMMAND_PREFIX.length), 'base64').toString('utf-8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

export interface JumpAction {
  id: string
  title: string
  description?: string
  icon?: string
  protocol: JumpProtocol
}

export const DEFAULT_JUMP_ACTIONS: JumpAction[] = [
  {
    id: 'goto-source',
    title: '跳转到源代码',
    description: '打开源文件并定位到相关代码',
    icon: 'file-code',
    protocol: { action: 'jump-to-source', pageId: '' }
  },
  {
    id: 'goto-knowledge',
    title: '查看相关知识',
    description: '打开相关的知识页面',
    icon: 'book',
    protocol: { action: 'jump-to-knowledge', pageId: '' }
  },
  {
    id: 'list-targets',
    title: '列出所有跳转目标',
    description: '显示所有可跳转的位置',
    icon: 'list',
    protocol: { action: 'list-targets', pageId: '' }
  }
]
```

### 2.2 代码跳转

#### 2.1.1 源文件元数据增强

```typescript
// src/types/index.ts 增强

export interface SourceLocation {
  path: string
  line?: number
  column?: number
  endLine?: number
  endColumn?: number
  description?: string
}

export interface KnowledgeNode {
  // ... 现有字段
  sourceLocations?: SourceLocation[]
  primarySource?: string
}
```

#### 2.1.2 跳转管理器

```typescript
// src/core/jump-manager.ts

import { promises as fs } from 'fs'
import path from 'path'
import type { SourceLocation } from '../types'

export interface JumpTarget {
  type: 'source' | 'knowledge' | 'external'
  path: string
  line?: number
  column?: number
  label: string
}

export interface JumpResult {
  success: boolean
  target?: JumpTarget
  error?: string
}

export class JumpManager {
  private projectPath: string
  private memoryPath: string

  constructor(projectPath: string, memoryPath: string) {
    this.projectPath = projectPath
    this.memoryPath = memoryPath
  }

  async jumpToSource(pageId: string): Promise<JumpResult> {
    const pagePath = await this.findPagePath(pageId)
    
    if (!pagePath) {
      return { success: false, error: `Page not found: ${pageId}` }
    }

    const page = await this.readPage(pagePath)
    
    if (!page) {
      return { success: false, error: `Could not read page: ${pageId}` }
    }

    const sourceLocation = this.extractSourceLocation(page)
    
    if (!sourceLocation) {
      return { success: false, error: `No source location found for: ${pageId}` }
    }

    const fullPath = path.resolve(this.projectPath, sourceLocation.path)
    
    if (!await this.fileExists(fullPath)) {
      return { success: false, error: `Source file not found: ${sourceLocation.path}` }
    }

    return {
      success: true,
      target: {
        type: 'source',
        path: fullPath,
        line: sourceLocation.line,
        column: sourceLocation.column,
        label: sourceLocation.description || path.basename(sourceLocation.path)
      }
    }
  }

  async jumpToKnowledge(pageId: string): Promise<JumpResult> {
    const pagePath = await this.findPagePath(pageId)
    
    if (!pagePath) {
      return { success: false, error: `Page not found: ${pageId}` }
    }

    return {
      success: true,
      target: {
        type: 'knowledge',
        path: pagePath,
        label: pageId
      }
    }
  }

  async getJumpTargets(pageId: string): Promise<JumpTarget[]> {
    const targets: JumpTarget[] = []
    const pagePath = await this.findPagePath(pageId)
    
    if (!pagePath) return targets

    const page = await this.readPage(pagePath)
    if (!page) return targets

    // 主源文件
    const primarySource = this.extractSourceLocation(page)
    if (primarySource) {
      targets.push({
        type: 'source',
        path: path.resolve(this.projectPath, primarySource.path),
        line: primarySource.line,
        label: `Primary: ${path.basename(primarySource.path)}`
      })
    }

    // 多个源位置
    const additionalSources = this.extractAdditionalSources(page)
    for (const source of additionalSources) {
      targets.push({
        type: 'source',
        path: path.resolve(this.projectPath, source.path),
        line: source.line,
        label: source.description || path.basename(source.path)
      })
    }

    // 相关知识页面（通过链接）
    const linkedPages = this.extractLinkedPages(page)
    for (const linkedPage of linkedPages) {
      targets.push({
        type: 'knowledge',
        path: linkedPage,
        label: `Related: ${linkedPage}`
      })
    }

    return targets
  }

  private async findPagePath(pageId: string): Promise<string | null> {
    const categories = ['entities', 'concepts', 'sources', 'synthesis']
    
    for (const category of categories) {
      const pagePath = path.join(this.memoryPath, category, `${pageId}.md`)
      if (await this.fileExists(pagePath)) {
        return pagePath
      }
    }

    return null
  }

  private async readPage(pagePath: string): Promise<any> {
    try {
      const content = await fs.readFile(pagePath, 'utf-8')
      return this.parseMarkdown(content)
    } catch {
      return null
    }
  }

  private parseMarkdown(content: string): any {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    
    if (!frontmatterMatch) {
      return { frontmatter: {}, content }
    }

    const frontmatterText = frontmatterMatch[1]
    const body = frontmatterMatch[2]

    const frontmatter: any = {}
    for (const line of frontmatterText.split('\n')) {
      const match = line.match(/^(\w+):\s*(.*)$/)
      if (match) {
        frontmatter[match[1]] = match[2]
      }
    }

    return { frontmatter, content: body }
  }

  private extractSourceLocation(page: any): SourceLocation | null {
    const fm = page.frontmatter

    if (fm.sourceFile) {
      return {
        path: fm.sourceFile,
        line: fm.sourceLine ? parseInt(fm.sourceLine) : undefined,
        description: fm.sourceDescription
      }
    }

    // 尝试从内容中提取
    const sourceMatch = page.content.match(/```(?:typescript|javascript|python)\s*\n\/\/?\s*Source:\s*([^\n]+)/)
    if (sourceMatch) {
      return { path: sourceMatch[1].trim() }
    }

    return null
  }

  private extractAdditionalSources(page: any): SourceLocation[] {
    const sources: SourceLocation[] = []
    const fm = page.frontmatter

    if (fm.sourceLocations && Array.isArray(fm.sourceLocations)) {
      for (const loc of fm.sourceLocations) {
        sources.push({
          path: loc.path,
          line: loc.line,
          description: loc.description
        })
      }
    }

    return sources
  }

  private extractLinkedPages(page: any): string[] {
    const links: string[] = []
    const linkPattern = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
    
    let match
    while ((match = linkPattern.exec(page.content)) !== null) {
      links.push(match[1].trim())
    }

    return [...new Set(links)]
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}
```

#### 2.1.3 跳转命令

```typescript
// plugin.ts 新增

"memory-jump": tool({
  description: "Jump to source code or related knowledge from a page",
  args: {
    pageId: tool.schema.string().describe("Page ID to jump from"),
    action: tool.schema.enum(["source", "knowledge", "list"]).describe("Jump action"),
  },
  async execute(args, context) {
    if (!knowledgeBase) {
      return JSON.stringify({ success: false, error: "KB not initialized" }, null, 2)
    }

    const jumpManager = new JumpManager(
      knowledgeBase.getProjectPath(),
      knowledgeBase.getBasePath()
    )

    switch (args.action) {
      case 'source':
        const sourceResult = await jumpManager.jumpToSource(args.pageId)
        return JSON.stringify(sourceResult, null, 2)

      case 'knowledge':
        const knowledgeResult = await jumpManager.jumpToKnowledge(args.pageId)
        return JSON.stringify(knowledgeResult, null, 2)

      case 'list':
        const targets = await jumpManager.getJumpTargets(args.pageId)
        return JSON.stringify({
          success: true,
          pageId: args.pageId,
          targets
        }, null, 2)

      default:
        return JSON.stringify({ success: false, error: "Unknown action" }, null, 2)
    }
  }
})
```

### 2.2 查询性能指标

#### 2.2.1 性能监控器

```typescript
// src/utils/performance-monitor.ts

export interface QueryMetric {
  query: string
  duration: number
  resultCount: number
  cacheHit: boolean
  timestamp: string
}

export interface PerformanceStats {
  totalQueries: number
  avgDuration: number
  p50Duration: number
  p95Duration: number
  p99Duration: number
  cacheHitRate: number
  slowQueries: QueryMetric[]
}

export class PerformanceMonitor {
  private metrics: QueryMetric[] = []
  private maxMetrics: number = 1000
  private persistencePath: string | null = null

  constructor(persistencePath?: string) {
    this.persistencePath = persistencePath || null
  }

  async initialize(): Promise<void> {
    if (this.persistencePath) {
      await this.loadFromDisk()
    }
  }

  recordQuery(metric: Omit<QueryMetric, 'timestamp'>): void {
    this.metrics.push({
      ...metric,
      timestamp: new Date().toISOString()
    })

    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift()
    }
  }

  async saveToDisk(): Promise<void> {
    if (!this.persistencePath) return
    
    const data = {
      metrics: this.metrics,
      savedAt: new Date().toISOString()
    }
    
    await fs.writeFile(
      this.persistencePath,
      JSON.stringify(data, null, 2),
      'utf-8'
    )
  }

  private async loadFromDisk(): Promise<void> {
    if (!this.persistencePath) return
    
    try {
      const content = await fs.readFile(this.persistencePath, 'utf-8')
      const data = JSON.parse(content)
      this.metrics = data.metrics || []
    } catch {
      // File doesn't exist or is corrupted
      this.metrics = []
    }
  }

  getStats(): PerformanceStats {
    if (this.metrics.length === 0) {
      return {
        totalQueries: 0,
        avgDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
        cacheHitRate: 0,
        slowQueries: []
      }
    }

    const durations = this.metrics.map(m => m.duration).sort((a, b) => a - b)
    const cacheHits = this.metrics.filter(m => m.cacheHit).length

    return {
      totalQueries: this.metrics.length,
      avgDuration: this.average(durations),
      p50Duration: this.percentile(durations, 50),
      p95Duration: this.percentile(durations, 95),
      p99Duration: this.percentile(durations, 99),
      cacheHitRate: cacheHits / this.metrics.length,
      slowQueries: this.getSlowQueries()
    }
  }

  getSlowQueries(threshold: number = 1000): QueryMetric[] {
    return this.metrics
      .filter(m => m.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
  }

  getRecentQueries(count: number = 20): QueryMetric[] {
    return this.metrics.slice(-count)
  }

  clear(): void {
    this.metrics = []
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0
    const index = Math.ceil((p / 100) * sortedValues.length) - 1
    return sortedValues[Math.max(0, index)]
  }
}
```

#### 2.2.2 性能报告生成器

```typescript
// src/utils/performance-reporter.ts

import type { PerformanceStats, QueryMetric } from './performance-monitor'

export interface PerformanceReport {
  summary: PerformanceStats
  recommendations: string[]
  healthScore: number
  timestamp: string
}

export class PerformanceReporter {
  generateReport(stats: PerformanceStats): PerformanceReport {
    const recommendations = this.generateRecommendations(stats)
    const healthScore = this.calculateHealthScore(stats)

    return {
      summary: stats,
      recommendations,
      healthScore,
      timestamp: new Date().toISOString()
    }
  }

  private generateRecommendations(stats: PerformanceStats): string[] {
    const recommendations: string[] = []

    if (stats.avgDuration > 500) {
      recommendations.push('Consider enabling memory cache to improve query performance')
    }

    if (stats.cacheHitRate < 0.5) {
      recommendations.push('Cache hit rate is low. Consider increasing cache TTL or size')
    }

    if (stats.p95Duration > 2000) {
      recommendations.push('Some queries are slow. Consider optimizing the graph index')
    }

    if (stats.slowQueries.length > 5) {
      recommendations.push('Multiple slow queries detected. Review query patterns')
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable parameters')
    }

    return recommendations
  }

  private calculateHealthScore(stats: PerformanceStats): number {
    let score = 100

    // 平均响应时间惩罚
    if (stats.avgDuration > 100) score -= 10
    if (stats.avgDuration > 500) score -= 20
    if (stats.avgDuration > 1000) score -= 30

    // 缓存命中率惩罚
    if (stats.cacheHitRate < 0.8) score -= 10
    if (stats.cacheHitRate < 0.5) score -= 20

    // P95 响应时间惩罚
    if (stats.p95Duration > 1000) score -= 10
    if (stats.p95Duration > 3000) score -= 20

    return Math.max(0, score)
  }

  formatReport(report: PerformanceReport): string {
    const lines: string[] = [
      '# Memory Performance Report',
      '',
      `**Generated**: ${report.timestamp}`,
      `**Health Score**: ${report.healthScore}/100`,
      '',
      '## Summary',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Total Queries | ${report.summary.totalQueries} |`,
      `| Avg Duration | ${report.summary.avgDuration.toFixed(2)}ms |`,
      `| P50 Duration | ${report.summary.p50Duration.toFixed(2)}ms |`,
      `| P95 Duration | ${report.summary.p95Duration.toFixed(2)}ms |`,
      `| P99 Duration | ${report.summary.p99Duration.toFixed(2)}ms |`,
      `| Cache Hit Rate | ${(report.summary.cacheHitRate * 100).toFixed(1)}% |`,
      '',
      '## Recommendations',
      ''
    ]

    for (const rec of report.recommendations) {
      lines.push(`- ${rec}`)
    }

    if (report.summary.slowQueries.length > 0) {
      lines.push('', '## Slow Queries', '')
      for (const query of report.summary.slowQueries) {
        lines.push(`- "${query.query.substring(0, 50)}..." - ${query.duration}ms`)
      }
    }

    return lines.join('\n')
  }
}
```

#### 2.2.3 性能命令

```typescript
// plugin.ts 新增

"memory-perf": tool({
  description: "Get performance statistics and health report",
  args: {
    action: tool.schema.enum(["stats", "report", "clear"]).describe("Action to perform"),
  },
  async execute(args, context) {
    if (!knowledgeBase) {
      return JSON.stringify({ success: false, error: "KB not initialized" }, null, 2)
    }

    const monitor = knowledgeBase.getPerformanceMonitor()

    switch (args.action) {
      case 'stats':
        return JSON.stringify({
          success: true,
          stats: monitor.getStats()
        }, null, 2)

      case 'report':
        const reporter = new PerformanceReporter()
        const stats = monitor.getStats()
        const report = reporter.generateReport(stats)
        return reporter.formatReport(report)

      case 'clear':
        monitor.clear()
        return JSON.stringify({
          success: true,
          message: "Performance metrics cleared"
        }, null, 2)

      default:
        return JSON.stringify({ success: false, error: "Unknown action" }, null, 2)
    }
  }
})
```

---

## 三、测试方案

### 3.1 跳转测试

```typescript
// tests/jump-manager.test.ts

import { describe, it, expect, beforeEach } from 'bun:test'
import { JumpManager } from '../src/core/jump-manager'
import { promises as fs } from 'fs'
import path from 'path'

describe('JumpManager', () => {
  const testDir = path.join(__dirname, 'test-jump')
  const memoryDir = path.join(testDir, '.memory')
  const manager = new JumpManager(testDir, memoryDir)

  beforeEach(async () => {
    await fs.mkdir(path.join(memoryDir, 'entities'), { recursive: true })
    await fs.mkdir(path.join(testDir, 'src'), { recursive: true })
  })

  it('should jump to source file', async () => {
    const sourceFile = path.join(testDir, 'src', 'test.ts')
    await fs.writeFile(sourceFile, 'export function test() {}')

    const pageFile = path.join(memoryDir, 'entities', 'test.md')
    await fs.writeFile(pageFile, `---
title: Test
sourceFile: src/test.ts
---
# Test
`)

    const result = await manager.jumpToSource('test')
    
    expect(result.success).toBe(true)
    expect(result.target?.path).toBe(sourceFile)
  })

  it('should return error for missing page', async () => {
    const result = await manager.jumpToSource('nonexistent')
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('should list all jump targets', async () => {
    const sourceFile = path.join(testDir, 'src', 'multi.ts')
    await fs.writeFile(sourceFile, 'export function a() {}')

    const pageFile = path.join(memoryDir, 'entities', 'multi.md')
    await fs.writeFile(pageFile, `---
title: Multi
sourceFile: src/multi
sourceLocations:
  - path: src/multi.ts
    line: 1
    description: Function a
---
# Multi

[[related-page]]
`)

    const targets = await manager.getJumpTargets('multi')
    
    expect(targets.length).toBeGreaterThan(0)
    expect(targets.some(t => t.type === 'source')).toBe(true)
  })
})
```

### 3.2 性能监控测试

```typescript
// tests/performance-monitor.test.ts

import { describe, it, expect } from 'bun:test'
import { PerformanceMonitor } from '../src/utils/performance-monitor'
import { PerformanceReporter } from '../src/utils/performance-reporter'

describe('PerformanceMonitor', () => {
  const monitor = new PerformanceMonitor()

  it('should record queries', () => {
    monitor.recordQuery({
      query: 'test query',
      duration: 100,
      resultCount: 5,
      cacheHit: false
    })

    const stats = monitor.getStats()
    expect(stats.totalQueries).toBe(1)
  })

  it('should compute percentiles', () => {
    monitor.clear()
    
    for (let i = 1; i <= 100; i++) {
      monitor.recordQuery({
        query: `query ${i}`,
        duration: i * 10,
        resultCount: 1,
        cacheHit: i > 50
      })
    }

    const stats = monitor.getStats()
    expect(stats.p50Duration).toBeCloseTo(500, -1)
    expect(stats.p95Duration).toBeCloseTo(950, -1)
    expect(stats.cacheHitRate).toBeCloseTo(0.5, 1)
  })

  it('should identify slow queries', () => {
    monitor.clear()
    
    monitor.recordQuery({ query: 'fast', duration: 50, resultCount: 1, cacheHit: true })
    monitor.recordQuery({ query: 'slow', duration: 2000, resultCount: 1, cacheHit: false })

    const slowQueries = monitor.getSlowQueries(1000)
    expect(slowQueries.length).toBe(1)
    expect(slowQueries[0].query).toBe('slow')
  })
})

describe('PerformanceReporter', () => {
  const reporter = new PerformanceReporter()

  it('should generate recommendations', () => {
    const stats = {
      totalQueries: 100,
      avgDuration: 600,
      p50Duration: 500,
      p95Duration: 2000,
      p99Duration: 3000,
      cacheHitRate: 0.3,
      slowQueries: []
    }

    const report = reporter.generateReport(stats)
    
    expect(report.recommendations.length).toBeGreaterThan(0)
    expect(report.healthScore).toBeLessThan(100)
  })

  it('should format report correctly', () => {
    const stats = {
      totalQueries: 10,
      avgDuration: 100,
      p50Duration: 80,
      p95Duration: 200,
      p99Duration: 300,
      cacheHitRate: 0.9,
      slowQueries: []
    }

    const report = reporter.generateReport(stats)
    const formatted = reporter.formatReport(report)
    
    expect(formatted).toContain('# Memory Performance Report')
    expect(formatted).toContain('Health Score')
  })
})
```

---

## 四、验收标准

### 4.1 代码跳转

- [ ] 从知识页面跳转到源代码
- [ ] 支持多个源位置
- [ ] 处理文件不存在的情况
- [ ] 支持跳转到相关知识页面

### 4.2 性能指标

- [ ] 记录所有查询的性能数据
- [ ] 计算正确的统计指标
- [ ] 生成性能报告
- [ ] 提供优化建议

---

## 五、实施计划

| 任务 | 预计时间 |
|------|---------|
| 实现跳转协议 | 1h |
| 实现 JumpManager | 2h |
| 实现 PerformanceMonitor (含持久化) | 2h |
| 实现 PerformanceReporter | 1h |
| 新增命令 | 2h |
| 单元测试 | 2h |

---

**设计完成 (v1.1)。已根据评审结果添加跳转协议定义和性能数据持久化。**
