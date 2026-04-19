# REQ-005: 智能知识分类 - 开发设计方案

> **需求编号**: REQ-005  
> **优先级**: P0 - 最高  
> **预计工时**: 2 天  
> **依赖**: 无  
> **版本**: v1.1  
> **实现方案**: 纯规则引擎

---

## 一、需求概述

### 1.1 背景

当前系统的知识分类功能过于简单，仅基于文件扩展名判断：
- `.js`, `.ts`, `.jsx`, `.tsx`, `.py` → `entity`
- 包含 `README` 或 `docs` → `concept`
- 其他 → `source`

这种分类方式存在以下问题：
1. **分类不准确**: 无法识别 `synthesis` 类型
2. **缺少内容分析**: 未考虑文件内容特征
3. **文档分类粗糙**: 所有文档都归为 `concept` 或 `source`

### 1.2 目标

实现智能知识分类器，根据文件路径、扩展名、内容特征等多维度信息，自动将知识分类到正确的类别。

### 1.3 分类规则

| 类别 | 判断依据 | 示例 |
|------|---------|------|
| **entities** | 代码实体（函数、类、模块、组件） | `login-form.tsx`, `user-service.ts` |
| **concepts** | 架构概念、设计模式、流程 | `authentication-flow.md`, `api-design.md` |
| **sources** | 源文档摘要、外部资料 | `README.md`, `CHANGELOG.md` |
| **synthesis** | 综合分析、跨模块总结 | `architecture-decisions.md`, `migration-guide.md` |

---

## 二、技术设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    processFile(filePath)                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              ContentClassifier.classify()                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  1. 文件扩展名判断 (快速路径)                          │   │
│  │  2. 文件路径模式匹配                                  │   │
│  │  3. 内容特征分析                                      │   │
│  │  4. 综合评分决策                                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    返回分类结果 + 置信度
```

### 2.2 核心类设计

```typescript
// src/core/content-classifier.ts

export type Category = 'entity' | 'concept' | 'source' | 'synthesis'

export interface ClassificationResult {
  category: Category
  confidence: number  // 0-1
  reasons: string[]   // 分类理由
}

export interface ClassificationRule {
  name: string
  category: Category
  condition: (context: ClassificationContext) => boolean
  weight: number  // 权重 0-1
}

export interface ClassificationContext {
  filePath: string
  extension: string
  content: string
  fileName: string
  dirName: string
}

export class ContentClassifier {
  private rules: ClassificationRule[] = []
  
  constructor() {
    this.initializeRules()
  }
  
  classify(filePath: string, content: string): ClassificationResult {
    const context = this.buildContext(filePath, content)
    const scores = this.calculateScores(context)
    return this.makeDecision(scores)
  }
  
  private initializeRules(): void {
    // 规则初始化
  }
  
  private buildContext(filePath: string, content: string): ClassificationContext {
    // 构建分类上下文
  }
  
  private calculateScores(context: ClassificationContext): Map<Category, number> {
    // 计算各类别得分
  }
  
  private makeDecision(scores: Map<Category, number>): ClassificationResult {
    // 做出最终决策
  }
}
```

### 2.3 分类规则详细设计

#### 2.3.1 Entity 规则

```typescript
// 规则 1: 源代码文件扩展名
{
  name: 'source-code-extension',
  category: 'entity',
  weight: 0.9,
  condition: (ctx) => {
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.rb']
    return codeExtensions.includes(ctx.extension)
  }
}

