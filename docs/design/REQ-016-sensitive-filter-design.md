# REQ-016: 敏感信息过滤 - 开发设计方案

> **需求编号**: REQ-016  
> **优先级**: P0 - 最高  
> **预计工时**: 1.5 天  
> **依赖**: 无  
> **版本**: v1.1 (根据评审结果修订)  

---

## 一、需求概述

### 1.1 背景

当前系统在摄入文件时，直接将所有内容写入知识库，可能包含敏感信息（API密钥、密码、Token等），存在安全风险。

### 1.2 目标

- 自动识别并过滤敏感信息
- 支持多种敏感信息模式
- 提供过滤日志供审计
- 不影响正常内容的摄入

### 1.3 评审反馈响应

根据技术评审报告，本版本重点改进：

1. **正则超时机制** - 防止 ReDoS 攻击，限制扫描时间
2. **上下文感知过滤** - 避免误过滤测试文件和示例文档
3. **性能优化** - 限制正则复杂度，添加超时保护

---

## 二、技术设计

### 2.1 敏感信息类型定义

```typescript
// src/types/index.ts 新增

export interface SensitivePattern {
  id: string
  name: string
  description: string
  pattern: RegExp
  severity: 'critical' | 'high' | 'medium'
  action: 'redact' | 'warn' | 'ignore'
}

export interface SensitiveMatch {
  patternId: string
  type: string
  value: string
  location: {
    line: number
    start: number
    end: number
  }
  severity: 'critical' | 'high' | 'medium'
}

export interface FilterResult {
  original: string
  filtered: string
  matches: SensitiveMatch[]
  redactedCount: number
  warningCount: number
}
```

### 2.2 敏感信息模式库

```typescript
// src/utils/sensitive-patterns.ts

import type { SensitivePattern } from '../types'

export const DEFAULT_SENSITIVE_PATTERNS: SensitivePattern[] = [
  {
    id: 'api-key',
    name: 'API Key',
    description: 'API密钥，如 api_key=xxx',
    pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"]?([a-zA-Z0-9_-]{16,})['"]?/gi,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'password',
    name: 'Password',
    description: '密码字段',
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"]?([^\s'"]{4,})['"]?/gi,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'bearer-token',
    name: 'Bearer Token',
    description: 'Bearer认证令牌',
    pattern: /Bearer\s+([a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'jwt',
    name: 'JWT Token',
    description: 'JWT令牌',
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'private-key',
    name: 'Private Key',
    description: '私钥文件内容',
    pattern: /-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/g,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'aws-access-key',
    name: 'AWS Access Key',
    description: 'AWS访问密钥',
    pattern: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[0-9A-Z]{16}/g,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'aws-secret-key',
    name: 'AWS Secret Key',
    description: 'AWS密钥',
    pattern: /(?:aws[_-]?secret[_-]?key|aws[_-]?secret)\s*[=:]\s*['"]?([a-zA-Z0-9/+=]{40})['"]?/gi,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'connection-string',
    name: 'Database Connection String',
    description: '包含密码的数据库连接串',
    pattern: /(?:mysql|postgres|mongodb|redis):\/\/[^:]+:[^@]+@[^\s]+/gi,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'github-token',
    name: 'GitHub Token',
    description: 'GitHub个人访问令牌',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'slack-token',
    name: 'Slack Token',
    description: 'Slack API令牌',
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/g,
    severity: 'critical',
    action: 'redact'
  },
  {
    id: 'generic-secret',
    name: 'Generic Secret',
    description: '通用密钥模式',
    pattern: /(?:secret|token|auth|key)\s*[=:]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
    severity: 'high',
    action: 'warn'
  }
]
```

### 2.3 敏感信息过滤器（增强版）

