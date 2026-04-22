# TypeScript Code Style Rules

## 1. Naming
变量/函数：camelCase | 类/接口：PascalCase | 常量：UPPER_CASE

## 2. Import
按外部→内部→类型分组，空行分隔

```typescript
import path from 'path'

import { KnowledgeBase } from './knowledge-base'
import type { PageFrontmatter } from '../types'
```

## 3. Type Safety
函数参数和返回值必须显式声明类型，禁止使用`any`

```typescript
// Good
function process(data: Record<string, unknown>): string {
  return JSON.stringify(data)
}

// Bad
function process(data: any): any {
  return data
}
```

## 4. Error Handling
使用try-catch，禁止空catch块

```typescript
try {
  await fs.writeFile(filePath, content, 'utf-8')
} catch (error) {
  console.error(`Write failed: ${filePath}`, error)
  throw error
}
```

## 5. Class Structure
顺序：私有属性 → 构造函数 → 方法

## 6. Async/Await
优先async/await而非Promise链

## 7. Null Checks
使用可选链`?.`和空值合并`??`

```typescript
const name = user?.name ?? 'Unknown'
```

## 8. Formatting
2空格缩进 | 单引号 | 分号 | 行宽≤100

## 9. Logging
前缀：`[oh-memory]` | 级别：log/warn/error

```typescript
console.log('[oh-memory] Graph build: ${duration}ms, ${pages.size} pages')
console.error('[oh-memory] Failed to load graph cache:', error)
```

规则：记录耗时/数量/状态 | 敏感信息脱敏 | 避免循环打印
编码前必须规划好程序的架构和模块，避免重复代码和逻辑错误，保持代码的可维护性和可扩展性。
项目代码以LLM驱动为目标，降低代码的复杂度和重复性，提高代码的易读性。
代码编写时注意opencode的要求：
https://opencode.ai/docs/agents/
https://opencode.ai/docs/zh-cn/plugins/
https://opencode.ai/docs/zh-cn/commands/
https://opencode.ai/docs/zh-cn/tools/