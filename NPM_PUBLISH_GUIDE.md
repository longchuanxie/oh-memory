# NPM 发布指南

## 发布前准备

### 1. 登录 npm

```bash
npm login
```

按提示输入：
- 用户名
- 密码
- 邮箱
- OTP（如果启用了两步验证）

### 2. 检查包名是否可用

```bash
npm search oh-memory
```

如果包名已被占用，需要修改 `package.json` 中的 `name` 字段。

## 发布测试包

### 方法一：使用 npm scripts（推荐）

我们已经为您配置好了发布脚本：

#### 发布 Beta 版本
```bash
npm run publish:beta
```

这会：
1. 自动更新版本号为 `1.0.1-beta.0`
2. 构建项目
3. 发布到 npm 的 `beta` 标签

#### 发布 RC 版本
```bash
npm run publish:rc
```

这会：
1. 自动更新版本号为 `1.0.1-rc.0`
2. 构建项目
3. 发布到 npm 的 `rc` 标签

#### 发布 Canary 版本
```bash
npm run publish:canary
```

这会：
1. 自动更新版本号为 `1.0.1-canary.0`
2. 构建项目
3. 发布到 npm 的 `canary` 标签

### 方法二：手动发布

#### 1. 更新版本号

```bash
# Beta 版本
npm version 1.0.0-beta.1

# RC 版本
npm version 1.0.0-rc.1

# Canary 版本
npm version 1.0.0-canary.1
```

#### 2. 构建

```bash
npm run build
```

#### 3. 发布

```bash
# Beta 版本
npm publish --tag beta

# RC 版本
npm publish --tag rc

# Canary 版本
npm publish --tag canary
```

## 用户安装测试包

### 安装 Beta 版本
```bash
npm install oh-memory@beta
```

### 安装 RC 版本
```bash
npm install oh-memory@rc
```

### 安装 Canary 版本
```bash
npm install oh-memory@canary
```

### 安装特定版本
```bash
npm install oh-memory@1.0.0-beta.1
```

## 发布正式版本

当测试完成后，发布正式版本：

```bash
npm run publish:stable
```

或手动：

```bash
npm version patch  # 或 minor, major
npm publish
```

## 版本号规范

### Beta 版本
- 格式：`1.0.0-beta.1`, `1.0.0-beta.2`, ...
- 用途：早期测试版本，可能包含不稳定功能
- 标签：`beta`

### RC 版本（Release Candidate）
- 格式：`1.0.0-rc.1`, `1.0.0-rc.2`, ...
- 用途：候选发布版本，接近正式版本
- 标签：`rc`

### Canary 版本
- 格式：`1.0.0-canary.1`, `1.0.0-canary.2`, ...
- 用途：每日构建版本，最新但可能不稳定
- 标签：`canary`

### 正式版本
- 格式：`1.0.0`, `1.0.1`, `1.1.0`, ...
- 用途：稳定版本
- 标签：`latest`（默认）

## 查看已发布的版本

### 查看所有版本
```bash
npm view oh-memory versions
```

### 查看最新版本
```bash
npm view oh-memory version
```

### 查看 beta 标签的最新版本
```bash
npm view oh-memory@beta version
```

### 查看包信息
```bash
npm view oh-memory
```

## 撤销发布

### 撤销特定版本（24小时内）
```bash
npm unpublish oh-memory@1.0.0-beta.1
```

### 撤销整个包（谨慎使用）
```bash
npm unpublish oh-memory --force
```

⚠️ **注意**：撤销发布可能会影响已经安装该版本的用户。

## 发布流程建议

### 开发阶段
1. 开发新功能
2. 本地测试通过
3. 发布 canary 版本
4. 内部测试

### 测试阶段
1. 发布 beta 版本
2. 邀请用户测试
3. 收集反馈
4. 修复问题

### 发布候选
1. 发布 rc 版本
2. 最终测试
3. 确认无重大问题

### 正式发布
1. 发布正式版本
2. 更新文档
3. 发布公告

## 常见问题

### Q: 如何检查是否已登录？
```bash
npm whoami
```

### Q: 如何切换 npm 源？
```bash
# 使用官方源
npm config set registry https://registry.npmjs.org/

# 使用淘宝源
npm config set registry https://registry.npmmirror.com/
```

### Q: 如何查看当前配置？
```bash
npm config list
```

### Q: 发布失败怎么办？
1. 检查是否已登录：`npm whoami`
2. 检查包名是否可用：`npm search oh-memory`
3. 检查版本号是否已存在：`npm view oh-memory versions`
4. 检查网络连接
5. 查看错误日志

### Q: 如何发布 scoped package？
如果包名是 `@your-org/oh-memory`，需要：
```bash
# 公开发布
npm publish --access public

# 私有发布（需要付费账号）
npm publish
```

## CI/CD 自动发布

可以配置 GitHub Actions 自动发布：

```yaml
name: Publish to npm
on:
  release:
    types: [created]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 相关链接

- [npm 官方文档](https://docs.npmjs.com/)
- [npm 版本管理](https://docs.npmjs.com/about-semantic-versioning)
- [npm 发布指南](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
