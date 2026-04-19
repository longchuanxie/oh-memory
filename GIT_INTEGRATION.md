# Git 版本控制集成功能实现总结

## 概述

为 oh-memory 插件添加了 Git 版本控制集成功能，确保默认只摄入已纳入版本控制的文件，提高安全性和隐私保护。

## 实现细节

### 1. Git 检测函数

**文件**: [src/utils/file-utils.ts](file:///d:/workplace/visual/oh-mermory/src/utils/file-utils.ts)

#### `isGitRepository(projectDir: string): Promise<boolean>`
检测指定目录是否为 Git 仓库。

```typescript
export async function isGitRepository(projectDir: string): Promise<boolean> {
  try {
    await execAsync('git rev-parse --git-dir', { cwd: projectDir })
    return true
  } catch (error) {
    return false
  }
}
```

#### `isFileInGit(filePath: string, projectDir: string): Promise<boolean>`
检查指定文件是否在 Git 版本控制中。

```typescript
export async function isFileInGit(
  filePath: string,
  projectDir: string
): Promise<boolean> {
  try {
    const absolutePath = path.resolve(projectDir, filePath)
    const relativePath = path.relative(projectDir, absolutePath)
    
    const { stdout } = await execAsync(
      `git ls-files --error-unmatch "${relativePath}"`,
      { cwd: projectDir }
    )
    
    return stdout.trim().length > 0
  } catch (error) {
    return false
  }
}
```

#### `getGitTrackedFiles(projectDir: string, patterns: string[]): Promise<string[]>`
获取所有已跟踪的文件列表。

```typescript
export async function getGitTrackedFiles(
  projectDir: string,
  patterns: string[] = []
): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      'git ls-files',
      { cwd: projectDir }
    )
    
    const files = stdout
      .split('\n')
      .filter(file => file.trim().length > 0)
      .map(file => path.join(projectDir, file))
      .filter(file => !shouldIgnore(file) && matchesPatterns(file, patterns))
    
    return files
  } catch (error) {
    return []
  }
}
```

#### `getGitUntrackedFiles(projectDir: string, patterns: string[]): Promise<string[]>`
获取所有未跟踪的文件列表。

```typescript
export async function getGitUntrackedFiles(
  projectDir: string,
  patterns: string[] = []
): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      'git ls-files --others --exclude-standard',
      { cwd: projectDir }
    )
    
    const files = stdout
      .split('\n')
      .filter(file => file.trim().length > 0)
      .map(file => path.join(projectDir, file))
      .filter(file => !shouldIgnore(file) && matchesPatterns(file, patterns))
    
    return files
  } catch (error) {
    return []
  }
}
```

### 2. 更新知识库摄入逻辑

**文件**: [src/core/knowledge-base.ts](file:///d:/workplace/visual/oh-mermory/src/core/knowledge-base.ts)

#### `ingestFiles(files: string[], options: { includeUntracked?: boolean }): Promise<IngestResult>`

添加了 Git 版本控制检查：

```typescript
async ingestFiles(
  files: string[],
  options: { includeUntracked?: boolean } = {}
): Promise<IngestResult> {
  const projectDir = path.dirname(this.basePath)
  const isGitRepo = await isGitRepository(projectDir)

  // 如果是 Git 仓库且未明确包含未跟踪文件，则只处理已跟踪文件
  if (isGitRepo && !options.includeUntracked) {
    const gitTrackedFiles = await getGitTrackedFiles(projectDir)
    
    // 过滤只保留已跟踪的文件
    // ...
  }

  // 继续处理文件
  // ...
}
```

### 3. 更新插件工具

**文件**: [src/plugin.ts](file:///d:/workplace/visual/oh-mermory/src/plugin.ts)

添加了 `includeUntracked` 参数：

```typescript
"memory-ingest-files": tool({
  description: "Ingest source files into the knowledge base...",
  args: {
    files: tool.schema.array(tool.schema.string()).describe("..."),
    projectPath: tool.schema.string().describe("..."),
    includeUntracked: tool.schema.boolean().optional().describe("Include files not tracked by git (default: false)"),
  },
  async execute(args, context) {
    const kb = new KnowledgeBase(args.projectPath)
    const result = await kb.ingestFiles(args.files, { 
      includeUntracked: args.includeUntracked || false 
    })
    // ...
  },
})
```

### 4. 更新命令文档

**文件**: [src/cli.ts](file:///d:/workplace/visual/oh-mermory/src/cli.ts)

更新了 `memory-ingest` 命令说明：

```markdown
**Git Version Control (IMPORTANT)**:
- By default, only files tracked by git are processed
- Untracked files are automatically skipped for security
- To include untracked files, the user must explicitly set includeUntracked=true
- Always check if files are tracked before processing
```

## 工作流程

### 默认行为（安全模式）

1. 用户运行 `/memory-ingest src/`
2. 插件检测项目是否为 Git 仓库
3. 如果是 Git 仓库，获取所有已跟踪文件
4. 只处理已跟踪的文件
5. 未跟踪的文件被跳过并记录在错误列表中

### 包含未跟踪文件

1. 用户明确设置 `includeUntracked: true`
2. 插件处理所有文件，包括未跟踪的文件
3. 仍然应用其他过滤规则（编译文件、依赖目录等）

## 安全特性

### 1. 默认安全
- 默认只处理已跟踪文件
- 未跟踪文件需要明确授权
- 防止意外摄入敏感文件

### 2. 错误报告
被跳过的文件会被记录：

```typescript
{
  errors: [
    'Skipped (not in git): .env',
    'Skipped (not in git): secrets.json'
  ]
}
```

### 3. 透明度
- 用户清楚知道哪些文件被处理
- 提供详细的过滤原因

## 测试验证

**文件**: [test-git.ts](file:///d:/workplace/visual/oh-mermory/test-git.ts)

测试内容：
- ✅ Git 仓库检测
- ✅ 文件跟踪状态检查
- ✅ 已跟踪文件列表获取
- ✅ 未跟踪文件列表获取
- ✅ 知识库 Git 过滤功能

## 使用示例

### 场景 1: 默认模式（推荐）

```bash
/memory-ingest src/
```

**结果**:
- 只处理 `src/` 目录下已跟踪的文件
- 未跟踪的文件被跳过
- 错误列表显示被跳过的文件

### 场景 2: 包含未跟踪文件

```bash
# 用户明确要求包含未跟踪文件
/memory-ingest src/ --include-untracked
```

**结果**:
- 处理 `src/` 目录下所有文件
- 包括未跟踪的文件
- 仍然过滤编译文件和依赖目录

### 场景 3: 非 Git 项目

```bash
/memory-ingest src/
```

**结果**:
- 如果项目不是 Git 仓库，处理所有文件
- 应用其他过滤规则

## 优势

### 1. 安全性
- 防止意外摄入敏感文件
- 默认只处理已提交到版本控制的文件
- 用户需要明确授权才能处理未跟踪文件

### 2. 隐私保护
- 未提交的文件不会被自动分析
- 临时文件和草稿不会被摄入
- 敏感配置文件不会被意外包含

### 3. 可控性
- 用户可以明确选择是否包含未跟踪文件
- 清晰的错误报告
- 透明的处理流程

### 4. 兼容性
- 对非 Git 项目仍然正常工作
- 不影响现有功能
- 向后兼容

## 文件变更

### 修改的文件
- `src/utils/file-utils.ts` - 添加 Git 相关函数
- `src/core/knowledge-base.ts` - 添加 Git 过滤逻辑
- `src/plugin.ts` - 更新工具定义
- `src/cli.ts` - 更新命令说明

### 新增的文件
- `test-git.ts` - Git 集成测试脚本

## 未来改进

计划添加的功能：

1. **更细粒度的控制**:
   - 支持 `.memoryignore` 文件
   - 在 `opencode.json` 中配置

2. **Git 状态显示**:
   - 显示文件的 Git 状态
   - 提供更详细的过滤报告

3. **分支支持**:
   - 支持特定分支的文件
   - 比较不同分支的差异

## 总结

Git 版本控制集成功能的实现大大提高了 oh-memory 插件的安全性和隐私保护：

✅ **默认安全** - 只处理已跟踪文件
✅ **明确授权** - 未跟踪文件需要用户明确同意
✅ **透明处理** - 清晰的错误报告和过滤原因
✅ **兼容性好** - 对非 Git 项目仍然正常工作
✅ **易于使用** - 简单的参数控制

这个功能使 oh-memory 插件更加安全可靠，能够更好地保护用户的隐私和敏感信息。
