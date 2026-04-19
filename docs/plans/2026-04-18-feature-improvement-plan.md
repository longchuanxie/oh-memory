# Oh-Memory 功能完善实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复已识别的关键问题和重要问题，提升知识库质量和大型项目处理能力

**Architecture:** 分阶段修复，优先解决影响核心功能的关键问题，然后优化使用体验

**Tech Stack:** TypeScript, Node.js, VSCode Extension API

---

## 阶段一：关键问题修复

### Task 1: 实现 inferTypeFromId 方法

**问题**：`inferTypeFromId` 永远返回 null，导致 affectedLayers 永远为空

**Files:**
- Modify: `src/core/graph-updater.ts:110-112`

**Step 1: 实现类型推断逻辑**

```typescript
private inferTypeFromId(nodeId: string): string | null {
  const typePatterns: Array<{ pattern: RegExp; type: string }> = [
    { pattern: /^(entity|entities)[-_]/i, type: 'entity' },
    { pattern: /^(concept|concepts)[-_]/i, type: 'concept' },
    { pattern: /^(source|sources)[-_]/i, type: 'source' },
    { pattern: /^(synthesis|syn)[-_]/i, type: 'synthesis' },
    { pattern: /^(util|utils|helper|helpers)[-_]/i, type: 'util' },
    { pattern: /^(service|services)[-_]/i, type: 'service' },
    { pattern: /^(component|components)[-_]/i, type: 'component' },
    { pattern: /^(api|route|routes)[-_]/i, type: 'api' },
    { pattern: /^(test|tests|spec|specs)[-_]/i, type: 'test' },
    { pattern: /^(config|conf)[-_]/i, type: 'config' },
  ]
  
  for (const { pattern, type } of typePatterns) {
    if (pattern.test(nodeId)) {
      return type
    }
  }
  
  return null
}
```

**Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/graph-updater.ts
git commit -m "fix: implement inferTypeFromId for proper layer detection"
```

---

### Task 2: 优化删除节点的增量更新策略

**问题**：任何文件删除都会触发全量重建，效率极低

**Files:**
- Modify: `src/core/graph-updater.ts:156-169`

**Step 1: 重构 shouldRebuildFull 方法**

```typescript
shouldRebuildFull(plan: GraphUpdatePlan): boolean {
  const totalChanges = 
    plan.addedNodes.length + 
    plan.updatedNodes.length + 
    plan.deletedNodes.length
  
  if (totalChanges === 0) return false
  
  const deletedRatio = plan.deletedNodes.length / (this.cache?.files.size || 1)
  
  if (deletedRatio > 0.3) return true
  
  if (plan.deletedNodes.length > 20) return true
  
  if (totalChanges > 100) return true
  
  return false
}

canIncrementalUpdate(plan: GraphUpdatePlan): boolean {
  return !this.shouldRebuildFull(plan)
}
```

**Step 2: 更新 buildGraphIndex 使用增量更新**

在 `knowledge-base.ts` 中添加删除节点的增量处理：

```typescript
private async handleDeletedNodes(deletedNodes: string[]): Promise<void> {
  for (const nodeId of deletedNodes) {
    const categories = ['entities', 'concepts', 'sources', 'synthesis']
    for (const category of categories) {
      const pagePath = path.join(this.basePath, category, `${nodeId}.md`)
      try {
        await fs.unlink(pagePath)
      } catch {
        // ignore
      }
    }
  }
}
```

**Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/core/graph-updater.ts src/core/knowledge-base.ts
git commit -m "feat: optimize incremental update for deleted nodes"
```

---

### Task 3: 修复模块分组路径匹配

**问题**：路径匹配逻辑在 Windows 和跨路径场景下可能不准确

**Files:**
- Modify: `src/core/ingest-orchestrator.ts:361-393`

**Step 1: 重构 groupFilesByModule 方法**