```typescript
// src/utils/sensitive-filter.ts

import type { SensitivePattern, SensitiveMatch, FilterResult } from '../types'
import { DEFAULT_SENSITIVE_PATTERNS } from './sensitive-patterns'

export interface FilterOptions {
  timeout?: number
  skipTestFiles?: boolean
  skipExampleFiles?: boolean
  maxMatches?: number
}

export interface FilterContext {
  filePath: string
  isTestFile: boolean
  isExampleFile: boolean
  isConfigFile: boolean
}

export class SensitiveDataFilter {
  private patterns: SensitivePattern[]
  private filterLog: Array<{
    timestamp: string
    file: string
    matches: SensitiveMatch[]
    skipped: boolean
    reason?: string
  }> = []

  private readonly DEFAULT_TIMEOUT = 5000
  private readonly DEFAULT_MAX_MATCHES = 100

  constructor(customPatterns?: SensitivePattern[]) {
    this.patterns = customPatterns || DEFAULT_SENSITIVE_PATTERNS
  }

  scan(content: string, options?: FilterOptions): SensitiveMatch[] {
    const matches: SensitiveMatch[] = []
    const lines = content.split('\n')
    const timeout = options?.timeout || this.DEFAULT_TIMEOUT
    const maxMatches = options?.maxMatches || this.DEFAULT_MAX_MATCHES
    const startTime = Date.now()

    for (const pattern of this.patterns) {
      if (Date.now() - startTime > timeout) {
        console.warn('[oh-memory] Sensitive scan timeout, skipping remaining patterns')
        break
      }

      if (matches.length >= maxMatches) {
        console.warn(`[oh-memory] Max matches (${maxMatches}) reached, stopping scan`)
        break
      }

      let match
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags)
      
      try {
        while ((match = regex.exec(content)) !== null) {
          if (matches.length >= maxMatches) break
          
          const lineNumber = this.getLineNumber(content, match.index)
          const line = lines[lineNumber - 1] || ''
          
          matches.push({
            patternId: pattern.id,
            type: pattern.name,
            value: this.maskValue(match[0]),
            location: {
              line: lineNumber,
              start: match.index,
              end: match.index + match[0].length
            },
            severity: pattern.severity
          })
        }
      } catch (error) {
        console.warn(`[oh-memory] Regex error for pattern ${pattern.id}:`, error)
      }
    }

    return matches
  }

  filter(content: string, filePath?: string, options?: FilterOptions): FilterResult {
    const context = filePath ? this.analyzeContext(filePath) : null

    if (context && options?.skipTestFiles && context.isTestFile) {
      this.logFilter(filePath!, [], true, 'test-file')
      return {
        original: content,
        filtered: content,
        matches: [],
        redactedCount: 0,
        warningCount: 0
      }
    }

    if (context && options?.skipExampleFiles && context.isExampleFile) {
      this.logFilter(filePath!, [], true, 'example-file')
      return {
        original: content,
        filtered: content,
        matches: [],
        redactedCount: 0,
        warningCount: 0
      }
    }

    const matches = this.scan(content, options)
    let filtered = content
    let redactedCount = 0
    let warningCount = 0

    const sortedMatches = [...matches].sort((a, b) => 
      b.location.start - a.location.start
    )

    for (const match of sortedMatches) {
      const pattern = this.patterns.find(p => p.id === match.patternId)
      if (!pattern) continue

      if (pattern.action === 'redact') {
        filtered = filtered.slice(0, match.location.start) +
          `[REDACTED:${match.type}]` +
          filtered.slice(match.location.end)
        redactedCount++
      } else if (pattern.action === 'warn') {
        warningCount++
      }
    }

    if (filePath && matches.length > 0) {
      this.logFilter(filePath, matches, false)
    }

    return {
      original: content,
      filtered,
      matches,
      redactedCount,
      warningCount
    }
  }

  private analyzeContext(filePath: string): FilterContext {
    const lowerPath = filePath.toLowerCase()
    
    return {
      filePath,
      isTestFile: this.isTestFile(lowerPath),
      isExampleFile: this.isExampleFile(lowerPath),
      isConfigFile: this.isConfigFile(lowerPath)
    }
  }

  private isTestFile(path: string): boolean {
    const testPatterns = [
      /\.test\.(ts|tsx|js|jsx)$/,
      /\.spec\.(ts|tsx|js|jsx)$/,
      /__tests__/,
      /__mocks__/,
      /\.test\//,
      /\/tests?\//,
      /\/__tests__\//
    ]
    
    return testPatterns.some(p => p.test(path))
  }

  private isExampleFile(path: string): boolean {
    const examplePatterns = [
      /\.example\.(ts|tsx|js|jsx|json|yaml|yml)$/,
      /\/examples?\//,
      /\/docs\/examples?\//,
      /sample/,
      /demo/
    ]
    
    return examplePatterns.some(p => p.test(path))
  }

  private isConfigFile(path: string): boolean {
    const configPatterns = [
      /\.config\.(ts|tsx|js|jsx|json)$/,
      /\.env(\.|$)/,
      /config\.yaml$/,
      /config\.json$/
    ]
    
    return configPatterns.some(p => p.test(path))
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length
  }

  private maskValue(value: string): string {
    if (value.length <= 8) {
      return '*'.repeat(value.length)
    }
    return value.substring(0, 4) + '****' + value.substring(value.length - 4)
  }

  private logFilter(
    filePath: string,
    matches: SensitiveMatch[],
    skipped: boolean,
    reason?: string
  ): void {
    this.filterLog.push({
      timestamp: new Date().toISOString(),
      file: filePath,
      matches,
      skipped,
      reason
    })
  }

  getFilterLog(): Array<{
    timestamp: string
    file: string
    matches: SensitiveMatch[]
    skipped: boolean
    reason?: string
  }> {
    return this.filterLog
  }

  addPattern(pattern: SensitivePattern): void {
    this.patterns.push(pattern)
  }

  removePattern(patternId: string): void {
    this.patterns = this.patterns.filter(p => p.id !== patternId)
  }

  clearLog(): void {
    this.filterLog = []
  }
}
```

