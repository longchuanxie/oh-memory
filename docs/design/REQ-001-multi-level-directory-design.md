# REQ-001: 多层次目录结构 - 开发设计方案

> **需求编号**: REQ-001  
> **优先级**: P0 - 最高  
> **预计工时**: 3 天  
> **依赖**: 无  
> **版本**: v1.2

---

## 一、需求概述

### 1.1 背景

当前系统的知识库目录结构过于扁平，只有 4 个一级分类：
- `entities/` - 所有代码实体
- `concepts/` - 所有概念文档
- `sources/` - 所有源文档
- `synthesis/` - 所有综合分析

这种结构在大型项目中会导致：
1. **知识粒度不足**: 所有组件知识混在一起，难以查找
2. **缺乏组织性**: 无法按模块、功能、层级组织知识
3. **可维护性差**: 随着项目增长，知识库变得混乱

### 1.2 目标

实现多层次目录结构，支持：
- 最多 5 层深度的目录嵌套
- 根据源文件路径自动推断目录结构
- 支持用户自定义映射规则
- 保持向后兼容

### 1.3 示例结构

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
├── concepts/
│   ├── architecture/
│   │   ├── api-design.md
│   │   └── database-schema.md
│   └── patterns/
│       ├── repository-pattern.md
│       └── factory-pattern.md
├── sources/
│   └── docs/
│       ├── README.md
│       └── CHANGELOG.md
└── synthesis/
    └── decisions/
        ├── ADR-001-database-choice.md
        └── ADR-002-api-framework.md
```

---

## 二、技术设计

### 2.1 核心概念

#### 2.1.1 知识路径 (KnowledgePath)

```typescript
interface KnowledgePath {
  category: 'entities' | 'concepts' | 'sources' | 'synthesis'
  subcategories: string[]  // 多级嵌套，最多 4 层
  name: string             // 页面名称
  fullPath: string         // 完整路径
}

// 示例
const path: KnowledgePath = {
  category: 'entities',
  subcategories: ['components', 'auth'],
  name: 'login-form',
  fullPath: 'entities/components/auth/login-form'
}
```

#### 2.1.2 路径映射规则 (PathMappingRule)

```typescript
interface PathMappingRule {
  pattern: RegExp          // 源文件路径匹配模式
  category: Category       // 目标分类
  subcategories: string[]  // 目标子目录
  priority: number         // 规则优先级
}

// 示例规则
const rules: PathMappingRule[] = [
  {
    pattern: /\/src\/components\/(.+)\.tsx$/,
    category: 'entity',
    subcategories: ['components', '$1'],  // $1 为捕获组
    priority: 100
  },
  {
    pattern: /\/src\/services\/(.+)\.ts$/,
    category: 'entity',
    subcategories: ['services', '$1'],
    priority: 100
  }
]
```

### 2.2 核心类设计

#### 2.2.1 PathMapper 类

```typescript
// src/core/path-mapper.ts

export class PathMapper {
  private rules: PathMappingRule[] = []
  private maxDepth: number = 5
  
  constructor() {
    this.initializeDefaultRules()
  }
  
  /**
   * 将源文件路径映射到知识路径
   */
  mapToKnowledgePath(sourcePath: string, category: Category): KnowledgePath {
    // 1. 尝试匹配自定义规则
    const customPath = this.applyCustomRules(sourcePath)
    if (customPath) return customPath
    
    // 2. 使用默认映射逻辑
    return this.defaultMapping(sourcePath, category)
  }
  
  /**
   * 解析知识路径
   */
  parseKnowledgePath(knowledgePath: string): KnowledgePath {
    const parts = knowledgePath.split('/')
    
    return {
      category: parts[0] as Category,
      subcategories: parts.slice(1, -1),
      name: parts[parts.length - 1],
      fullPath: knowledgePath
    }
  }
  
  /**
   * 生成文件系统路径
   */
  generateFilePath(knowledgePath: KnowledgePath): string {
    const parts = [
      knowledgePath.category,
      ...knowledgePath.subcategories,
      `${knowledgePath.name}.md`
    ]
    
    return path.join(...parts)
  }
  
  /**
   * 验证路径深度
   */
  validateDepth(knowledgePath: KnowledgePath): boolean {
    const depth = knowledgePath.subcategories.length + 1 // +1 for category
    return depth <= this.maxDepth
  }
  
  private initializeDefaultRules(): void {
    // 初始化默认映射规则
  }
  
  private applyCustomRules(sourcePath: string): KnowledgePath | null {
    // 应用自定义规则
  }
  