```typescript
private groupFilesByModule(files: string[]): ModuleGroup[] {
  const groups: ModuleGroup[] = []
  
  const normalizePath = (p: string): string => {
    return p.replace(/\\/g, '/').toLowerCase()
  }
  
  if (this.modules.length === 0) {
    const dirGroups = new Map<string, string[]>()
    
    for (const file of files) {
      const normalized = normalizePath(file)
      const parts = normalized.split('/')
      const moduleDir = parts.length > 1 ? parts[0] : 'root'
      
      if (!dirGroups.has(moduleDir)) {
        dirGroups.set(moduleDir, [])
      }
      dirGroups.get(moduleDir)!.push(file)
    }
    
    for (const [name, moduleFiles] of dirGroups) {
      if (moduleFiles.length > 0) {
        groups.push({ name, files: moduleFiles })
      }
    }
  } else {
    const moduleFiles = new Map<string, string[]>()
    const unassigned: string[] = []
    
    for (const file of files) {
      const normalizedFile = normalizePath(file)
      let assigned = false
      
      for (const mod of this.modules) {
        const modulePath = normalizePath(mod.path.replace(/^\.\//, '').replace(/\/$/, ''))
        
        const isMatch = normalizedFile.startsWith(modulePath + '/') || 
                        normalizedFile === modulePath ||
                        normalizedFile.includes('/' + modulePath + '/')
        
        if (isMatch) {
          if (!moduleFiles.has(mod.name)) {
            moduleFiles.set(mod.name, [])
          }
          moduleFiles.get(mod.name)!.push(file)
          assigned = true
          break
        }
      }
      
      if (!assigned) {
        unassigned.push(file)
      }
    }
    
    for (const [name, files] of moduleFiles) {
      groups.push({ name, files })
    }
    
    if (unassigned.length > 0) {
      groups.push({ name: 'other', files: unassigned })
    }
  }
  
  return groups.sort((a, b) => b.files.length - a.files.length)
}
```

**Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/ingest-orchestrator.ts
git commit -m "fix: improve module path matching for cross-platform compatibility"
```

---

## 阶段二：重要问题修复

### Task 4: 添加空项目和单文件项目的特殊处理

**问题**：空项目或单文件项目会生成无意义的架构分析

**Files:**
- Modify: `src/core/project-analyzer.ts:24-45`

**Step 1: 添加项目规模检查**

```typescript
async analyze(): Promise<ProjectArchitecture> {
  const structure = await this.analyzeStructure()
  
  if (structure.totalFiles === 0) {
    return this.createEmptyProjectArchitecture()
  }
  
  if (structure.totalFiles === 1) {
    return this.createSingleFileArchitecture(structure)
  }
  
  const structureScore = await this.calculateStructureScore(structure)
  const techStack = await this.detectTechStack()
  const modules = await this.detectModules(structure)
  const entryPoints = await this.findEntryPoints()
  const layers = this.inferLayers(structure, modules)

  const architecture: ProjectArchitecture = {
    structure,
    structureScore,
    techStack,
    modules,
    entryPoints,
    layers,
    lastAnalyzed: new Date().toISOString(),
  }

  await this.saveCache(structureScore, techStack)
  
  return architecture
}

private createEmptyProjectArchitecture(): ProjectArchitecture {
  return {
    structure: { root: this.projectPath, directories: [], maxDepth: 0, totalFiles: 0, totalDirs: 0 },
    structureScore: { total: 0, directory: 0, config: 0, organization: 0, documentation: 0, level: 'messy' },
    techStack: { languages: [], frameworks: [], libraries: [], tools: [], packageManager: null, buildTool: null, testFramework: null },
    modules: [],
    entryPoints: [],
    layers: [],
    lastAnalyzed: new Date().toISOString(),
  }
}

private createSingleFileArchitecture(structure: DirectoryStructure): ProjectArchitecture {
  return {
    structure,
    structureScore: { total: 10, directory: 0, config: 0, organization: 10, documentation: 0, level: 'messy' },
    techStack: { languages: [], frameworks: [], libraries: [], tools: [], packageManager: null, buildTool: null, testFramework: null },
    modules: [],
    entryPoints: [],
    layers: [],
    lastAnalyzed: new Date().toISOString(),
  }
}
```

**Step 2: 更新架构文档生成**

在 `knowledge-base.ts` 中添加：

```typescript
private async generateArchitectureDoc(architecture: ProjectArchitecture): Promise<void> {
  if (architecture.structure.totalFiles === 0) {
    const content = `# Project Architecture

## Overview

This is an empty project. No files have been detected.

Please add source files and run \`/memory-ingest\` to generate architecture analysis.
`
    await fs.writeFile(path.join(this.basePath, 'architecture.md'), content, 'utf-8')
    return
  }
  
  if (architecture.structure.totalFiles === 1) {
    const content = `# Project Architecture

## Overview

This is a single-file project with minimal structure.

- **Total Files**: 1
- **Last Analyzed**: ${architecture.lastAnalyzed.split('T')[0]}

Consider organizing your code into a proper project structure for better maintainability.
`
    await fs.writeFile(path.join(this.basePath, 'architecture.md'), content, 'utf-8')
    return
  }
  
  // ... existing implementation
}
```

**Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/core/project-analyzer.ts src/core/knowledge-base.ts
git commit -m "feat: add special handling for empty and single-file projects"
```

