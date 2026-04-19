# Oh-Memory 插件设计文档

## 概述

oh-memory 是一个为 OpenCode 设计的知识库管理插件，基于 llm-wiki 的设计哲学，为项目提供智能化的知识管理能力。

## 设计目标

1. **知识积累**：将项目代码和文档转化为结构化的知识库
2. **自动进化**：监控项目变化，自动更新知识库
3. **智能查询**：支持自然语言查询，提供准确的知识检索
4. **人类友好**：提供可视化的审阅界面，确保知识质量

## 架构设计

### 三层架构

#### 1. Project Files（项目文件层 - 已有）
- **位置**：项目根目录下的所有代码和文档
- **内容**：源代码、文档、配置文件等
- **特点**：原始资料，LLM 只读取不修改
- **作用**：作为知识提取的源材料

#### 2. Knowledge Wiki（知识维基层 - 新建）
- **存储位置**：`.memory/` 目录
- **内容**：LLM 生成的结构化知识文件
  - `index.md`：知识库目录索引
  - `log.md`：操作日志
  - `entities/`：实体页面（模块、函数、类等）
  - `concepts/`：概念页面（架构、模式、流程等）
  - `sources/`：源文档摘要
  - `synthesis/`：综合分析页面
  - `pending/`：待审阅的内容
  - `graph.json`：图索引数据
  - `graph.html`：图可视化页面
- **特点**：使用 Markdown 双向链接 `[[页面名]]` 构建图结构

#### 3. Schema（模式配置层）
- **存储位置**：`.memory/SCHEMA.md`
- **内容**：指导 LLM 如何维护知识库的规则和约定
- **特点**：可自定义，随项目演进

## 命令设计

### 1. `/memory-init` - 初始化知识库
- 创建 `.memory/` 目录结构
- 生成默认的 `SCHEMA.md` 配置
- 创建空的 `index.md` 和 `log.md`
- 询问用户是否要摄入现有项目文件

### 2. `/memory-ingest [文件或目录]` - 摄入知识
- 读取指定的源文件或目录
- 提取关键信息并生成知识页面
- 更新相关的实体和概念页面
- 更新 `index.md` 和 `log.md`
- 生成审阅界面供用户审阅

### 3. `/memory-query [问题]` - 查询知识库
- 搜索相关的知识页面
- 综合多个页面生成回答
- 提供引用链接
- 可选择将优质回答保存为新页面

### 4. `/memory-lint` - 健康检查
- 检查双向链接的有效性
- 发现孤立页面和缺失的交叉引用
- 检测内容矛盾
- 生成修复建议
- 展示问题列表，用户选择修复项

## 自动进化机制

### 文件变化监控
- 插件监听项目文件的变化事件（通过 OpenCode 的 `file.watcher.updated` 钩子）
- 变化类型：新增、修改、删除
- 智能过滤：只关注知识库中已引用的文件或重要文件

### 变化检测策略
- **实时检测**：文件保存时立即检测变化
- **批量检测**：定期（如每天）扫描整个项目
- **Git 集成**：通过 git diff 检测变更范围
- **哈希对比**：使用文件内容哈希避免重复处理

### 自动更新触发条件
- 文件修改超过一定行数（可配置阈值）
- 关键文件（如 README、配置文件）的任何变化
- 新增的重要模块或组件
- 用户手动触发更新

### 自主更新流程
```
检测到变化 → 分析影响范围 → 
生成更新计划 → 展示给用户审阅 → 
执行更新 → 验证一致性 → 
记录到 log.md
```

### 智能更新策略
- **增量更新**：只更新受影响的知识页面
- **关联更新**：更新相关的实体和概念页面
- **冲突检测**：发现新旧知识矛盾时标记
- **版本追踪**：在知识页面中记录源文件的版本信息

### 配置选项
```json
{
  "autoEvolution": {
    "enabled": true,
    "watchPatterns": ["src/**/*.ts", "docs/**/*.md"],
    "ignorePatterns": ["**/*.test.ts", "**/node_modules/**"],
    "updateThreshold": 10,
    "scheduleTime": "daily",
    "requireApproval": true
  }
}
```