  private defaultMapping(sourcePath: string, category: Category): KnowledgePath {
    // 默认映射逻辑
  }
}
```

### 2.3 默认映射规则

#### 2.3.1 基于源文件路径的映射

```typescript
private defaultMapping(sourcePath: string, category: Category): KnowledgePath {
  const parts = sourcePath.split(path.sep)
  
  // 查找 src 目录
  const srcIndex = parts.findIndex(p => p === 'src')
  
  if (srcIndex >= 0) {
    // 提取 src 后的目录结构
    const relativeParts = parts.slice(srcIndex + 1, -1) // 排除文件名
    
    // 限制深度
    const subcategories = relativeParts.slice(0, this.maxDepth - 1)
    
    // 生成页面名称
    const fileName = path.basename(sourcePath, path.extname(sourcePath))
    const name = this.sanitizeName(fileName)
    
    return {
      category,
      subcategories,
      name,
      fullPath: [category, ...subcategories, name].join('/')
    }
  }
  
  // 如果没有 src 目录，使用扁平结构
  const fileName = path.basename(sourcePath, path.extname(sourcePath))
  const name = this.sanitizeName(fileName)
  
  return {
    category,
    subcategories: [],
    name,
    fullPath: `${category}/${name}`
  }
}
```

#### 2.3.2 特殊路径处理

```typescript
// 文档文件
if (sourcePath.includes('/docs/')) {
  const docPath = sourcePath.split('/docs/')[1]
  const parts = docPath.split(path.sep).slice(0, -1)
  
  return {
    category: 'source',
    subcategories: ['docs', ...parts],
    name: this.sanitizeName(fileName),
    fullPath: `sources/docs/${parts.join('/')}/${this.sanitizeName(fileName)}`
  }
}

// 测试文件
if (sourcePath.includes('/tests/') || sourcePath.includes('/__tests__/')) {
  return {
    category: 'entity',
    subcategories: ['tests'],
    name: this.sanitizeName(fileName),
    fullPath: `entities/tests/${this.sanitizeName(fileName)}`
  }
}

// 配置文件
if (sourcePath.match(/\.(config|conf|settings)\./)) {
  return {
    category: 'source',
    subcategories: ['config'],
    name: this.sanitizeName(fileName),
    fullPath: `sources/config/${this.sanitizeName(fileName)}`
  }
}
```

### 2.4 集成到知识库

#### 2.4.1 修改 processFile 方法

```typescript
private async processFile(filePath: string): Promise<string | null> {
  // ... 现有代码
  
  // 使用 PathMapper 生成知识路径
  const knowledgePath = this.pathMapper.mapToKnowledgePath(
    relativePath,
    classification.category
  )
  
  // 生成完整的文件路径
  const pageFilePath = path.join(
    this.basePath,
    this.pathMapper.generateFilePath(knowledgePath)
  )
  
  // 确保目录存在
  await ensureDir(path.dirname(pageFilePath))
  
  // 写入文件
  await writeMarkdownFile(pageFilePath, frontmatter, pageContent)
  
  return knowledgePath.fullPath
}
```

#### 2.4.2 更新图索引

```typescript
// 在 buildGraphIndex 中
const knowledgePath = this.pathMapper.parseKnowledgePath(pagePath)

const node: KnowledgeNode = {
  id: knowledgePath.fullPath,  // 使用完整路径作为 ID
  title: page.frontmatter.title || knowledgePath.name,
  path: pagePath,
  type: knowledgePath.category,
  category: knowledgePath.subcategories[0],  // 第一级子目录
  tags: page.frontmatter.tags || [],
  lastUpdated: new Date().toISOString(),
  description: page.frontmatter.description
}
```

### 2.5 向后兼容

#### 2.5.1 迁移策略

```typescript
// 检测旧格式页面
function isLegacyPath(pagePath: string): boolean {
  const parts = pagePath.split(path.sep)
  return parts.length === 2 && 
         ['entities', 'concepts', 'sources', 'synthesis'].includes(parts[0])
}

// 迁移旧页面
async function migrateLegacyPages(): Promise<void> {
  const categories = ['entities', 'concepts', 'sources', 'synthesis']
  
  for (const category of categories) {
    const categoryPath = path.join(this.basePath, category)
    const files = await listFiles(categoryPath, ['.md'])
    
    for (const file of files) {
      if (isLegacyPath(file)) {
        // 读取页面内容
        const page = await readMarkdownFile(file)
        
        // 根据内容重新分类
        const knowledgePath = this.pathMapper.mapToKnowledgePath(
          page.frontmatter.source?.path || '',
          category.replace('s', '') as Category
        )
        
        // 移动到新位置
        const newPath = this.pathMapper.generateFilePath(knowledgePath)
        await fs.rename(file, path.join(this.basePath, newPath))
      }
    }
  }
}
```

#### 2.5.2 兼容性查询

```typescript
// 支持旧格式的查询
async query(query: string, options?: QueryOptions): Promise<QueryResult> {
  // 如果查询包含路径，解析路径
  if (query.includes('/')) {
    const knowledgePath = this.pathMapper.parseKnowledgePath(query)
    // 使用完整路径查询
  }
  
  // 支持旧格式的简单名称查询
  // 先尝试完整路径，再尝试简单名称
}
```

---

## 三、配置和自定义

### 3.1 配置文件格式

```yaml
# .memory/config.yaml
pathMapping:
  maxDepth: 5
  
  # 自定义规则
  rules:
    - pattern: "src/components/**/index.tsx"
      category: "entity"
      subcategories: ["components", "$1"]
      priority: 100
    
    - pattern: "src/pages/**/*.tsx"
      category: "entity"
      subcategories: ["pages", "$1"]
      priority: 90
    
    - pattern: "docs/**/*.md"
      category: "source"
      subcategories: ["docs", "$1"]
      priority: 80
  
  # 忽略路径
  ignore:
    - "**/node_modules/**"
    - "**/dist/**"
    - "**/.git/**"