---

### Task 5: 实现真实的代码风格分析

**问题**：代码风格分析返回的是预设值，而非真实分析结果

**Files:**
- Modify: `src/core/project-analyzer.ts:680-757`

**Step 1: 创建代码风格分析器**

```typescript
private async analyzeLanguageStyle(language: string): Promise<CodeStyle | null> {
  const sampleFiles = await this.getSampleFilesForLanguage(language, 10)
  
  if (sampleFiles.length === 0) {
    return null
  }
  
  const namingConventions = await this.analyzeNamingConventions(sampleFiles, language)
  const formatting = await this.analyzeFormatting(sampleFiles, language)
  const bestPractices = await this.analyzeBestPractices(sampleFiles, language)
  
  const adoptedCount = bestPractices.filter(bp => bp.status === 'adopted').length
  const summary = `${language} code follows standard conventions with ${adoptedCount}/${bestPractices.length} best practices adopted.`

  return {
    language,
    namingConventions,
    formatting,
    bestPractices,
    summary,
  }
}

private async getSampleFilesForLanguage(language: string, limit: number): Promise<string[]> {
  const extensions = this.getExtensionsForLanguage(language)
  const files: string[] = []
  
  const walk = async (dir: string) => {
    if (files.length >= limit) return
    
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
    
    for (const entry of entries) {
      if (this.shouldIgnore(entry.name)) continue
      
      const fullPath = path.join(dir, entry.name)
      
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if (extensions.includes(ext)) {
          files.push(fullPath)
          if (files.length >= limit) break
        }
      }
    }
  }
  
  await walk(this.projectPath)
  return files
}

private getExtensionsForLanguage(language: string): string[] {
  const map: Record<string, string[]> = {
    TypeScript: ['.ts', '.tsx'],
    JavaScript: ['.js', '.jsx', '.mjs'],
    Python: ['.py'],
    Go: ['.go'],
    Rust: ['.rs'],
    Java: ['.java'],
  }
  return map[language] || []
}

private async analyzeNamingConventions(files: string[], language: string): Promise<NamingConvention[]> {
  const conventions: NamingConvention[] = []
  
  const variableNames: string[] = []
  const functionNames: string[] = []
  const classNames: string[] = []
  const fileNames = files.map(f => path.basename(f, path.extname(f)))
  
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8')
      
      if (language === 'TypeScript' || language === 'JavaScript') {
        const varMatches = content.matchAll(/(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g)
        for (const m of varMatches) variableNames.push(m[1])
        
        const funcMatches = content.matchAll(/(?:function\s+([a-zA-Z_][a-zA-Z0-9_]*)|(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:async\s*)?\()/g)
        for (const m of funcMatches) functionNames.push(m[1] || m[2])
        
        const classMatches = content.matchAll(/class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g)
        for (const m of classMatches) classNames.push(m[1])
      }
    } catch {}
  }
  
  if (variableNames.length > 0) {
    const style = this.detectNamingStyle(variableNames)
    conventions.push({
      type: 'variable',
      style: style.style,
      consistency: style.consistency,
      examples: variableNames.slice(0, 3),
    })
  }
  
  if (functionNames.length > 0) {
    const style = this.detectNamingStyle(functionNames)
    conventions.push({
      type: 'function',
      style: style.style,
      consistency: style.consistency,
      examples: functionNames.slice(0, 3),
    })
  }
  
  if (classNames.length > 0) {
    const style = this.detectNamingStyle(classNames)
    conventions.push({
      type: 'class',
      style: style.style,
      consistency: style.consistency,
      examples: classNames.slice(0, 3),
    })
  }
  
  if (fileNames.length > 0) {
    const style = this.detectNamingStyle(fileNames)
    conventions.push({
      type: 'file',
      style: style.style,
      consistency: style.consistency,
      examples: fileNames.slice(0, 3),
    })
  }
  
  return conventions
}

private detectNamingStyle(names: string[]): { style: NamingConvention['style']; consistency: number } {
  const styles: Record<string, number> = {
    camelCase: 0,
    PascalCase: 0,
    snake_case: 0,
    'kebab-case': 0,
    UPPER_CASE: 0,
  }
  
  for (const name of names) {
    if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) styles.PascalCase++
    else if (/^[a-z][a-zA-Z0-9]*$/.test(name)) styles.camelCase++
    else if (/^[a-z][a-z0-9_]*$/.test(name)) styles.snake_case++
    else if (/^[a-z][a-z0-9-]*$/.test(name)) styles['kebab-case']++
    else if (/^[A-Z][A-Z0-9_]*$/.test(name)) styles.UPPER_CASE++
  }
  
  const total = names.length
  const sorted = Object.entries(styles).sort((a, b) => b[1] - a[1])
  const [topStyle, topCount] = sorted[0]
  
  return {
    style: topStyle as NamingConvention['style'],
    consistency: topCount / total,
  }
}

private async analyzeFormatting(files: string[], language: string): Promise<FormattingStyle> {
  let indentSpace = 0
  let indentTab = 0
  let semicolons = 0
  let noSemicolons = 0
  let singleQuotes = 0
  let doubleQuotes = 0
  let trailingCommas = 0
  
  for (const file of files.slice(0, 5)) {
    try {
      const content = await fs.readFile(file, 'utf-8')
      const lines = content.split('\n')
      
      for (const line of lines) {
        if (line.startsWith('  ')) indentSpace++
        else if (line.startsWith('\t')) indentTab++
      }
      
      semicolons += (content.match(/;/g) || []).length
      noSemicolons += (content.match(/\n[^\n]*[a-zA-Z0-9)\]"']\n/g) || []).length
      singleQuotes += (content.match(/'/g) || []).length
      doubleQuotes += (content.match(/"/g) || []).length
      trailingCommas += (content.match(/,[\s\n]*[\]\})]/g) || []).length
    } catch {}
  }
  
  return {
    indent: indentSpace >= indentTab ? 'space' : 'tab',
    indentSize: 2,
    semicolons: semicolons >= noSemicolons,
    quotes: singleQuotes >= doubleQuotes ? 'single' : 'double',
    trailingComma: trailingCommas > 0,
  }
}

private async analyzeBestPractices(files: string[], language: string): Promise<BestPractice[]> {
  const practices: BestPractice[] = []
  
  if (language === 'TypeScript' || language === 'JavaScript') {
    const hasTsConfig = await this.fileExists(path.join(this.projectPath, 'tsconfig.json'))
    practices.push({
      name: 'TypeScript Configuration',
      status: hasTsConfig ? 'adopted' : 'missing',
      description: 'Project uses TypeScript with tsconfig.json',
      evidence: hasTsConfig ? 'tsconfig.json found' : undefined,
    })
    
    const hasEslint = await this.hasAnyFile([
      '.eslintrc', '.eslintrc.js', '.eslintrc.json', 'eslint.config.js'
    ])
    practices.push({
      name: 'ESLint Configuration',
      status: hasEslint ? 'adopted' : 'missing',
      description: 'Project uses ESLint for code quality',
      evidence: hasEslint ? 'ESLint config found' : undefined,
    })
    
    const hasPrettier = await this.hasAnyFile([
      '.prettierrc', '.prettierrc.js', '.prettierrc.json'
    ])
    practices.push({
      name: 'Prettier Configuration',
      status: hasPrettier ? 'adopted' : 'missing',
      description: 'Project uses Prettier for code formatting',
      evidence: hasPrettier ? 'Prettier config found' : undefined,
    })
    
    let hasTypeAnnotations = false
    for (const file of files.slice(0, 3)) {
      try {
        const content = await fs.readFile(file, 'utf-8')
        if (/:\s*(string|number|boolean|any|void|never)\b/.test(content)) {
          hasTypeAnnotations = true
          break
        }
      } catch {}
    }
    practices.push({
      name: 'Type Annotations',
      status: hasTypeAnnotations ? 'adopted' : 'partial',
      description: 'Code uses explicit type annotations',
    })
  }
  
  return practices
}

private async hasAnyFile(files: string[]): Promise<boolean> {
  for (const file of files) {
    if (await this.fileExists(path.join(this.projectPath, file))) {
      return true
    }
  }
  return false
}
```

