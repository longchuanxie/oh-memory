# P0 核心需求设计文档

> **文档版本**: v1.0  
> **创建日期**: 2026-04-19  
> **优先级**: P0 - 必须做  
> **目标版本**: V1.1 ~ V1.3  

---

## 一、概述

P0 需求是 OpenCode Memory 系统的核心功能，决定产品的竞争力。这些需求覆盖数据存储、检索机制、核心集成和性能保障四个关键领域，共 16 项功能。

### 核心目标

1. **构建可靠的知识存储基础** - 支持大型项目的知识组织和管理
2. **实现智能检索体验** - 上下文感知查询，主动知识推荐
3. **深度集成 OpenCode** - 与编辑器、版本控制、Agent 系统无缝协作
4. **保障性能和安全** - 满足企业级项目的性能要求

---

## 二、数据存储层需求

### REQ-001: 多层次目录结构

#### 2.1.1 需求描述

支持按功能模块、组件、页面等多级嵌套组织知识，解决大型项目知识粒度不足的问题。

#### 2.1.2 用户场景

**场景 1: 大型前端项目**
```
用户有一个包含 50+ 组件的前端项目，现有系统只有 entities/、concepts/ 四个分类，
导致所有组件知识混在一起，难以查找。
```

**期望结果**:
```
.memory/
├── entities/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── login-form.md
│   │   │   ├── auth-provider.md
│   │   │   └── permission-guard.md
│   │   ├── layout/
│   │   │   ├── header.md
│   │   │   ├── sidebar.md
│   │   │   └── footer.md
│   │   └── common/
│   │       ├── button.md
│   │       └── modal.md
│   └── services/
│       ├── api/
│       │   ├── auth-api.md
│       │   └── user-api.md
│       └── utils/
│           ├── date-utils.md
│           └── validation.md
```

#### 2.1.3 功能规格

| 项目 | 规格 |
|------|------|
| 最大嵌套深度 | 5 层 |
| 单层目录数量限制 | 无限制 |
| 路径分隔符 | `/` |
| 命名规则 | 小写字母、数字、连字符，不含空格 |

#### 2.1.4 技术实现

**目录结构映射**:
```typescript
interface KnowledgePath {
  category: 'entities' | 'concepts' | 'sources' | 'synthesis'
  subcategories: string[]  // 支持多级嵌套
  name: string
}

// 示例: entities/components/auth/login-form
function parseKnowledgePath(path: string): KnowledgePath {
  const parts = path.split('/')
  return {
    category: parts[0] as KnowledgePath['category'],
    subcategories: parts.slice(1, -1),
    name: parts[parts.length - 1]
  }
}
```

**自动目录创建**:
- 在 `memory-ingest` 时，根据源文件路径自动推断目录结构
- 支持用户自定义映射规则

#### 2.1.5 验收标准

- [ ] 支持创建 5 层深度的目录结构
- [ ] 图索引正确处理多级路径的节点
- [ ] 查询结果正确显示完整路径
- [ ] `memory-lint` 能检测目录结构问题

---

### REQ-002: 依赖关系图谱

#### 2.2.1 需求描述

自动识别和记录模块间的依赖关系，包括项目内部依赖和外部依赖，构建完整的依赖网络。

#### 2.2.2 用户场景

**场景 1: 理解模块依赖**
```
用户正在修改 auth 模块，需要知道哪些模块依赖它，
以及它依赖了哪些模块，以评估修改影响范围。
```

**期望结果**:
```markdown
# auth-module

## Dependencies (依赖)

- [[user-model]] - 用户数据模型
- [[database-connection]] - 数据库连接
- [[crypto-utils]] - 加密工具
- external: bcrypt (v5.1.0)
- external: jsonwebtoken (v9.0.0)

## Dependents (被依赖)

- [[api-routes]] - API 路由使用认证中间件
- [[admin-panel]] - 管理面板需要权限检查
- [[user-profile]] - 用户资料页需要登录状态
```

#### 2.2.3 功能规格

| 依赖类型 | 描述 | 示例 |
|---------|------|------|
| 内部依赖 | 项目内模块间的依赖 | `import { User } from './models/user'` |
| 外部依赖 | npm 包依赖 | `import bcrypt from 'bcrypt'` |
| 隐式依赖 | 通过配置或约定产生的依赖 | 环境变量、配置文件 |

#### 2.2.4 技术实现

