# 文件过滤规则

## 概述

oh-memory 在摄入文件时会自动过滤掉不需要分析的文件，包括编译后的文件、依赖目录、临时文件等。

## 忽略的目录

以下目录会被自动忽略：

### Node.js / JavaScript
- `node_modules/` - NPM 依赖
- `dist/` - 构建输出
- `build/` - 构建输出
- `.next/` - Next.js 构建输出
- `.cache/` - 缓存目录
- `coverage/` - 测试覆盖率报告
- `.nyc_output/` - NYC 输出

### Java / JVM
- `target/` - Maven 构建输出
- `build/` - Gradle 构建输出
- `out/` - IDE 输出
- `bin/` - 二进制输出
- `obj/` - 目标文件
- `.gradle/` - Gradle 缓存
- `.mvn/` - Maven 包装器

### Python
- `__pycache__/` - Python 字节码缓存
- `.cache/` - 缓存目录

### iOS / macOS
- `Pods/` - CocoaPods 依赖
- `DerivedData/` - Xcode 派生数据

### IDE / 编辑器
- `.idea/` - IntelliJ IDEA
- `.vscode/` - VS Code
- `.vs/` - Visual Studio

### 版本控制
- `.git/` - Git 仓库

### 其他
- `.memory/` - oh-memory 知识库
- `vendor/` - 供应商依赖

## 忽略的文件

以下文件会被自动忽略：

### 环境变量文件
- `.env`
- `.env.local`
- `.env.development.local`
- `.env.test.local`
- `.env.production.local`

### 锁文件
- `package-lock.json`
- `yarn.lock`
- `pnpm-lock.yaml`

### 系统文件
- `.DS_Store` (macOS)
- `Thumbs.db` (Windows)

### 日志文件
- `npm-debug.log`
- `yarn-debug.log`
- `yarn-error.log`
- `*.log`

## 忽略的文件扩展名

以下扩展名的文件会被自动忽略：

### 编译文件
- `.class` - Java 字节码
- `.jar` - Java 归档
- `.war` - Web 应用归档
- `.ear` - 企业应用归档

### 二进制文件
- `.exe` - Windows 可执行文件
- `.dll` - Windows 动态链接库
- `.so` - Linux 共享对象
- `.dylib` - macOS 动态库

### 目标文件
- `.o` - 目标文件
- `.obj` - 目标文件
- `.a` - 静态库
- `.lib` - 静态库

### Python 编译文件
- `.pyc` - Python 字节码
- `.pyo` - Python 优化字节码
- `.pyd` - Python 动态模块

### 压缩文件
- `.min.js` - 压缩的 JavaScript
- `.min.css` - 压缩的 CSS

### 其他
- `.map` - Source map
- `.lock` - 锁文件
- `.log` - 日志文件
- `.tmp` - 临时文件
- `.temp` - 临时文件
- `.bak` - 备份文件
- `.backup` - 备份文件
- `.orig` - 原始文件
- `.swp` - Vim 交换文件
- `.swo` - Vim 交换文件

## 支持的文件扩展名

以下扩展名的文件会被分析：

### 编程语言
- `.js` - JavaScript
- `.ts` - TypeScript
- `.jsx` - React JSX
- `.tsx` - React TSX
- `.py` - Python
- `.java` - Java
- `.go` - Go
- `.rs` - Rust
- `.rb` - Ruby

### Web 技术
- `.html` - HTML
- `.htm` - HTML
- `.css` - CSS
- `.scss` - Sass
- `.sass` - Sass
- `.less` - Less

### 前端框架
- `.vue` - Vue.js
- `.svelte` - Svelte

### 配置文件
- `.json` - JSON
- `.yaml` - YAML
- `.yml` - YAML
- `.toml` - TOML

### 文档
- `.md` - Markdown
- `.txt` - 纯文本

### 脚本
- `.sh` - Shell 脚本
- `.bash` - Bash 脚本
- `.zsh` - Zsh 脚本

### 数据库
- `.sql` - SQL

### API
- `.graphql` - GraphQL
- `.gql` - GraphQL
- `.proto` - Protocol Buffers

## 自定义过滤规则

目前过滤规则是硬编码的。未来版本将支持：

1. 通过配置文件自定义忽略规则
2. 使用 `.memoryignore` 文件（类似 `.gitignore`）
3. 在 `opencode.json` 中配置

## 测试过滤功能

运行测试脚本验证过滤规则：

```bash
bun run test-filter.ts
```

测试会验证：
- ✅ 忽略的目录被正确过滤
- ✅ 忽略的文件被正确过滤
- ✅ 忽略的扩展名被正确过滤
- ✅ 支持的扩展名被正确识别

## 示例

### 会被忽略的文件

```bash
# 这些文件不会被分析
node_modules/react/index.js
dist/bundle.js
target/classes/Main.class
__pycache__/module.pyc
app.min.js
styles.min.css
package-lock.json
.env
```

### 会被分析的文件

```bash
# 这些文件会被分析
src/index.ts
components/Button.tsx
app.py
Main.java
README.md
config.json
styles.css
query.sql
```

## 性能优化

过滤机制可以：
- 减少不必要的文件分析
- 提高摄入速度
- 降低内存使用
- 避免分析无关内容

## 最佳实践

1. **项目结构**：保持清晰的项目结构，将源代码和构建输出分开
2. **命名约定**：使用标准的文件命名约定
3. **配置管理**：使用环境变量文件管理敏感配置
4. **版本控制**：使用 `.gitignore` 排除不需要的文件

## 故障排除

### 问题：源文件被错误过滤

**解决方案**：
1. 检查文件扩展名是否在支持列表中
2. 确认文件不在忽略的目录中
3. 验证文件名不在忽略的文件列表中

### 问题：编译文件被分析

**解决方案**：
1. 确认文件扩展名在忽略列表中
2. 检查文件是否在忽略的目录中
3. 如果仍然被分析，请提交 issue

## 更新日志

### v1.0.0-beta.2
- ✅ 添加全面的文件过滤机制
- ✅ 支持多种编程语言和框架
- ✅ 智能识别编译文件和依赖目录
- ✅ 添加测试脚本验证过滤规则