// 规则 2: 包含类或函数定义
{
  name: 'has-class-or-function',
  category: 'entity',
  weight: 0.7,
  condition: (ctx) => {
    const patterns = [
      /^(export\s+)?(class|interface|function|const|let|var)\s+\w+/m,
      /^(public|private|protected)?\s*(async\s+)?function\s+\w+/m,
      /^def\s+\w+\s*\(/m,  // Python
    ]
    return patterns.some(p => p.test(ctx.content))
  }
}

// 规则 3: 组件文件模式
{
  name: 'component-file',
  category: 'entity',
  weight: 0.8,
  condition: (ctx) => {
    return /\.(component|service|controller|model|repository|util|helper)/i.test(ctx.fileName)
  }
}
```

#### 2.3.2 Concept 规则

```typescript
// 规则 1: 架构设计文档
{
  name: 'architecture-doc',
  category: 'concept',
  weight: 0.85,
  condition: (ctx) => {
    const patterns = [
      /(architecture|design|pattern|flow|diagram)/i,
      /(how\s+to|guide|tutorial|walkthrough)/i,
      /(api\s+design|system\s+design)/i,
    ]
    return ctx.extension === '.md' && patterns.some(p => p.test(ctx.content))
  }
}

// 规则 2: 概念性文件名
{
  name: 'concept-filename',
  category: 'concept',
  weight: 0.75,
  condition: (ctx) => {
    const patterns = [
      /(design|architecture|pattern|flow|guide|tutorial)/i,
      /(concept|theory|principle|approach)/i,
    ]
    return patterns.some(p => p.test(ctx.fileName))
  }
}

// 规则 3: 包含图表或流程描述
{
  name: 'has-diagrams',
  category: 'concept',
  weight: 0.7,
  condition: (ctx) => {
    const patterns = [
      /```(mermaid|graph|flowchart)/,
      /\[.*\]\(.*\.(png|jpg|svg|drawio)\)/,
      /(sequence|flow|state|class)\s+diagram/i,
    ]
    return patterns.some(p => p.test(ctx.content))
  }
}
```

#### 2.3.3 Source 规则

```typescript
// 规则 1: 标准文档文件
{
  name: 'standard-docs',
  category: 'source',
  weight: 0.95,
  condition: (ctx) => {
    const patterns = [
      /^(README|CHANGELOG|CONTRIBUTING|LICENSE|AUTHORS)$/i,
      /^(INSTALL|SETUP|USAGE|FAQ)$/i,
    ]
    return patterns.some(p => p.test(ctx.fileName))
  }
}

// 规则 2: 配置文件
{
  name: 'config-files',
  category: 'source',
  weight: 0.8,
  condition: (ctx) => {
    const patterns = [
      /\.(config|conf|settings|env)/i,
      /\.(json|yaml|yml|toml|ini)$/,
    ]
    return patterns.some(p => p.test(ctx.fileName) || p.test(ctx.extension))
  }
}

// 规则 3: 外部资料引用
{
  name: 'external-references',
  category: 'source',
  weight: 0.6,
  condition: (ctx) => {
    const patterns = [
      /\[.*\]\(https?:\/\//,  // 外部链接
      /(reference|documentation|external|third-party)/i,
    ]
    return patterns.some(p => p.test(ctx.content))
  }
}
```

#### 2.3.4 Synthesis 规则

```typescript
// 规则 1: 跨模块分析文档
{
  name: 'cross-module-analysis',
  category: 'synthesis',
  weight: 0.85,
  condition: (ctx) => {
    const patterns = [
      /(migration|upgrade|refactor|comparison)/i,
      /(decision|analysis|summary|overview)/i,
      /(architecture|system)\s+(decision|overview)/i,
    ]
    return ctx.extension === '.md' && patterns.some(p => p.test(ctx.fileName))
  }
}

// 规则 2: 包含多个模块引用
{
  name: 'multi-module-references',
  category: 'synthesis',
  weight: 0.7,
  condition: (ctx) => {
    const linkPattern = /\[\[([^\]]+)\]\]/g
    const links = ctx.content.match(linkPattern) || []
    const uniqueModules = new Set(
      links.map(link => link.replace(/\[\[|\]\]/g, '').split('/')[0])
    )
    return uniqueModules.size >= 3  // 引用 3 个以上不同模块
  }
}

// 规则 3: 决策记录文档
{
  name: 'decision-records',
  category: 'synthesis',
  weight: 0.9,
  condition: (ctx) => {
    const patterns = [
      /^(ADR|RFC|RFP)-\d+/,  // Architecture Decision Records
      /(decision|choice|rationale|why)/i,
      /(pros\s+and\s+cons|trade-off|alternatives)/i,
    ]
    return patterns.some(p => p.test(ctx.fileName) || p.test(ctx.content))
  }
}
```

### 2.4 评分机制

```typescript
private calculateScores(context: ClassificationContext): Map<Category, number> {
  const scores = new Map<Category, number>([
    ['entity', 0],
    ['concept', 0],
    ['source', 0],
    ['synthesis', 0]
  ])
  
  for (const rule of this.rules) {
    if (rule.condition(context)) {
      const currentScore = scores.get(rule.category) || 0
      scores.set(rule.category, currentScore + rule.weight)
    }
  }
  
  // 归一化得分
  const maxScore = Math.max(...scores.values())
  if (maxScore > 0) {
    for (const [category, score] of scores) {
      scores.set(category, score / maxScore)
    }
  }
  
  return scores
}
```

### 2.5 决策逻辑

```typescript
private makeDecision(scores: Map<Category, number>): ClassificationResult {
  let maxScore = 0
  let bestCategory: Category = 'source'  // 默认值
  const reasons: string[] = []
  
  for (const [category, score] of scores) {
    if (score > maxScore) {
      maxScore = score
      bestCategory = category
    }
  }
  
  // 收集分类理由
  for (const [category, score] of scores) {
    if (score > 0.5) {
      reasons.push(`${category}: ${(score * 100).toFixed(0)}%`)
    }
  }
  
  return {
    category: bestCategory,
    confidence: maxScore,
    reasons
  }
}
```

---

## 三、集成方案

### 3.1 修改 knowledge-base.ts

```typescript
// 在 knowledge-base.ts 中引入分类器
import { ContentClassifier } from './content-classifier'

export class KnowledgeBase {
  private classifier: ContentClassifier
  
  constructor(projectPath: string) {
    // ... 现有初始化代码
    this.classifier = new ContentClassifier()
  }
  
  private async processFile(filePath: string): Promise<string | null> {
    // ... 现有代码
    
    // 替换原来的 determinePageType
    const classification = this.classifier.classify(filePath, processedContent)
    const pageType = classification.category
    
    // 记录分类信息（可选）
    if (classification.confidence < 0.7) {
      console.log(`[oh-memory] Low confidence classification for ${filePath}: ${classification.reasons.join(', ')}`)
    }
    
    // ... 后续处理
  }
}
```

### 3.2 保留向后兼容

```typescript
// 保留原有的 determinePageType 方法作为后备
private determinePageTypeFallback(filePath: string): 'entity' | 'concept' | 'source' {
  const ext = path.extname(filePath)
  
  if (['.js', '.ts', '.jsx', '.tsx', '.py'].includes(ext)) {
    return 'entity'
  }
  
  if (filePath.includes('README') || filePath.includes('docs')) {
    return 'concept'
  }
  
  return 'source'
}
```

---

## 四、测试方案

### 4.1 单元测试

```typescript
// tests/content-classifier.test.ts

import { describe, it, expect } from 'bun:test'
import { ContentClassifier } from '../src/core/content-classifier'

describe('ContentClassifier', () => {
  const classifier = new ContentClassifier()
  
  describe('Entity Classification', () => {
    it('should classify TypeScript files as entity', () => {
      const result = classifier.classify(
        '/src/auth/login-service.ts',
        'export class LoginService { }'
      )
      expect(result.category).toBe('entity')
      expect(result.confidence).toBeGreaterThan(0.8)
    })
    
    it('should classify React components as entity', () => {
      const result = classifier.classify(
        '/src/components/LoginForm.component.tsx',
        'export const LoginForm = () => { return <form></form> }'
      )
      expect(result.category).toBe('entity')
    })
  })
  
  describe('Concept Classification', () => {
    it('should classify architecture docs as concept', () => {
      const result = classifier.classify(
        '/docs/architecture/api-design.md',
        '# API Design\n\nThis document describes the API architecture...'
      )
      expect(result.category).toBe('concept')
    })
    
    it('should classify flow diagrams as concept', () => {
      const result = classifier.classify(
        '/docs/flows/authentication-flow.md',
        '# Authentication Flow\n\n```mermaid\ngraph TD\n'
      )
      expect(result.category).toBe('concept')
    })
  })
  
  describe('Source Classification', () => {
    it('should classify README as source', () => {
      const result = classifier.classify(
        '/README.md',
        '# Project Name\n\nThis is the project README...'
      )
      expect(result.category).toBe('source')
      expect(result.confidence).toBeGreaterThan(0.9)
    })
    
    it('should classify config files as source', () => {
      const result = classifier.classify(
        '/tsconfig.json',
        '{ "compilerOptions": { } }'
      )
      expect(result.category).toBe('source')
    })
  })
  
  describe('Synthesis Classification', () => {
    it('should classify ADR documents as synthesis', () => {
      const result = classifier.classify(
        '/docs/adr/ADR-001-database-choice.md',
        '# ADR-001: Database Choice\n\n## Decision\n\nWe chose PostgreSQL...'
      )
      expect(result.category).toBe('synthesis')
    })
    
    it('should classify migration guides as synthesis', () => {
      const result = classifier.classify(
        '/docs/migration-guide.md',
        '# Migration Guide\n\nThis guide covers migration from v1 to v2...'
      )
      expect(result.category).toBe('synthesis')
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle empty files', () => {
      const result = classifier.classify('/src/empty.ts', '')
      expect(result.category).toBeDefined()
    })
    
    it('should provide reasons for classification', () => {
      const result = classifier.classify(
        '/src/user.ts',
        'export class User { }'
      )
      expect(result.reasons.length).toBeGreaterThan(0)
    })
  })
})
```

### 4.2 准确率测试

```typescript
// tests/classification-accuracy.test.ts