**依赖提取器**:
```typescript
interface DependencyExtractor {
  language: string
  extract(fileContent: string, filePath: string): Dependency[]
}

interface Dependency {
  type: 'internal' | 'external' | 'implicit'
  source: string
  target: string
  location: { line: number; column: number }
}

// TypeScript/JavaScript 提取器
class TypeScriptDependencyExtractor implements DependencyExtractor {
  language = 'typescript'
  
  extract(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = []
    const ast = parseTypeScript(content)
    
    // 提取 import 语句
    traverse(ast, {
      ImportDeclaration(node) {
        dependencies.push({
          type: node.source.value.startsWith('.') ? 'internal' : 'external',
          source: filePath,
          target: node.source.value,
          location: { line: node.loc.start.line, column: node.loc.start.column }
        })
      }
    })
    
    return dependencies
  }
}
```

**依赖图谱存储**:
```json
{
  "nodes": [
    { "id": "auth-module", "type": "internal" },
    { "id": "bcrypt", "type": "external", "version": "5.1.0" }
  ],
  "edges": [
    { 
      "from": "auth-module", 
      "to": "bcrypt", 
      "type": "depends-on",
      "location": { "file": "auth.ts", "line": 5 }
    }
  ]
}
```

#### 2.2.5 验收标准

- [ ] 支持 TypeScript/JavaScript 的 import/require 依赖提取
- [ ] 支持 Python 的 import 依赖提取
- [ ] 外部依赖显示包名和版本号
- [ ] 依赖变更时自动更新图谱
- [ ] 提供依赖影响分析命令

---

### REQ-003: 双向链接网络

#### 2.3.1 需求描述

使用 `[[page-name]]` 语法构建知识间的双向链接，自动维护链接关系，支持链接验证和可视化。

#### 2.3.2 用户场景

**场景 1: 知识关联导航**
```
用户在阅读 [[auth-module]] 页面时，看到引用了 [[user-model]]，
点击链接直接跳转到用户模型的知识页面。
```

**场景 2: 反向链接查看**
```
用户想知道哪些页面引用了 [[user-model]]，
系统显示所有反向链接列表。
```

#### 2.3.3 功能规格

| 链接类型 | 语法 | 示例 |
|---------|------|------|
| 基本链接 | `[[page-name]]` | `[[auth-module]]` |
| 带显示文本 | `[[page-name\|显示文本]]` | `[[auth-module\|认证系统]]` |
| 带路径 | `[[category/sub/page]]` | `[[entities/components/login-form]]` |
| 外部链接 | `[[https://url\|描述]]` | `[[https://docs.nodejs.org\|Node.js 文档]]` |

#### 2.3.4 技术实现

**链接提取**:
```typescript
interface WikiLink {
  target: string
  displayText: string | null
  isExternal: boolean
  location: { line: number; start: number; end: number }
}

function extractWikiLinks(content: string): WikiLink[] {
  const pattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
  const links: WikiLink[] = []
  
  let match
  while ((match = pattern.exec(content)) !== null) {
    const target = match[1].trim()
    links.push({
      target,
      displayText: match[2]?.trim() || null,
      isExternal: target.startsWith('http://') || target.startsWith('https://'),
      location: {
        line: getLineNumber(content, match.index),
        start: match.index,
        end: match.index + match[0].length
      }
    })
  }
  
  return links
}
```

**反向链接索引**:
```typescript
interface BacklinkIndex {
  // target -> sources[]
  backlinks: Map<string, Set<string>>
  
  addLink(source: string, target: string): void
  removeLink(source: string, target: string): void
  getBacklinks(target: string): string[]
}
```

#### 2.3.5 验收标准

- [ ] 正确提取所有类型的 Wiki 链接
- [ ] 自动维护反向链接索引
- [ ] 检测并报告断裂链接
- [ ] 图可视化正确显示链接关系

---

### REQ-004: 标签系统

#### 2.4.1 需求描述

支持多维度标签，用于知识的灵活分类、筛选和聚合。

#### 2.4.2 用户场景

**场景 1: 按标签筛选**
```
用户想查看所有与 "security" 相关的知识点，
使用标签筛选快速定位。
```

**场景 2: 标签聚合**
```
用户想了解项目中所有 "deprecated" 标记的知识，
查看需要迁移或更新的内容。
```

#### 2.4.3 功能规格