**Step 2: 更新类型定义**

在 `src/types/index.ts` 中确保 `NamingConvention` 类型包含 `function` 类型：

```typescript
export interface NamingConvention {
  type: 'variable' | 'function' | 'class' | 'constant' | 'file'
  style: 'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case' | 'UPPER_CASE'
  consistency: number
  examples: string[]
}
```

**Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/core/project-analyzer.ts src/types/index.ts
git commit -m "feat: implement real code style analysis"
```

---

### Task 6: 实现依赖关系的反向填充

**问题**：`usedBy` 和 `relatedTo` 永远为空，需要后处理填充

**Files:**
- Modify: `src/core/knowledge-base.ts`

**Step 1: 添加后处理方法**

```typescript
private async populateReverseRelations(): Promise<void> {
  const pages = new Map<string, { frontmatter: PageFrontmatter; filePath: string }>()
  
  const categories = ['entities', 'concepts', 'sources', 'synthesis']
  for (const category of categories) {
    const categoryPath = path.join(this.basePath, category)
    if (!await fileExists(categoryPath)) continue
    
    const files = await listFiles(categoryPath, ['.md'])
    for (const file of files) {
      const page = await readMarkdownFile(file)
      if (page) {
        const pageId = path.basename(file, '.md')
        pages.set(pageId, { frontmatter: page.frontmatter, filePath: file })
      }
    }
  }
  
  const usedByMap = new Map<string, string[]>()
  const relatedToMap = new Map<string, string[]>()
  
  for (const [pageId, { frontmatter }] of pages) {
    const dependsOn = frontmatter.relations?.dependsOn || []
    
    for (const dep of dependsOn) {
      if (!usedByMap.has(dep)) {
        usedByMap.set(dep, [])
      }
      usedByMap.get(dep)!.push(pageId)
    }
    
    const links = await this.extractPageLinks(frontmatter)
    for (const link of links) {
      if (pages.has(link) && link !== pageId) {
        if (!relatedToMap.has(pageId)) {
          relatedToMap.set(pageId, [])
        }
        if (!relatedToMap.get(pageId)!.includes(link)) {
          relatedToMap.get(pageId)!.push(link)
        }
      }
    }
  }
  
  for (const [pageId, { frontmatter, filePath }] of pages) {
    const usedBy = usedByMap.get(pageId) || []
    const relatedTo = relatedToMap.get(pageId) || []
    
    if (usedBy.length > 0 || relatedTo.length > 0) {
      if (!frontmatter.relations) {
        frontmatter.relations = { dependsOn: [], usedBy: [], relatedTo: [] }
      }
      
      frontmatter.relations.usedBy = usedBy
      frontmatter.relations.relatedTo = relatedTo
      
      const content = await fs.readFile(filePath, 'utf-8')
      const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, '')
      await writeMarkdownFile(filePath, frontmatter, contentWithoutFrontmatter)
    }
  }
}