```

### 3.2 运行时配置

```typescript
// 添加自定义规则
pathMapper.addRule({
  pattern: /\/src\/hooks\/(.+)\.ts$/,
  category: 'entity',
  subcategories: ['hooks', '$1'],
  priority: 100
})

// 移除规则
pathMapper.removeRule(pattern)

// 获取当前规则
const rules = pathMapper.getRules()
```

---

## 四、测试方案

### 4.1 单元测试

```typescript
// tests/path-mapper.test.ts

describe('PathMapper', () => {
  const mapper = new PathMapper()
  
  describe('Path Mapping', () => {
    it('should map component files correctly', () => {
      const result = mapper.mapToKnowledgePath(
        '/project/src/components/auth/LoginForm.tsx',
        'entity'
      )
      
      expect(result.category).toBe('entity')
      expect(result.subcategories).toEqual(['components', 'auth'])
      expect(result.name).toBe('login-form')
    })
    
    it('should map service files correctly', () => {
      const result = mapper.mapToKnowledgePath(
        '/project/src/services/api/auth.ts',
        'entity'
      )
      
      expect(result.subcategories).toEqual(['services', 'api'])
    })
    
    it('should respect max depth limit', () => {
      const result = mapper.mapToKnowledgePath(
        '/project/src/a/b/c/d/e/f/file.ts',
        'entity'
      )
      
      expect(result.subcategories.length).toBeLessThanOrEqual(4)
    })
  })
  
  describe('Path Parsing', () => {
    it('should parse knowledge path correctly', () => {
      const result = mapper.parseKnowledgePath(
        'entities/components/auth/login-form'
      )
      
      expect(result.category).toBe('entities')
      expect(result.subcategories).toEqual(['components', 'auth'])
      expect(result.name).toBe('login-form')
    })
  })
  
  describe('Path Validation', () => {
    it('should validate depth correctly', () => {
      const validPath = {
        category: 'entity',
        subcategories: ['a', 'b', 'c'],
        name: 'test',
        fullPath: 'entity/a/b/c/test'
      }
      
      expect(mapper.validateDepth(validPath)).toBe(true)
    })
    
    it('should reject paths exceeding max depth', () => {
      const invalidPath = {
        category: 'entity',
        subcategories: ['a', 'b', 'c', 'd', 'e'],
        name: 'test',
        fullPath: 'entity/a/b/c/d/e/test'
      }
      
      expect(mapper.validateDepth(invalidPath)).toBe(false)
    })
  })
})
```

### 4.2 集成测试

```typescript
// tests/multi-level-directory.test.ts

describe('Multi-Level Directory', () => {
  it('should create nested directories during ingest', async () => {
    const kb = new KnowledgeBase(testProjectPath)
    await kb.initialize()
    
    await kb.ingestFiles(['/src/components/auth/LoginForm.tsx'])
    
    const pagePath = path.join(
      testProjectPath,
      '.memory',
      'entities',
      'components',
      'auth',
      'login-form.md'
    )
    
    expect(await fileExists(pagePath)).toBe(true)
  })
  
  it('should handle deeply nested structures', async () => {
    // 测试深层嵌套
  })
  
  it('should maintain backward compatibility', async () => {
    // 测试向后兼容
  })
})
```

---

## 五、验收标准

### 5.1 功能验收

- [x] 支持创建 5 层深度的目录结构
- [x] 根据源文件路径自动推断目录结构
- [x] 支持自定义映射规则
- [x] 图索引正确处理多级路径的节点
- [x] 查询结果正确显示完整路径
- [x] `memory-lint` 能检测目录结构问题
- [x] 向后兼容旧格式页面

### 5.2 性能验收

- [ ] 路径映射时间 < 10ms
- [ ] 深层目录创建时间 < 50ms
- [ ] 查询性能不受影响

### 5.3 兼容性验收

- [ ] 支持迁移旧格式页面
- [ ] 支持旧格式的查询
- [ ] 不破坏现有功能

---

## 六、实施计划

| 任务 | 预计时间 |
|------|---------|
| 实现 PathMapper 核心类 | 4h |
| 实现默认映射规则 | 2h |
| 集成到 KnowledgeBase | 3h |
| 更新图索引逻辑 | 2h |
| 实现向后兼容 | 2h |
| 单元测试 | 3h |
| 集成测试 | 2h |
| 文档更新 | 1h |

**总计: 19h (约 3 天)**

---

## 七、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 向后兼容性问题 | 高 | 实现迁移策略，提供兼容层 |
| 路径冲突 | 中 | 使用完整路径作为 ID，避免冲突 |
| 性能下降 | 低 | 缓存路径映射结果 |
| 用户配置复杂 | 低 | 提供合理的默认规则 |

---

**设计完成 (v1.1)。支持最多 5 层深度的目录结构，自动映射源文件路径。**