| 标签类型 | 示例 | 用途 |
|---------|------|------|
| 功能标签 | `authentication`, `database`, `api` | 按功能域分类 |
| 状态标签 | `deprecated`, `experimental`, `stable` | 标记知识状态 |
| 优先级标签 | `critical`, `important`, `optional` | 标记重要性 |
| 自定义标签 | 用户自定义 | 灵活扩展 |

#### 2.4.4 技术实现

**标签存储**:
```yaml
---
title: Auth Module
type: entity
tags:
  - authentication
  - security
  - critical
  - deprecated
deprecated_since: "2026-04-01"
replacement: "[[auth-module-v2]]"
---
```

**标签索引**:
```typescript
interface TagIndex {
  // tag -> page paths
  index: Map<string, Set<string>>
  
  addTag(pagePath: string, tag: string): void
  removeTag(pagePath: string, tag: string): void
  getPagesByTag(tag: string): string[]
  getTagsByPage(pagePath: string): string[]
  getAllTags(): string[]
}
```

#### 2.4.5 验收标准

- [ ] 支持在 frontmatter 中定义标签
- [ ] 支持按标签筛选查询结果
- [ ] 支持标签聚合视图
- [ ] 标签变更时自动更新索引

---

### REQ-005: 智能知识分类

#### 2.5.1 需求描述

自动根据内容特征将知识分类到 entities、concepts、sources、synthesis 四个主要类别。

#### 2.5.2 分类规则

| 类别 | 判断依据 | 示例 |
|------|---------|------|
| entities | 代码实体（函数、类、模块、组件） | `login-form.tsx` → entities |
| concepts | 架构概念、设计模式、流程 | `authentication-flow.md` → concepts |
| sources | 源文档摘要、外部资料 | `README.md` → sources |
| synthesis | 综合分析、跨模块总结 | `api-design-decisions.md` → synthesis |

#### 2.5.3 技术实现

**分类器**:
```typescript
interface ContentClassifier {
  classify(content: string, filePath: string, metadata: FileMetadata): Category
}

class IntelligentClassifier implements ContentClassifier {
  classify(content: string, filePath: string, metadata: FileMetadata): Category {
    // 规则 1: 根据文件扩展名
    if (this.isSourceCode(filePath)) {
      return 'entities'
    }
    
    // 规则 2: 根据内容特征
    if (this.hasCodeExamples(content) && this.definesEntity(content)) {
      return 'entities'
    }
    
    // 规则 3: 根据文件名模式
    if (filePath.match(/(README|CHANGELOG|CONTRIBUTING)/i)) {
      return 'sources'
    }
    
    // 规则 4: 使用 LLM 分类
    return this.llmClassify(content)
  }
}
```

#### 2.5.4 验收标准

- [ ] 源代码文件自动分类为 entities
- [ ] 文档文件根据内容智能分类
- [ ] 分类准确率 > 90%
- [ ] 支持用户手动覆盖分类

---

## 三、检索机制层需求

### REQ-006: 上下文感知查询

#### 3.1.1 需求描述

理解用户当前的编辑上下文（正在编辑的文件、最近的操作、问题类型），智能调整查询结果的相关性排序。

#### 3.1.2 用户场景

**场景 1: 编辑文件时的智能查询**
```
用户正在编辑 src/auth/login.ts，执行查询:
/memory-query 如何处理用户会话？

系统自动:
1. 识别当前文件是 auth/login.ts
2. 提升认证相关知识的权重
3. 优先返回登录流程相关的知识
```

**场景 2: 最近操作上下文**
```
用户最近:
1. 查询了 "authentication"
2. 访问了 [[auth-module]] 页面
3. 修改了 auth/login.ts

执行查询:
/memory-query 错误处理

系统自动:
1. 关联到认证流程的错误处理
2. 返回相关的错误处理模式
```

#### 3.1.3 功能规格

| 上下文类型 | 数据来源 | 权重影响 |
|-----------|---------|---------|
| 当前文件 | 编辑器活动文件 | 高 (+0.3) |
| 最近查询 | 查询历史记录 | 中 (+0.2) |
| 最近访问 | 页面访问日志 | 中 (+0.2) |
| 最近修改 | Git diff / 文件变更 | 低 (+0.1) |

#### 3.1.4 技术实现