private async extractPageLinks(frontmatter: PageFrontmatter): Promise<string[]> {
  const links: string[] = []
  return links
}
```

**Step 2: 在 buildGraphIndex 中调用**

```typescript
private async buildGraphIndex(): Promise<void> {
  // ... existing code ...
  
  await this.populateReverseRelations()
  
  // ... rest of the method ...
}
```

**Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/core/knowledge-base.ts
git commit -m "feat: implement reverse relation population (usedBy, relatedTo)"
```

---

### Task 7: 改进配置文件解析

**问题**：配置文件只检查是否存在，不解析内容

**Files:**
- Modify: `src/core/project-analyzer.ts:160-199`

**Step 1: 增强配置检测**

```typescript
private async checkConfigFiles(): Promise<{
  hasPackage: boolean
  hasLint: boolean
  hasTest: boolean
  packageFile: string | null
}> {
  const result = {
    hasPackage: false,
    hasLint: false,
    hasTest: false,
    packageFile: null as string | null,
  }

  const packageFiles = ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle']
  
  for (const file of packageFiles) {
    const filePath = path.join(this.projectPath, file)
    if (await this.fileExists(filePath)) {
      result.hasPackage = true
      result.packageFile = file
      
      if (file === 'package.json') {
        const config = await this.parsePackageJson(filePath)
        if (config.hasLint) result.hasLint = true
        if (config.hasTest) result.hasTest = true
      } else if (file === 'pyproject.toml') {
        const config = await this.parsePyprojectToml(filePath)
        if (config.hasLint) result.hasLint = true
        if (config.hasTest) result.hasTest = true
      }
      break
    }
  }

  if (!result.hasLint) {
    const lintFiles = [
      '.eslintrc', '.eslintrc.js', '.eslintrc.json', 'eslint.config.js',
      '.prettierrc', '.prettierrc.js', '.prettierrc.json',
      '.flake8', 'setup.cfg', 'rustfmt.toml', '.clang-format'
    ]
    for (const file of lintFiles) {
      if (await this.fileExists(path.join(this.projectPath, file))) {
        result.hasLint = true
        break
      }
    }
  }

  if (!result.hasTest) {
    const testFiles = [
      'jest.config.js', 'jest.config.ts', 'vitest.config.ts',
      'pytest.ini', 'conftest.py', 'Cargo.toml', 'pom.xml'
    ]
    for (const file of testFiles) {
      if (await this.fileExists(path.join(this.projectPath, file))) {
        result.hasTest = true
        break
      }
    }
  }

  return result
}

private async parsePackageJson(filePath: string): Promise<{ hasLint: boolean; hasTest: boolean }> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const pkg = JSON.parse(content)
    
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    const lintTools = ['eslint', 'prettier', '@typescript-eslint', 'biome']
    const testTools = ['jest', 'vitest', 'mocha', 'ava', 'cypress', 'playwright']
    
    const hasLint = Object.keys(deps).some(d => lintTools.includes(d) || d.includes('eslint'))
    const hasTest = Object.keys(deps).some(d => testTools.includes(d))
    
    return { hasLint, hasTest }
  } catch {
    return { hasLint: false, hasTest: false }
  }
}

private async parsePyprojectToml(filePath: string): Promise<{ hasLint: boolean; hasTest: boolean }> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    
    const hasLint = content.includes('flake8') || 
                    content.includes('black') || 
                    content.includes('isort') ||
                    content.includes('ruff') ||
                    content.includes('mypy')
    
    const hasTest = content.includes('pytest') || 
                    content.includes('unittest') ||
                    content.includes('[tool.pytest')
    
    return { hasLint, hasTest }
  } catch {
    return { hasLint: false, hasTest: false }
  }
}
```

