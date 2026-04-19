# Quick Start Guide

## 🎉 新功能：CLI 初始化命令

现在可以使用 `oh-memory init` 命令快速初始化插件！

## 快速开始

### 方法一：使用 CLI（推荐）

```bash
# 1. 安装插件
npm install oh-memory@beta

# 2. 在项目目录下初始化
npx oh-memory init

# 3. 重启 OpenCode

# 4. 开始使用
/memory-init
/memory-ingest src/
```

### 方法二：自动初始化

```bash
# 1. 安装插件
npm install oh-memory@beta

# 2. 配置 opencode.json
{
  "plugin": ["oh-memory"]
}

# 3. 重启 OpenCode（插件会自动创建命令文件）
```

## CLI 命令详情

### `oh-memory init`

在项目目录下执行此命令，会自动完成：

1. ✅ 创建 `.opencode/commands/` 目录
2. ✅ 安装所有 memory-* 命令文件
3. ✅ 创建或更新 `opencode.json` 配置
4. ✅ 添加 `.memory/` 到 `.gitignore`

**执行示例：**

```bash
$ npx oh-memory init

🚀 Initializing oh-memory plugin...

📋 Step 1: Creating command files...
  ✅ Created memory-init.md
  ✅ Created memory-ingest.md
  ✅ Created memory-query.md
  ✅ Created memory-lint.md

📋 Step 2: Configuring OpenCode...
  ✅ Created opencode.json with oh-memory plugin

📋 Step 3: Updating .gitignore...
  ✅ Created .gitignore with .memory/

🎉 Oh-Memory plugin initialized successfully!

📝 Next steps:
  1. Restart OpenCode to load the plugin
  2. Run /memory-init to create the knowledge base
  3. Run /memory-ingest <files> to ingest your files
  4. Run /memory-query <question> to query the knowledge base

📚 Documentation: https://github.com/your-org/oh-memory#readme
```

## 完整工作流程

### 步骤 1: 安装

```bash
npm install oh-memory@beta
```

### 步骤 2: 初始化

```bash
npx oh-memory init
```

### 步骤 3: 重启 OpenCode

完全关闭并重新打开 OpenCode。

### 步骤 4: 初始化知识库

在 OpenCode TUI 中：

```bash
/memory-init
```

这会创建 `.memory/` 目录结构。

### 步骤 5: 摄入文件

```bash
/memory-ingest src/
/memory-ingest README.md
/memory-ingest docs/
```

### 步骤 6: 查询知识

```bash
/memory-query How does authentication work?
/memory-query What are the main components?
```

### 步骤 7: 验证知识库

```bash
/memory-lint
```

## 验证安装

### 检查命令文件

```bash
ls .opencode/commands/
```

应该看到：
- memory-init.md
- memory-ingest.md
- memory-query.md
- memory-lint.md

### 检查配置

```bash
cat opencode.json
```

应该包含：
```json
{
  "plugin": ["oh-memory"]
}
```

### 检查 .gitignore

```bash
cat .gitignore
```

应该包含：
```
.memory/
```

## 故障排除

### CLI 命令找不到

**问题**：`oh-memory: command not found`

**解决方案**：
```bash
# 使用 npx
npx oh-memory init

# 或全局安装
npm install -g oh-memory
oh-memory init
```

### 命令不显示在 OpenCode TUI

**问题**：输入 `/` 后看不到 memory-* 命令

**解决方案**：
1. 检查 `.opencode/commands/` 目录是否存在
2. 检查命令文件是否已创建
3. 完全重启 OpenCode
4. 尝试手动运行 `npx oh-memory init`

### 权限错误

**问题**：无法创建文件或目录

**解决方案**：
1. 确保有项目目录的写权限
2. 检查是否有 `.opencode` 或 `.memory` 目录冲突
3. 尝试删除现有目录后重新初始化

## 测试 CLI

项目包含测试脚本：

```bash
bun run test-cli.ts
```

测试会验证：
- ✅ CLI 帮助信息
- ✅ init 命令执行
- ✅ 文件创建
- ✅ 配置正确性

## 下一步

1. 发布新版本到 npm
2. 在实际项目中测试
3. 收集用户反馈
4. 持续改进

## 发布新版本

```bash
# 更新版本号
npm version 1.0.0-beta.2

# 构建
npm run build

# 发布
npm publish --tag beta
```

## 成功标志

当一切正常时，你应该能够：
- ✅ 成功运行 `npx oh-memory init`
- ✅ 看到 `.opencode/commands/` 目录被创建
- ✅ 在 OpenCode TUI 中看到 memory-* 命令
- ✅ 成功运行 `/memory-init`
- ✅ 看到 `.memory/` 目录被创建
- ✅ 成功摄入文件并生成知识页面