**上下文管理器**:
```typescript
interface UserContext {
  currentFile: string | null
  recentQueries: string[]
  recentPages: string[]
  recentChanges: string[]
  lastUpdated: Date
}

class ContextManager {
  private context: UserContext
  
  updateCurrentFile(filePath: string): void {
    this.context.currentFile = filePath
    this.context.lastUpdated = new Date()
  }
  
  addRecentQuery(query: string): void {
    this.context.recentQueries.unshift(query)
    if (this.context.recentQueries.length > 10) {
      this.context.recentQueries.pop()
    }
  }
  
  getContextBoost(pagePath: string): number {
    let boost = 0
    
    // 当前文件相关
    if (this.context.currentFile) {
      const related = this.checkRelated(this.context.currentFile, pagePath)
      if (related) boost += 0.3
    }
    
    // 最近访问
    if (this.context.recentPages.includes(pagePath)) {
      boost += 0.2
    }
    
    return boost
  }
}
```

**查询增强**:
```typescript
async query(query: string, context: UserContext): Promise<QueryResult> {
  // 1. 执行基础查询
  const baseResults = await this.baseQuery(query)
  
  // 2. 应用上下文增强
  const enhancedResults = baseResults.map(result => ({
    ...result,
    score: result.score + this.contextManager.getContextBoost(result.path)
  }))
  
  // 3. 重新排序
  return enhancedResults.sort((a, b) => b.score - a.score)
}
```

#### 3.1.5 验收标准

- [ ] 正确识别当前编辑的文件
- [ ] 记录最近 10 条查询历史
- [ ] 记录最近 20 个访问页面
- [ ] 上下文相关结果排在前列

---

### REQ-007: 当前文件关联

#### 3.2.1 需求描述

自动识别正在编辑的文件，优先返回与该文件直接相关的知识点。

#### 3.2.2 用户场景

**场景 1: 自动关联提示**
```
用户打开 src/auth/login.ts 文件，
系统自动显示:
"相关知识点: [[auth-module]], [[session-management]], [[user-authentication]]"
```

#### 3.2.3 技术实现

**文件-知识映射**:
```typescript
interface FileKnowledgeMapper {
  // 源文件路径 -> 知识页面路径
  mappings: Map<string, string[]>
  
  buildMappings(): void
  getRelatedKnowledge(filePath: string): string[]
}

class DefaultFileKnowledgeMapper implements FileKnowledgeMapper {
  buildMappings(): void {
    // 遍历所有知识页面
    for (const page of this.getAllPages()) {
      // 从 frontmatter 获取源文件
      const sourceFile = page.frontmatter.sourceFile
      if (sourceFile) {
        const existing = this.mappings.get(sourceFile) || []
        existing.push(page.path)
        this.mappings.set(sourceFile, existing)
      }
    }
  }
}
```

#### 3.2.4 验收标准

- [ ] 打开文件时自动显示相关知识
- [ ] 关联准确率 > 85%
- [ ] 支持手动关联/取消关联

---

### REQ-008: 智能推荐

#### 3.3.1 需求描述

在用户编辑代码时，主动推荐相关的 API 文档、示例代码、最佳实践，无需等待查询。

#### 3.3.2 用户场景

**场景 1: API 使用推荐**
```
用户输入: import { useAuth } from 

系统推荐:
- [[useAuth-hook]] - 认证 Hook 使用指南
- 相关示例: 如何在组件中使用 useAuth
- 最佳实践: 认证状态管理
```

#### 3.3.3 功能规格

| 触发条件 | 推荐内容 | 展示方式 |
|---------|---------|---------|
| 输入 import 语句 | 相关模块知识 | 代码补全提示 |
| 调用函数 | 函数文档和示例 | 悬浮提示 |
| 使用特定 API | 最佳实践 | 侧边栏推荐 |

#### 3.3.4 技术实现

**推荐引擎**:
```typescript
interface RecommendationEngine {
  analyze(context: EditorContext): Recommendation[]
}

interface Recommendation {
  type: 'api-doc' | 'example' | 'best-practice'
  title: string
  knowledgePath: string
  snippet: string
  relevance: number
}

class ContextualRecommender implements RecommendationEngine {
  analyze(context: EditorContext): Recommendation[] {
    const recommendations: Recommendation[] = []
    
    // 分析当前输入
    if (context.currentLine.includes('import')) {
      const moduleName = this.extractModuleName(context.currentLine)
      const knowledge = this.findModuleKnowledge(moduleName)
      if (knowledge) {
        recommendations.push({
          type: 'api-doc',
          title: knowledge.title,
          knowledgePath: knowledge.path,
          snippet: knowledge.summary,
          relevance: 0.9
        })
      }
    }
    
    return recommendations.sort((a, b) => b.relevance - a.relevance)
  }
}
```