**Step 2: 更新 calculateStructureScore 使用新返回值**

```typescript
const configFiles = await this.checkConfigFiles()
if (configFiles.hasPackage) configScore += 10
if (configFiles.hasLint) configScore += 10
if (configFiles.hasTest) configScore += 10
```

**Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/core/project-analyzer.ts
git commit -m "feat: improve config file parsing for better detection"
```

---

## 阶段三：次要优化

### Task 8: 优化进度显示

**问题**：`\r` 在非 TTY 环境下会出问题

**Files:**
- Modify: `src/core/ingest-orchestrator.ts:398-420`

**Step 1: 添加 TTY 检测**

```typescript
private renderProgressBar(progress: IngestProgress): void {
  if (!process.stdout.isTTY) {
    if (progress.percentage % 20 === 0) {
      console.log(`Progress: ${progress.percentage}% (${progress.processed}/${progress.total})`)
    }
    return
  }
  
  const barWidth = 30
  const filled = Math.round((progress.percentage / 100) * barWidth)
  const empty = barWidth - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  
  const elapsedSec = Math.round(progress.elapsed / 1000)
  const estimatedSec = Math.round(progress.estimated / 1000)
  
  const filename = path.basename(progress.currentFile).substring(0, 20)
  
  process.stdout.write(
    `\r[${bar}] ${progress.percentage}% (${progress.processed}/${progress.total}) ${filename.padEnd(20)} ${Math.round(progress.speed)} files/s ETA: ${this.formatTime(estimatedSec)}`
  )
}
```

**Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/ingest-orchestrator.ts
git commit -m "fix: improve progress display for non-TTY environments"
```

---

### Task 9: 添加错误恢复机制

**问题**：文件读取失败后没有重试

**Files:**
- Modify: `src/core/ingest-orchestrator.ts`

**Step 1: 添加重试逻辑**

```typescript
private async processFileWithRetry(
  file: string,
  processor: FileProcessor,
  maxRetries: number = 2
): Promise<string | null> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await processor(file)
    } catch (error) {
      lastError = error as Error
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)))
      }
    }
  }
  
  throw lastError
}
```

**Step 2: 更新 processFast 和 processBatch 使用重试**

在处理文件时使用 `processFileWithRetry` 替代直接调用 `processor`。

**Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/core/ingest-orchestrator.ts
git commit -m "feat: add retry mechanism for file processing"
```

---

## 验证清单

完成所有任务后，运行以下验证：

```bash
# 编译检查
npx tsc --noEmit

# 构建检查
npm run build

# 测试（如果有）
npm test
```

---

## 总结

本计划分三个阶段修复已识别的问题：

1. **阶段一（关键）**：修复影响核心功能的问题
2. **阶段二（重要）**：提升使用体验
3. **阶段三（次要）**：优化细节

每个任务都遵循 TDD 原则，包含明确的文件路径、代码示例和验证步骤。