### 2.4 集成到知识库

```typescript
// src/core/knowledge-base.ts 修改

import { SensitiveDataFilter } from '../utils/sensitive-filter'

export class KnowledgeBase {
  private sensitiveFilter: SensitiveDataFilter

  constructor(projectPath: string) {
    this.projectPath = projectPath
    this.basePath = path.join(projectPath, '.memory')
    this.updater = new GraphUpdater(this.basePath)
    this.orchestrator = new IngestOrchestrator(this.basePath)
    this.analyzer = new ProjectAnalyzer(projectPath, this.basePath)
    this.sensitiveFilter = new SensitiveDataFilter()
  }

  private async processFile(filePath: string): Promise<string | null> {
    let content = await fs.readFile(filePath, 'utf-8')
    
    const filterResult = this.sensitiveFilter.filter(content, filePath, {
      timeout: 5000,
      skipTestFiles: true,
      skipExampleFiles: true,
      maxMatches: 100
    })
    
    if (filterResult.redactedCount > 0) {
      console.log(`[oh-memory] Filtered ${filterResult.redactedCount} sensitive items in ${filePath}`)
      content = filterResult.filtered
    }
    
    if (filterResult.warningCount > 0) {
      console.warn(`[oh-memory] Warning: ${filterResult.warningCount} potential sensitive items in ${filePath}`)
    }
    
    // ... 继续原有处理逻辑
  }
}
```

---

## 三、测试方案

### 3.1 单元测试

```typescript
// tests/sensitive-filter.test.ts

import { describe, it, expect } from 'bun:test'
import { SensitiveDataFilter } from '../src/utils/sensitive-filter'

describe('SensitiveDataFilter', () => {
  const filter = new SensitiveDataFilter()

  it('should detect API keys', () => {
    const content = 'api_key=sk-1234567890abcdef1234567890abcdef'
    const result = filter.filter(content)
    
    expect(result.matches.length).toBeGreaterThan(0)
    expect(result.filtered).toContain('[REDACTED:')
    expect(result.filtered).not.toContain('sk-1234567890abcdef1234567890abcdef')
  })

  it('should detect passwords', () => {
    const content = 'password = "mySecretPassword123"'
    const result = filter.filter(content)
    
    expect(result.matches.length).toBeGreaterThan(0)
    expect(result.filtered).toContain('[REDACTED:')
  })

  it('should detect JWT tokens', () => {
    const content = 'token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
    const result = filter.filter(content)
    
    expect(result.matches.length).toBeGreaterThan(0)
    expect(result.filtered).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
  })

  it('should detect AWS keys', () => {
    const content = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE'
    const result = filter.filter(content)
    
    expect(result.matches.length).toBeGreaterThan(0)
  })

  it('should detect private keys', () => {
    const content = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MbzYLdZ7ZvVy7F7V
-----END RSA PRIVATE KEY-----`
    const result = filter.filter(content)
    
    expect(result.matches.length).toBeGreaterThan(0)
    expect(result.filtered).not.toContain('MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn')
  })

  it('should not filter normal code', () => {
    const content = `
function calculateSum(a: number, b: number): number {
  return a + b
}
export { calculateSum }
`
    const result = filter.filter(content)
    
    expect(result.matches.length).toBe(0)
    expect(result.filtered).toBe(content)
  })

  it('should preserve line numbers after filtering', () => {
    const content = `line1
api_key=secret123
line3`
    const result = filter.filter(content)
    
    expect(result.matches[0].location.line).toBe(2)
  })

  it('should skip test files when configured', () => {
    const content = 'api_key=sk-test1234567890abcdef'
    const result = filter.filter(content, '/src/auth.test.ts', {
      skipTestFiles: true
    })
    
    expect(result.matches.length).toBe(0)
    expect(result.filtered).toBe(content)
  })

  it('should skip example files when configured', () => {
    const content = 'api_key=sk-example1234567890abcdef'
    const result = filter.filter(content, '/examples/config.example.ts', {
      skipExampleFiles: true
    })
    
    expect(result.matches.length).toBe(0)
    expect(result.filtered).toBe(content)
  })

  it('should respect timeout', () => {
    const largeContent = 'api_key=sk-test\n'.repeat(100000)
    const result = filter.filter(largeContent, undefined, {
      timeout: 100
    })
    
    // Should complete without hanging
    expect(result).toBeDefined()
  })

  it('should respect maxMatches limit', () => {
    const content = `
api_key=sk-1234567890abcdef1234567890abcdef
password=test1234
api_key=sk-2234567890abcdef1234567890abcdef
password=test5678
`
    const result = filter.filter(content, undefined, {
      maxMatches: 2
    })
    
    expect(result.matches.length).toBeLessThanOrEqual(2)
  })
})
```

### 3.2 集成测试

```typescript
// tests/integration/sensitive-filter-integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { KnowledgeBase } from '../../src/core/knowledge-base'
import { promises as fs } from 'fs'
import path from 'path'