#### 3.3.5 验收标准

- [ ] 输入 import 时触发推荐
- [ ] 推荐内容相关性 > 80%
- [ ] 推荐延迟 < 500ms
- [ ] 支持禁用/启用推荐

---

## 四、核心集成层需求

### REQ-009: 代码跳转

#### 4.1.1 需求描述

从 memory 知识页面一键跳转到对应的源代码位置，实现知识与代码的双向导航。

#### 4.1.2 用户场景

**场景 1: 从知识跳转到代码**
```
用户在阅读 [[login-form]] 页面时，
点击 "查看源代码" 按钮，
直接跳转到 src/components/auth/LoginForm.tsx 文件。
```

#### 4.1.3 功能规格

| 功能 | 描述 |
|------|------|
| 源文件链接 | 知识页面显示源文件路径和行号 |
| 一键跳转 | 点击链接打开编辑器并定位 |
| 多位置支持 | 一个知识可关联多个代码位置 |

#### 4.1.4 技术实现

**源文件元数据**:
```yaml
---
title: Login Form
type: entity
sourceFile: src/components/auth/LoginForm.tsx
sourceLocations:
  - path: src/components/auth/LoginForm.tsx
    line: 15
    description: 组件定义
  - path: src/components/auth/LoginForm.tsx
    line: 42
    description: 表单提交逻辑
---
```

**跳转命令**:
```typescript
// VSCode 风格的跳转
function jumpToSource(location: SourceLocation): void {
  const uri = vscode.Uri.file(path.join(projectRoot, location.path))
  vscode.window.showTextDocument(uri, {
    selection: new vscode.Range(
      location.line - 1, 0,
      location.line - 1, 0
    )
  })
}
```

#### 4.1.5 验收标准

- [ ] 知识页面显示源文件链接
- [ ] 点击链接正确跳转到代码位置
- [ ] 支持多个源文件位置

---

### REQ-010: 版本控制集成

#### 4.2.1 需求描述

知识与代码版本同步演进，支持历史追溯、变更关联和分支隔离。

#### 4.2.2 用户场景

**场景 1: 变更关联**
```
用户提交代码变更后，
系统自动检测相关知识的更新需求，
提示用户审阅和更新知识。
```

**场景 2: 历史追溯**
```
用户想了解某个 API 的演进历史，
查看不同版本的知识快照。
```

#### 4.2.3 功能规格

| 功能 | 描述 |
|------|------|
| 变更检测 | Git commit 后自动检测相关知识变更 |
| 知识快照 | 重要版本创建知识快照 |
| 历史查看 | 查看任意 commit 对应的知识状态 |

#### 4.2.4 技术实现

**Git 集成**:
```typescript
interface GitIntegration {
  getChangedFiles(since: string): Promise<ChangedFile[]>
  createKnowledgeSnapshot(commitHash: string): Promise<void>
  getKnowledgeAtCommit(commitHash: string): Promise<KnowledgeSnapshot>
}

class GitKnowledgeIntegration implements GitIntegration {
  async getChangedFiles(since: string): Promise<ChangedFile[]> {
    const result = await exec(`git diff --name-only ${since}`)
    return result.stdout.split('\n').filter(Boolean).map(path => ({
      path,
      status: await this.getFileStatus(path, since)
    }))
  }
  
  async createKnowledgeSnapshot(commitHash: string): Promise<void> {
    const snapshotDir = `.memory/snapshots/${commitHash}`
    await fs.mkdir(snapshotDir, { recursive: true })
    await this.copyKnowledgeBase(snapshotDir)
  }
}
```

#### 4.2.5 验收标准

- [ ] Git commit 后检测文件变更
- [ ] 支持创建知识快照
- [ ] 支持查看历史知识状态

---

### REQ-011: Agent 记忆共享

#### 4.3.1 需求描述

多个 AI Agent 之间共享上下文和学习到的知识，支持协作式问题解决。

#### 4.3.2 用户场景