## 图索引实现

### Markdown 双向链接系统

#### 链接语法
- 基本链接：`[[页面名]]`
- 带显示文本：`[[页面名|显示文本]]`
- 带文件路径：`[[entities/auth-module]]`
- 外部链接：`[[https://example.com|外部资源]]`

#### 自动链接检测
- 插件自动扫描所有 Markdown 文件
- 提取所有 `[[...]]` 格式的链接
- 构建链接关系图（节点 + 边）
- 存储在 `.memory/graph.json` 中

#### 图数据结构
```json
{
  "nodes": [
    {
      "id": "auth-module",
      "title": "认证模块",
      "path": "entities/auth-module.md",
      "type": "entity",
      "tags": ["authentication", "security"],
      "lastUpdated": "2026-04-18"
    }
  ],
  "edges": [
    {
      "from": "auth-module",
      "to": "user-model",
      "type": "uses",
      "context": "认证模块使用用户模型"
    }
  ]
}
```

#### LLM 友好的检索策略
- **索引优先**：LLM 先读取 `index.md` 了解知识库全貌
- **链接跳转**：通过 `[[链接]]` 快速定位相关页面
- **上下文窗口优化**：按需加载相关页面，避免一次性加载过多
- **搜索工具**：提供 `memory-search` 自定义工具，LLM 可以调用

#### 图可视化
- 生成 `.memory/graph.html` 可视化页面
- 使用 D3.js 或 Mermaid 渲染知识图谱
- 支持交互式浏览：点击节点跳转到对应页面
- 显示节点类型、连接强度、更新频率

#### 图维护操作
- **添加节点**：创建新页面时自动添加
- **删除节点**：删除页面时清理相关链接
- **更新边**：内容变化时重新提取链接关系
- **孤立节点检测**：定期检查无入链的页面

## 验证和过滤机制

### 多层验证体系

#### 1. 格式验证
- **JSON Schema 验证**：
  - 为每种类型的知识页面定义 Schema
  - 验证 frontmatter 的必需字段（title, type, tags, date）
  - 验证 Markdown 结构（标题层级、列表格式等）

#### 2. 链接验证
- **有效性检查**：
  - 检查所有 `[[链接]]` 是否指向存在的页面
  - 标记断裂的链接（红色高亮）
  - 提供修复建议（创建缺失页面或删除链接）

- **孤立节点检测**：
  - 发现没有任何入链的页面
  - 提示可能需要添加交叉引用
  - 自动生成"待连接"列表

- **循环引用检测**：
  - 检测 A→B→C→A 类型的循环
  - 评估是否需要打破循环

#### 3. 内容验证
- **一致性检查**：
  - 使用 LLM 比较不同页面中的相关描述
  - 检测矛盾或不一致的地方
  - 生成矛盾报告供用户审阅

- **准确性验证**：
  - 对比知识页面与源文件内容
  - 检查是否有过时或错误的信息
  - 标记需要更新的部分

- **完整性检查**：
  - 检查重要概念是否有独立页面
  - 发现缺失的知识点
  - 建议需要补充的内容

#### 4. 人工审核流程
- **审阅队列**：
  - 所有 LLM 生成的内容先进入待审阅状态
  - 存储在 `.memory/pending/` 目录
  - 用户逐个审阅并决定是否接受

- **审阅界面**：
  - 并排显示：源文件 vs 生成的知识页面
  - 高亮显示关键信息提取
  - 提供编辑器直接修改
  - 一键批准/拒绝/编辑

- **审阅记录**：
  - 记录审阅决策和时间
  - 支持回退到之前的版本
  - 审阅统计和趋势分析

### 自动修复机制
- **自动修复项**：
  - 格式错误（自动格式化）
  - 断裂链接（自动删除或注释）
  - 缺失的 frontmatter（自动补充）

- **需要人工确认的修复**：
  - 内容矛盾
  - 重大结构变更
  - 删除页面

## 人类友好的审阅方案

### HTML 预览页面
每次生成或更新知识后，自动生成一个 HTML 预览页面，包含：
- 修改的文件列表
- 新增内容的高亮显示
- 双向链接的可视化图
- 批准/拒绝/修改按钮