import { describe, it, expect } from 'bun:test'
import { ContentClassifier } from '../src/core/content-classifier'
import { promises as fs } from 'fs'
import path from 'path'

describe('Classification Accuracy', () => {
  const classifier = new ContentClassifier()
  const testCases = [
    // 预定义的测试用例
    { file: 'src/auth/login.ts', expectedCategory: 'entity' },
    { file: 'docs/api-design.md', expectedCategory: 'concept' },
    { file: 'README.md', expectedCategory: 'source' },
    { file: 'docs/ADR-001-db-choice.md', expectedCategory: 'synthesis' },
  ]
  
  it('should achieve > 90% accuracy on test cases', async () => {
    let correct = 0
    
    for (const testCase of testCases) {
      const content = await fs.readFile(testCase.file, 'utf-8').catch(() => '')
      const result = classifier.classify(testCase.file, content)
      
      if (result.category === testCase.expectedCategory) {
        correct++
      } else {
        console.log(`Misclassified: ${testCase.file}`)
        console.log(`  Expected: ${testCase.expectedCategory}`)
        console.log(`  Got: ${result.category}`)
        console.log(`  Reasons: ${result.reasons.join(', ')}`)
      }
    }
    
    const accuracy = correct / testCases.length
    expect(accuracy).toBeGreaterThan(0.9)
  })
})
```

---

## 五、验收标准

### 5.1 功能验收

- [x] 支持 4 种分类：entity, concept, source, synthesis
- [x] 基于文件扩展名快速分类
- [x] 基于文件路径模式分类
- [x] 基于内容特征分析分类
- [x] 提供分类置信度
- [x] 提供分类理由

### 5.2 性能验收

- [ ] 单个文件分类时间 < 50ms
- [ ] 1000 个文件批量分类 < 5s
- [ ] 内存占用增量 < 10MB

### 5.3 准确率验收

- [ ] 测试用例准确率 > 90%
- [ ] Entity 分类准确率 > 95%
- [ ] Source 分类准确率 > 95%
- [ ] Concept 分类准确率 > 85%
- [ ] Synthesis 分类准确率 > 80%

---

## 六、实施计划

| 任务 | 预计时间 |
|------|---------|
| 实现 ContentClassifier 核心类 | 3h |
| 编写分类规则 | 2h |
| 集成到 KnowledgeBase | 1h |
| 单元测试 | 2h |
| 准确率测试和调优 | 2h |
| 文档更新 | 1h |

**总计: 11h (约 2 天)**

---

## 七、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 分类准确率不达标 | 中 | 增加更多规则，调整权重 |
| 性能瓶颈 | 低 | 使用缓存，优化正则表达式 |
| 边界情况处理 | 低 | 提供手动覆盖机制 |
| 规则冲突 | 中 | 使用权重机制解决冲突 |

---

**设计完成 (v1.1)。采用纯规则引擎方案，无外部依赖。**