**场景 1: 多 Agent 协作**
```
Agent A 负责代码审查，学习了项目的代码规范。
Agent B 负责功能开发，可以访问 Agent A 学习到的规范知识，
自动遵循项目规范编写代码。
```

#### 4.3.3 功能规格

| 功能 | 描述 |
|------|------|
| 共享知识库 | 所有 Agent 可访问的知识区域 |
| Agent 专属知识 | 特定 Agent 的私有学习结果 |
| 知识同步 | Agent 间的知识更新通知 |

#### 4.3.4 技术实现

**Agent 知识管理**:
```typescript
interface AgentKnowledgeManager {
  // 共享知识
  sharedKnowledge: KnowledgeBase
  
  // Agent 专属知识
  agentKnowledge: Map<string, KnowledgeBase>
  
  // 同步知识到共享区域
  shareKnowledge(agentId: string, knowledgePath: string): void
  
  // 获取共享知识
  getSharedKnowledge(query: string): Promise<QueryResult>
}
```

#### 4.3.5 验收标准

- [ ] Agent 可读取共享知识
- [ ] Agent 可贡献知识到共享区域
- [ ] 知识更新时通知相关 Agent

---

## 五、性能保障层需求

### REQ-012: 增量索引

#### 5.1.1 需求描述

只索引变更的文件，避免全量重建，大幅提升大型项目的索引效率。

#### 5.1.2 用户场景

**场景 1: 大型项目增量更新**
```
项目有 1000+ 文件，用户修改了 3 个文件。
系统只重新索引这 3 个文件，而不是全部 1000+ 文件。
索引时间从 30 秒降低到 1 秒。
```

#### 5.1.3 功能规格

| 指标 | 目标值 |
|------|--------|
| 增量索引时间 | < 2 秒（10 个文件变更） |
| 全量索引时间 | < 30 秒（1000 个文件） |
| 变更检测准确率 | 100% |

#### 5.1.4 技术实现

**文件哈希追踪**:
```typescript
interface FileHashIndex {
  // 文件路径 -> 哈希值
  hashes: Map<string, string>
  
  detectChanges(): Promise<ChangedFile[]>
  updateHash(filePath: string, hash: string): void
}

class IncrementalIndexer {
  private hashIndex: FileHashIndex
  
  async incrementalUpdate(): Promise<void> {
    const changes = await this.hashIndex.detectChanges()
    
    for (const file of changes) {
      if (file.status === 'deleted') {
        await this.removeFromIndex(file.path)
      } else {
        await this.updateInIndex(file.path)
      }
      
      this.hashIndex.updateHash(file.path, await this.computeHash(file.path))
    }
  }
  
  private async computeHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8')
    return crypto.createHash('md5').update(content).digest('hex')
  }
}
```

#### 5.1.5 验收标准

- [ ] 正确检测文件变更
- [ ] 增量索引时间 < 2 秒
- [ ] 索引结果与全量索引一致

---

### REQ-013: 分层缓存

#### 5.2.1 需求描述

实现内存缓存 → 文件缓存 → 重建索引的三层缓存架构，最大化查询性能。

#### 5.2.2 缓存架构

```
┌─────────────────────────────────────┐
│          L1: 内存缓存                │
│  - 图结构数据                        │
│  - 热点知识页面                      │
│  - 命中率目标: 80%                   │
│  - 响应时间: < 10ms                  │
└─────────────────────────────────────┘
                 ↓ Miss
┌─────────────────────────────────────┐
│          L2: 文件缓存                │
│  - graph.json                       │
│  - 命中率目标: 95%                   │
│  - 响应时间: < 100ms                 │
└─────────────────────────────────────┘
                 ↓ Miss
┌─────────────────────────────────────┐
│          L3: 重建索引                │
│  - 扫描所有文件                      │
│  - 重建图结构                        │
│  - 响应时间: < 3 秒                  │
└─────────────────────────────────────┘
```

#### 5.2.3 技术实现

