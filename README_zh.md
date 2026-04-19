# Oh-Memory

基于 OpenCode 的 LLM 驱动知识库插件，采用 llm-wiki 设计理念。

## 概述

Oh-Memory 将你的项目代码和文档转换为结构化的、相互关联的知识库，随着项目的发展而不断演进。它通过自动摄入、验证和进化提供智能知识管理能力。

## 功能特性

- **自动知识摄入**: 将源文件转换为结构化的 wiki 页面
- **图谱导航**: 通过交互式图谱可视化知识连接
- **智能查询**: 在知识库中进行自然语言查询
- **自动进化**: 监控文件变更并自动更新知识
- **多层验证**: 格式、链接和内容验证，支持自动修复
- **人性化审查**: 可视化差异和审批工作流
- **简易安装**: 通过 `oh-memory init` 一键初始化

## 安装

### 从 NPM 安装

```bash
npm install oh-memory
```

### 快速开始

只需 3 个简单步骤即可开始使用：

#### 步骤 1: 安装

```bash
# 进入你的项目目录
cd your-project

# 安装 oh-memory
npm install oh-memory
```

#### 步骤 2: 初始化

```bash
# 初始化 oh-memory（创建命令和配置）
npx oh-memory init
```

这将：
- ✅ 创建 `.opencode/commands/` 目录及所有 memory-* 命令
- ✅ 创建或更新 `opencode.json` 插件配置
- ✅ 将 `.memory/` 添加到 `.gitignore`

#### 步骤 3: 构建知识库

```bash
# 初始化知识库结构
/memory-init

# 摄入源文件
/memory-ingest src/

# 查询知识库
/memory-query 认证系统是如何工作的？
```

### 完成！🎉

你的知识库已准备就绪。`.memory/` 目录包含：
- 代码的结构化 wiki 页面
- 交互式知识图谱（`.memory/graph.html`）
- 可搜索的查询索引

### 手动配置（备选方案）

如果你偏好手动设置：

1. 在 `opencode.json` 中添加：

```json
{
  "plugin": ["oh-memory"]
}
```

2. 重启 OpenCode - 插件将自动创建命令文件。

## 命令

安装后，以下命令将在 OpenCode 中可用：

### `/memory-init`

为项目初始化知识库。

```bash
/memory-init
```

这将创建 `.memory/` 目录结构，包含：
- `entities/` - 代码实体（模块、函数、类）
- `concepts/` - 架构概念和模式
- `sources/` - 源文档摘要
- `synthesis/` - 综合分析
- `index.md` - 知识库索引
- `log.md` - 操作日志
- `SCHEMA.md` - 配置模式
- `graph.json` - 图谱索引
- `graph.html` - 可视化图谱

### `/memory-ingest`

将源文件摄入知识库。

```bash
/memory-ingest src/
/memory-ingest README.md
/memory-ingest docs/
```

**Git 版本控制（重要）**:
- 默认情况下，只处理 git 跟踪的文件
- 未跟踪的文件会自动跳过以确保安全
- 要包含未跟踪的文件，使用 `includeUntracked: true` 选项
- 这可以防止意外摄入敏感或临时文件

**智能过滤**: 命令会自动过滤掉：
- 编译文件（`.class`、`.jar`、`.pyc`、`.exe`、`.dll` 等）
- 依赖项（`node_modules/`、`vendor/`、`Pods/` 等）
- 构建输出（`dist/`、`build/`、`target/`、`out/` 等）
- 锁定文件（`package-lock.json`、`yarn.lock` 等）
- 环境文件（`.env`、`.env.local` 等）
- 压缩文件（`.min.js`、`.min.css` 等）

完整过滤规则请参见 [FILTER_RULES.md](FILTER_RULES.md)。
Git 版本控制详情请参见 [GIT_INTEGRATION.md](GIT_INTEGRATION.md)。

### `/memory-query`

使用自然语言查询知识库。

```bash
/memory-query 认证系统是如何工作的？
/memory-query 主要组件有哪些？
```

### `/memory-lint`

验证和修复知识库。

```bash
/memory-lint
/memory-lint --auto-fix
```

### `/memory-status`

显示知识库的完整状态信息。

```bash
/memory-status
```

