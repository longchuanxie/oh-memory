# LLM 处理指南

## 核心原则

**我们提供文件列表和目录管理，你负责读取文件内容、做决策和生成内容。**

## 工作流程

### 1. 获取文件列表

调用 `memory-ingest-files` 工具，你会收到如下格式的数据：

```json
{
  "processedFiles": 10,
  "totalFiles": 12,
  "files": [
    {
      "path": "src/core/knowledge-base.ts",
      "language": "typescript",
      "lines": 150,
      "lastModified": "2024-01-15"
    }
  ],
  "errors": []
}
```

### 2. 读取文件内容

使用你的文件读取能力读取每个文件的内容。

### 3. 分析文件内容

对每个文件，你需要：
- 理解代码结构和功能
- 识别关键元素（类、函数、接口、变量等）
- 分析依赖关系
- 理解文件在项目中的作用

### 2. 判断页面类型

根据文件内容判断属于哪种类型：

- **entity**（代码实体）：代码文件，包含类、函数、接口等
  - 保存到 `.memory/entities/`
  - 示例：`src/core/knowledge-base.ts` → `.memory/entities/knowledge-base.md`

- **concept**（概念/文档）：文档、说明、概念解释
  - 保存到 `.memory/concepts/`
  - 示例：`docs/architecture.md` → `.memory/concepts/architecture.md`

- **source**（参考文件）：配置文件、示例代码等
  - 保存到 `.memory/sources/`
  - 示例：`package.json` → `.memory/sources/package-json.md`

### 3. 生成 Wiki 页面

每个 Wiki 页面使用 Markdown + frontmatter 格式：

```markdown
---
name: 页面名称（简短、描述性）
type: entity | concept | source
category: 模块/分类名称
tags: [tag1, tag2, tag3]
source: 源文件路径
lastModified: 2024-01-15
---

# 页面标题

## 概述

简要描述这个文件/模块的作用（2-3句话）

## 关键元素

### 类/函数名称

- **作用**：这个元素做什么
- **输入**：参数说明
- **输出**：返回值
- **依赖**：依赖的其他模块

## 依赖关系

- 依赖模块 1
- 依赖模块 2

## 使用示例

\`\`\`typescript
// 代码示例
\`\`\`

## 注意事项

- 需要注意的事项
```

### 4. 保存文件

使用你的文件写入能力将生成的 Markdown 文件保存到对应目录：

- `.memory/entities/` - 代码实体
- `.memory/concepts/` - 概念文档
- `.memory/sources/` - 参考文件

## 示例

### 输入

```json
{
  "path": "src/utils/file-utils.ts",
  "language": "typescript",
  "lines": 80,
  "lastModified": "2024-01-15"
}
```

### 你应该

1. 读取文件内容
2. 判断类型：`entity`（代码文件）
3. 生成页面名称：`file-utils`
4. 创建文件：`.memory/entities/file-utils.md`

```markdown
---
name: file-utils
type: entity
category: utils
tags: [file, io, utility]
source: src/utils/file-utils.ts
lastModified: 2024-01-15
---

# File Utils

## 概述

提供文件读写工具函数，封装 Node.js fs 模块的异步操作。

## 关键元素

### readFile(path: string): Promise<string>

- **作用**：异步读取文件内容
- **输入**：文件路径
- **输出**：文件内容字符串
- **依赖**：fs (Node.js)

## 使用示例

\`\`\`typescript
import { readFile } from './file-utils';
const content = await readFile('path/to/file.txt');
\`\`\`
```

## 注意事项

1. **保持简洁**：只提取关键信息，不要复制整个文件内容
2. **关注结构**：重点描述代码结构和关系，而非实现细节
3. **使用标签**：添加相关标签便于搜索
4. **保持更新**：记录源文件的最后修改时间
5. **分类清晰**：确保 category 字段清晰描述模块归属