**缓存管理器**:
```typescript
interface CacheManager {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttl?: number): Promise<void>
  invalidate(key: string): Promise<void>
}

class LayeredCacheManager implements CacheManager {
  private memoryCache: Map<string, { value: any; expiry: number }> = new Map()
  private cacheDir: string
  
  async get<T>(key: string): Promise<T | null> {
    // L1: 内存缓存
    const memoryHit = this.memoryCache.get(key)
    if (memoryHit && memoryHit.expiry > Date.now()) {
      return memoryHit.value as T
    }
    
    // L2: 文件缓存
    const filePath = path.join(this.cacheDir, `${key}.json`)
    if (await fs.exists(filePath)) {
      const content = await fs.readFile(filePath, 'utf-8')
      const value = JSON.parse(content)
      this.memoryCache.set(key, { value, expiry: Date.now() + 300000 }) // 5 分钟
      return value as T
    }
    
    return null
  }
  
  async set<T>(key: string, value: T, ttl: number = 300000): Promise<void> {
    // 写入 L1
    this.memoryCache.set(key, { value, expiry: Date.now() + ttl })
    
    // 写入 L2
    const filePath = path.join(this.cacheDir, `${key}.json`)
    await fs.writeFile(filePath, JSON.stringify(value))
  }
}
```

#### 5.2.4 验收标准

- [ ] L1 缓存命中率 > 80%
- [ ] L2 缓存命中率 > 95%
- [ ] 缓存查询响应 < 100ms

---

### REQ-014: 查询性能指标

#### 5.3.1 需求描述

定义并实现查询性能的硬性指标，确保用户体验。

#### 5.3.2 性能目标

| 指标 | 目标值 | 测量方法 |
|------|--------|---------|
| 首次查询 | < 3 秒 | 冷启动后第一次查询 |
| 重复查询 | < 100ms | 相同查询第二次执行 |
| 模糊搜索 | < 500ms | 模糊匹配查询 |
| 图遍历 | < 200ms | 遍历 3 层关联节点 |

#### 5.3.3 技术实现

**性能监控**:
```typescript
interface PerformanceMonitor {
  recordQuery(duration: number, type: QueryType): void
  getStats(): PerformanceStats
}

class QueryPerformanceMonitor implements PerformanceMonitor {
  private records: QueryRecord[] = []
  
  recordQuery(duration: number, type: QueryType): void {
    this.records.push({
      duration,
      type,
      timestamp: Date.now()
    })
    
    // 检查是否超过阈值
    const threshold = this.getThreshold(type)
    if (duration > threshold) {
      console.warn(`Query performance warning: ${duration}ms > ${threshold}ms`)
    }
  }
  
  getStats(): PerformanceStats {
    return {
      avgDuration: this.calculateAverage(),
      p50: this.calculatePercentile(50),
      p95: this.calculatePercentile(95),
      p99: this.calculatePercentile(99)
    }
  }
}
```

#### 5.3.4 验收标准

- [ ] 首次查询 < 3 秒
- [ ] 重复查询 < 100ms
- [ ] 性能监控数据可查询

---

### REQ-015: 大型项目支持

#### 5.4.1 需求描述

支持 1000+ 模块的大型项目索引和查询，保证性能和稳定性。

#### 5.4.2 功能规格

| 指标 | 目标值 |
|------|--------|
| 最大支持文件数 | 10,000+ |
| 最大支持知识页面 | 5,000+ |
| 内存占用 | < 500MB |
| 索引文件大小 | < 50MB |

#### 5.4.3 技术实现

**分片索引**:
```typescript
interface ShardedIndex {
  shards: Map<string, IndexShard>
  shardSize: number
  
  getShard(key: string): IndexShard
  addToShard(key: string, entry: IndexEntry): void
}

class LargeProjectIndexer {
  private shardedIndex: ShardedIndex
  
  async indexLargeProject(rootPath: string): Promise<void> {
    const files = await this.discoverFiles(rootPath)
    
    // 分批处理
    const batchSize = 100
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      await Promise.all(batch.map(f => this.indexFile(f)))
      
      // 报告进度
      this.reportProgress(i / files.length)
    }
  }
}
```

#### 5.4.4 验收标准

- [ ] 支持 10,000+ 文件索引
- [ ] 内存占用 < 500MB
- [ ] 查询性能不随文件数线性下降

---

### REQ-016: 敏感信息过滤

#### 5.5.1 需求描述

自动识别并过滤 API 密钥、密码、Token 等敏感信息，防止泄露。

#### 5.5.2 敏感信息类型

| 类型 | 模式 | 处理方式 |
|------|------|---------|
| API 密钥 | `api[_-]?key`, `apikey` | 过滤 |
| 密码 | `password`, `passwd`, `pwd` | 过滤 |
| Token | `Bearer\s+[A-Za-z0-9]`, `token` | 过滤 |
| 私钥 | `-----BEGIN.*PRIVATE KEY-----` | 过滤 |
| 连接字符串 | 包含密码的数据库连接串 | 过滤 |