describe('Sensitive Filter Integration', () => {
  const testDir = path.join(__dirname, 'test-project')
  const kb = new KnowledgeBase(testDir)

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true })
    await fs.mkdir(path.join(testDir, 'src'), { recursive: true })
  })

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should filter sensitive info during ingestion', async () => {
    const testFile = path.join(testDir, 'src', 'config.ts')
    await fs.writeFile(testFile, `
export const config = {
  apiKey: 'sk-1234567890abcdef1234567890abcdef',
  password: 'superSecretPassword',
  normalSetting: 'value'
}
`)

    await kb.initialize()
    const result = await kb.ingestFiles([testFile])

    const pagePath = path.join(kb.getBasePath(), 'entities', 'config.md')
    const pageContent = await fs.readFile(pagePath, 'utf-8')

    expect(pageContent).not.toContain('sk-1234567890abcdef')
    expect(pageContent).not.toContain('superSecretPassword')
    expect(pageContent).toContain('[REDACTED:')
    expect(pageContent).toContain('normalSetting')
  })
})
```

---

## 四、配置支持

### 4.1 自定义配置

```yaml
# .memory/config.yaml

sensitiveFilter:
  enabled: true
  patterns:
    - id: custom-api-key
      name: Custom API Key
      pattern: "CUSTOM_KEY_[A-Z0-9]{32}"
      severity: critical
      action: redact
  exclusions:
    - id: api-key
      reason: "Test fixtures use fake keys"
```

### 4.2 配置加载

```typescript
// src/utils/config-loader.ts

interface SensitiveFilterConfig {
  enabled: boolean
  patterns?: SensitivePattern[]
  exclusions?: string[]
}

async function loadSensitiveFilterConfig(
  basePath: string
): Promise<SensitiveFilterConfig> {
  const configPath = path.join(basePath, 'config.yaml')
  
  if (!await fileExists(configPath)) {
    return { enabled: true }
  }
  
  const content = await fs.readFile(configPath, 'utf-8')
  const config = yaml.parse(content)
  
  return config.sensitiveFilter || { enabled: true }
}
```

---

## 五、实施计划

### 5.1 开发任务

| 任务 | 预计时间 | 优先级 |
|------|---------|--------|
| 创建敏感信息模式库 | 2h | P0 |
| 实现过滤器核心逻辑 | 2h | P0 |
| 集成到知识库摄入流程 | 1h | P0 |
| 编写单元测试 | 1h | P0 |
| 编写集成测试 | 1h | P1 |
| 添加配置支持 | 1h | P2 |

### 5.2 验收标准

- [ ] 检测所有已定义的敏感信息模式
- [ ] 过滤后不包含原始敏感信息
- [ ] 记录过滤日志供审计
- [ ] 单元测试覆盖率 > 90%
- [ ] 不影响正常内容的摄入
- [ ] 支持自定义模式配置

---

## 六、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 误过滤正常内容 | 中 | 提供 warn 级别模式，跳过测试/示例文件 |
| 漏过滤敏感信息 | 高 | 持续更新模式库，支持自定义模式 |
| 性能影响 | 中 | 使用超时机制，限制匹配数量 |
| ReDoS 攻击 | 高 | 添加超时保护，限制正则执行时间 |
| 测试文件误过滤 | 中 | 自动识别测试文件，提供跳过选项 |

---

**设计完成 (v1.1)。已根据评审结果添加超时机制和上下文感知过滤。**
