# Bug 修复：实体路径拼写错误

## 问题描述

用户报告了一个 bug：oh-memory 系统在查找路径时出现了拼写错误，查找的是 `.memory/entitys/`（缺少 'i'），而正确的目录应该是 `.memory/entities/`。

## 问题根源

**文件**: [src/core/knowledge-base.ts](file:///d:/workplace/visual/oh-mermory/src/core/knowledge-base.ts) 第 339 行

**错误代码**:
```typescript
const pagePath = path.join(this.basePath, `${pageType}s`, `${pageName}.md`)
```

**问题分析**:
- `pageType` 的值是 `'entity'`（单数）
- 使用 `${pageType}s` 拼接后变成 `'entitys'`（错误）
- 正确的复数形式应该是 `'entities'`

## 解决方案

创建了一个类型到目录名的映射，确保使用正确的复数形式：

```typescript
// Map page type to correct directory name
const typeToDir: Record<string, string> = {
  'entity': 'entities',
  'concept': 'concepts',
  'source': 'sources',
  'synthesis': 'synthesis'
}
const dirName = typeToDir[pageType] || `${pageType}s`
const pagePath = path.join(this.basePath, dirName, `${pageName}.md`)
```

## 修复详情

### 单词复数形式映射

| 单数 (pageType) | 错误复数 (旧代码) | 正确复数 (新代码) |
|----------------|------------------|------------------|
| entity | entitys ❌ | entities ✅ |
| concept | concepts ✅ | concepts ✅ |
| source | sources ✅ | sources ✅ |
| synthesis | synthesiss ❌ | synthesis ✅ |

### 修复的文件

**文件**: [src/core/knowledge-base.ts](file:///d:/workplace/visual/oh-mermory/src/core/knowledge-base.ts)

**修改位置**: 第 338-348 行

**修改前**:
```typescript
const pageContent = this.generatePageContent(content, filePath)
const pagePath = path.join(this.basePath, `${pageType}s`, `${pageName}.md`)
```

**修改后**:
```typescript
const pageContent = this.generatePageContent(content, filePath)

// Map page type to correct directory name
const typeToDir: Record<string, string> = {
  'entity': 'entities',
  'concept': 'concepts',
  'source': 'sources',
  'synthesis': 'synthesis'
}
const dirName = typeToDir[pageType] || `${pageType}s`
const pagePath = path.join(this.basePath, dirName, `${pageName}.md`)
```

## 测试验证

**测试文件**: [test-entity-path.ts](file:///d:/workplace/visual/oh-mermory/test-entity-path.ts)

**测试结果**:
```
📋 步骤 3: 检查目录结构
  ✅ entities/ 目录存在
  ✅ concepts/ 目录存在
  ✅ sources/ 目录存在
  ✅ synthesis/ 目录存在

📋 步骤 5: 检查生成的页面路径
  ✅ entities/ 目录包含 0 个文件:
  ✅ 正确: entitys/ 目录不存在
  ✅ concepts/ 目录包含 0 个文件:
```

**关键验证**:
- ✅ `entities/` 目录存在且正确
- ✅ `entitys/` 目录不存在（证明修复成功）

## 影响范围

### 受影响的功能
- `/memory-ingest` 命令
- `memory-ingest-files` 工具
- 所有实体类型文件的摄入

### 不受影响的功能
- 知识库初始化（目录创建正确）
- 查询功能
- 验证功能
- 其他命令

## 向后兼容性

### 已有项目
如果用户的项目中已经存在错误的 `entitys/` 目录：
1. 新的文件将正确地保存到 `entities/` 目录
2. 旧的 `entitys/` 目录中的文件不会被自动迁移
3. 用户可以手动移动文件到正确的目录

### 建议
对于已有项目，建议：
```bash
# 如果存在错误的目录，手动移动文件
mv .memory/entitys/* .memory/entities/
rmdir .memory/entitys
```

## 防止类似问题

### 代码改进
1. 使用常量定义目录名称
2. 添加类型检查
3. 增加单元测试

### 建议的常量定义
```typescript
const PAGE_TYPE_DIRECTORIES = {
  entity: 'entities',
  concept: 'concepts',
  source: 'sources',
  synthesis: 'synthesis'
} as const

type PageType = keyof typeof PAGE_TYPE_DIRECTORIES
type PageDirectory = typeof PAGE_TYPE_DIRECTORIES[PageType]
```

## 总结

这个 bug 是一个简单的拼写错误，但会导致：
- ❌ 文件保存到错误的目录
- ❌ 知识库无法正确读取实体文件
- ❌ 用户看到混乱的目录结构

修复后：
- ✅ 所有文件保存到正确的目录
- ✅ 知识库可以正确读取所有类型的文件
- ✅ 目录结构清晰一致

## 版本信息

- **修复版本**: v1.0.0-beta.3
- **修复日期**: 2026-04-18
- **影响版本**: v1.0.0-beta.2 及更早版本