#### 5.5.3 技术实现

**敏感信息检测器**:
```typescript
interface SensitiveDataFilter {
  scan(content: string): SensitiveDataMatch[]
  redact(content: string): string
}

class RegexSensitiveDataFilter implements SensitiveDataFilter {
  private patterns: Map<string, RegExp> = new Map([
    ['api_key', /api[_-]?key\s*[=:]\s*['"]?([a-zA-Z0-9_-]+)/gi],
    ['password', /(?:password|passwd|pwd)\s*[=:]\s*['"]?([^\s'"]+)/gi],
    ['bearer_token', /Bearer\s+([a-zA-Z0-9_-]+)/gi],
    ['private_key', /-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/g],
    ['connection_string', /(?:mysql|postgres|mongodb):\/\/[^:]+:[^@]+@[^\s]+/gi]
  ])
  
  scan(content: string): SensitiveDataMatch[] {
    const matches: SensitiveDataMatch[] = []
    
    for (const [type, pattern] of this.patterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        matches.push({
          type,
          value: match[0],
          location: { start: match.index, end: match.index + match[0].length }
        })
      }
    }
    
    return matches
  }
  
  redact(content: string): string {
    const matches = this.scan(content)
    let redacted = content
    
    // 从后往前替换，避免位置偏移
    matches.sort((a, b) => b.location.start - a.location.start)
    
    for (const match of matches) {
      redacted = redacted.slice(0, match.location.start) 
        + `[REDACTED:${match.type}]` 
        + redacted.slice(match.location.end)
    }
    
    return redacted
  }
}
```

#### 5.5.4 验收标准

- [ ] 检测所有已知的敏感信息模式
- [ ] 过滤后不包含原始敏感信息
- [ ] 记录过滤日志供审计

---

## 六、实施计划

### V1.1 版本（2-3 周）

| 需求 | 预计工时 | 依赖 |
|------|---------|------|
| REQ-012 增量索引 | 3 天 | 无 |
| REQ-013 分层缓存 | 2 天 | REQ-012 |
| REQ-014 查询性能指标 | 1 天 | REQ-013 |
| REQ-015 大型项目支持 | 2 天 | REQ-012, REQ-013 |
| REQ-016 敏感信息过滤 | 1 天 | 无 |
| REQ-003 双向链接网络 | 2 天 | 无 |
| REQ-004 标签系统 | 1 天 | 无 |
| REQ-005 智能知识分类 | 2 天 | 无 |

### V1.2 版本（3-4 周）

| 需求 | 预计工时 | 依赖 |
|------|---------|------|
| REQ-006 上下文感知查询 | 4 天 | REQ-013 |
| REQ-007 当前文件关联 | 2 天 | REQ-006 |
| REQ-008 智能推荐 | 4 天 | REQ-006, REQ-007 |
| REQ-001 多层次目录结构 | 3 天 | 无 |
| REQ-002 依赖关系图谱 | 4 天 | REQ-001 |

### V1.3 版本（2-3 周）

| 需求 | 预计工时 | 依赖 |
|------|---------|------|
| REQ-009 代码跳转 | 2 天 | 无 |
| REQ-010 版本控制集成 | 3 天 | 无 |
| REQ-011 Agent 记忆共享 | 3 天 | 无 |

---

## 七、验收清单

### 功能验收

- [ ] 所有 16 项需求功能完整实现
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试全部通过

### 性能验收

- [ ] 首次查询 < 3 秒
- [ ] 重复查询 < 100ms
- [ ] 支持 10,000+ 文件项目

### 安全验收

- [ ] 敏感信息过滤准确率 100%
- [ ] 无敏感信息泄露风险

### 兼容性验收

- [ ] 支持 TypeScript/JavaScript 项目
- [ ] 支持 Python 项目
- [ ] 支持 Windows/macOS/Linux

---

## 八、风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 性能目标未达成 | 高 | 中 | 提前进行性能基准测试 |
| 大型项目内存溢出 | 高 | 低 | 实现分片索引和流式处理 |
| 敏感信息漏过滤 | 高 | 低 | 多轮正则测试 + 人工审核 |
| Agent 集成复杂度高 | 中 | 中 | 分阶段实现，先支持基础功能 |

---

**文档结束**