返回信息包括：
- 各分类页面数量（entities、concepts、sources、synthesis）
- 图谱统计（节点数、边数、连接率）
- 健康评分和问题数量
- 进化引擎状态（运行状态、监控文件数、待处理变更）
- 最后更新时间

### `/memory-diff`

预览摄入文件前将产生的变更。

```bash
/memory-diff
/memory-diff src/auth/
```

显示变更列表：
- `+` 新增页面（绿色）
- `~` 更新页面（黄色）
- `-` 删除页面（红色）
- `=` 未变更页面（灰色）

如果不指定文件，将扫描进化引擎检测到的待处理变更。

### `/memory-evolve`

控制自动进化引擎。

```bash
/memory-evolve status    # 查看进化引擎状态
/memory-evolve pause     # 暂停自动更新
/memory-evolve resume    # 恢复自动更新
/memory-evolve history   # 查看更新历史
```

可用操作：
- `status` - 显示进化引擎状态（运行状态、监控文件、待处理变更、配置）
- `pause` - 暂停自动更新
- `resume` - 恢复自动更新
- `history` - 显示最近的更新历史

## 架构

Oh-Memory 采用三层架构：

1. **项目文件** - 你现有的代码和文档（只读）
2. **知识 Wiki** - LLM 生成的结构化知识（`.memory/`）
3. **模式** - 配置和约定（`.memory/SCHEMA.md`）

## 图谱索引

插件使用 Markdown 双括号链接构建知识图谱：

- `[[page-name]]` - 链接到另一个页面
- `[[page-name|显示文本]]` - 带自定义文本的链接

图谱会自动构建，可在 `.memory/graph.html` 中可视化。

## 配置

Oh-Memory 提供灵活的配置选项，你可以根据项目需求自定义行为。

### 配置方式

配置可以通过以下方式设置（优先级从低到高）：

1. **默认配置** - 插件内置的默认值
2. **环境变量** - 通过环境变量覆盖
3. **配置文件** - 在项目根目录创建 `.memory/config.json`

### 配置文件路径

在项目的 `.memory/` 目录下创建 `config.json` 文件：

```
your-project/
├── .memory/
│   ├── config.json        ← 自定义配置放在这里
│   ├── entities/
│   ├── concepts/
│   ├── sources/
│   └── synthesis/
└── src/
```

只需覆盖你需要修改的配置项，未指定的配置项将使用默认值。

### 配置示例

只自定义进化引擎配置：

```json
{
  "evolution": {
    "watchPatterns": ["**/*.ts", "**/*.md"],
    "requireApproval": false
  }
}
```

完整配置：

以下是所有配置项及其默认值：

```json
{
  "evolution": {
    "enabled": true,
    "watchPatterns": ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    "ignorePatterns": ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    "updateThreshold": 5,
    "requireApproval": true
  },
  "cache": {
    "maxSize": 100,
    "ttl": 3600000
  },
  "logging": {
    "level": "info",
    "transports": ["console"]
  },
  "performance": {
    "concurrency": 4,
    "batchSize": 50
  }
}
```

### 配置项说明

#### 自动进化配置 (`evolution`)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enabled` | boolean | `true` | 是否启用自动进化功能 |
| `watchPatterns` | string[] | `["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]` | 监控的文件模式 |
| `ignorePatterns` | string[] | `["**/node_modules/**", "**/dist/**", "**/.git/**"]` | 忽略的文件模式 |
| `updateThreshold` | number | `5` | 触发更新的最小变更数 |
| `requireApproval` | boolean | `true` | 是否需要人工审批 |

#### 缓存配置 (`cache`)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `maxSize` | number | `100` | 缓存最大条目数 |
| `ttl` | number | `3600000` | 缓存过期时间（毫秒），默认 1 小时 |

#### 日志配置 (`logging`)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `level` | string | `"info"` | 日志级别：`debug`、`info`、`warn`、`error` |
| `transports` | string[] | `["console"]` | 日志输出目标 |

#### 性能配置 (`performance`)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `concurrency` | number | `4` | 并发操作数 |
| `batchSize` | number | `50` | 批量操作的大小 |

### 环境变量

可以通过环境变量覆盖部分配置：

| 环境变量 | 对应配置 | 示例 |
|----------|----------|------|
| `OH_MEMORY_LOG_LEVEL` | `logging.level` | `OH_MEMORY_LOG_LEVEL=debug` |