### 差异对比视图
使用类似 git diff 的格式展示：
- 删除的内容（红色）
- 新增的内容（绿色）
- 修改的内容（黄色）

### 交互式审阅
- 用户可以逐个文件审阅
- 可以编辑 LLM 生成的内容
- 可以添加审阅注释
- 支持部分批准

### 审阅日志
所有审阅决策记录在 `.memory/reviews.md` 中，便于追溯

## 技术实现

### 技术栈
- **语言**：TypeScript
- **运行时**：Bun
- **包管理**：npm

### 依赖库
- `gray-matter`：解析 Markdown frontmatter
- `marked`：Markdown 解析和渲染
- `ajv`：JSON Schema 验证
- `diff`：生成差异对比

### 项目结构
```
oh-memory/
├── src/
│   ├── plugin.ts          # 主插件入口
│   ├── core/              # 核心功能
│   │   ├── knowledge-base.ts
│   │   ├── graph-manager.ts
│   │   ├── validator.ts
│   │   └── evolution-engine.ts
│   └── utils/             # 工具函数
│       ├── file-utils.ts
│       ├── link-extractor.ts
│       └── schema-loader.ts
├── commands/              # OpenCode 命令定义
│   ├── memory-init.md
│   ├── memory-ingest.md
│   ├── memory-query.md
│   └── memory-lint.md
├── templates/             # 知识库模板文件
│   ├── SCHEMA.md
│   ├── index.md
│   └── log.md
├── package.json
├── tsconfig.json
└── README.md
```

## 命令与插件的关联机制

### 关联设计原则
1. **插件提供工具**：插件定义具体的执行工具
2. **命令调用工具**：命令的提示词指导 LLM 调用插件提供的工具
3. **工具名称约定**：使用统一的命名规范 `memory-*`

### 工具列表

| 工具名称 | 功能 | 对应命令 |
|---------|------|---------|
| `memory-init-kb` | 初始化知识库 | `/memory-init` |
| `memory-ingest-files` | 摄入文件 | `/memory-ingest` |
| `memory-query-kb` | 查询知识库 | `/memory-query` |
| `memory-lint-kb` | 验证知识库 | `/memory-lint` |
| `memory-search` | 搜索知识库 | 内部使用 |
| `memory-update-kb` | 更新知识库 | 自动进化 |

### 自动进化机制
- 插件的 `file.watcher.updated` 钩子监听文件变化
- 检测到变化后，内部调用更新逻辑
- 自动更新知识库，无需用户手动触发

## NPM 发布

### package.json 配置
```json
{
  "name": "oh-memory",
  "version": "1.0.0",
  "description": "LLM-powered knowledge base plugin for OpenCode",
  "main": "dist/plugin.js",
  "types": "dist/plugin.d.ts",
  "files": [
    "dist/",
    "templates/",
    "commands/",
    "README.md"
  ],
  "keywords": [
    "opencode",
    "plugin",
    "knowledge-base",
    "llm",
    "wiki",
    "memory"
  ],
  "author": "",
  "license": "MIT",
  "peerDependencies": {
    "@opencode-ai/plugin": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/bun": "latest"
  },
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  }
}
```

### 发布流程
```bash
# 1. 构建
npm run build

# 2. 测试
npm test

# 3. 版本更新
npm version patch  # 或 minor, major

# 4. 发布到 npm
npm publish

# 5. 用户安装
# 在 opencode.json 中添加：
# "plugin": ["oh-memory"]
```

## 总结

oh-memory 插件通过以下特性实现了知识库的智能化管理：

1. **三层架构**：项目文件 → 知识维基 → 模式配置
2. **四大命令**：init、ingest、query、lint
3. **自动进化**：文件监控、智能更新、版本追踪
4. **图索引**：双向链接、可视化、LLM 友好
5. **多层验证**：格式、链接、内容、人工审核
6. **人类友好**：HTML 预览、差异对比、交互式审阅

这个设计完全符合 OpenCode 的规范，并基于 llm-wiki 的设计哲学，为项目提供强大的知识管理能力。