### 自定义配置示例

#### 禁用自动进化

```json
{
  "evolution": {
    "enabled": false
  }
}
```

#### 调整监控范围

```json
{
  "evolution": {
    "watchPatterns": ["src/**/*.ts", "src/**/*.tsx", "docs/**/*.md"],
    "ignorePatterns": ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"]
  }
}
```

#### 优化性能配置

```json
{
  "performance": {
    "concurrency": 8,
    "batchSize": 100
  }
}
```

#### 调整日志级别

```json
{
  "logging": {
    "level": "debug"
  }
}
```

## 验证

插件提供多层验证：

1. **格式验证** - 使用 JSON Schema 验证 frontmatter
2. **链接验证** - 检测断链和孤立页面
3. **内容验证** - 检测矛盾和不一致
4. **人工审查** - LLM 生成内容的审批工作流

## 使用工作流

### 典型工作流

```bash
# 1. 初始化知识库（仅首次）
/memory-init

# 2. 摄入源文件
/memory-ingest src/
/memory-ingest docs/

# 3. 查询知识库
/memory-query 认证系统是如何工作的？

# 4. 验证和修复（可选）
/memory-lint --auto-fix
```

### 提示

- **增量更新**: 添加新文件时重新运行 `/memory-ingest`
- **Git 集成**: 默认只处理 git 跟踪的文件
- **自动进化**: 在配置中启用以在文件变更时自动更新
- **可视化图谱**: 打开 `.memory/graph.html` 探索连接

## 开发

### 构建

```bash
npm run build
```

### 开发模式

```bash
npm run dev
```

### 发布

```bash
# 发布 beta 版本
npm run publish:beta

# 发布稳定版本
npm run publish:stable
```

## 故障排除

### 命令没有显示？

1. 确保插件已安装：`npm list oh-memory`
2. 检查 `opencode.json` 是否包含该插件
3. 重启 OpenCode
4. 检查 `.opencode/commands/` 目录是否存在命令文件
5. 尝试运行 `npx oh-memory init` 手动初始化

### 插件未加载？

1. 检查插件是否正确列在 `opencode.json` 中
2. 验证 npm 包是否已安装
3. 检查 OpenCode 日志是否有错误

### 知识库未初始化？

1. 确保你对项目目录有写入权限
2. 检查 `.memory/` 目录是否已存在
3. 尝试删除 `.memory/` 并重新运行 `/memory-init`

### CLI 命令找不到？

1. 确保你在项目目录中
2. 尝试使用 `npx oh-memory init`
3. 检查包是全局安装还是本地安装

## 更新日志

### v1.0.0-beta.6 (2026-04-19)
- 🏗️ **架构**: 重大重构，提取组件
  - GraphBuilder、IndexManager、QueryEngine 用于图谱操作
  - ContentExtractor、ContentSearcher 用于内容分析
  - DocGenerator 用于文档生成
  - PageProcessor 用于文件处理
  - CacheCoordinator 用于缓存管理
  - GraphIndexBuilder 用于图谱索引构建
- 🧪 **测试**: 测试覆盖率从 ~10% 提升至 >70%（582 个测试）
- 📝 **日志**: 结构化日志系统，支持多级别
- 🔧 **配置**: 统一配置管理系统
- 🛡️ **错误处理**: 统一错误处理，支持严重级别
- 🔒 **类型安全**: 消除核心模块中的所有 `any` 类型

### v1.0.0-beta.3 (2026-04-18)
- 🐛 **修复**: 实体路径拼写错误（`entitys` → `entities`）
- 🔒 **安全**: Git 版本控制集成（默认只跟踪已跟踪文件）
- 🚫 **过滤**: 智能文件过滤（排除编译文件、依赖项等）
- 🛠️ **CLI**: 添加 `oh-memory init` 命令以便简易安装

### v1.0.0-beta.2 (2026-04-18)
- ✨ 初始 beta 版本
- 📚 知识库管理
- 🔍 查询和搜索功能
- ✅ 验证和自动修复

## 许可证

MIT

## 贡献

欢迎贡献！提交 PR 前请阅读我们的贡献指南。

## 致谢

基于 Andrej Karpathy 的 [llm-wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 设计理念。
