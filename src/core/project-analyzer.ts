import path from 'path'
import { promises as fs } from 'fs'
import type { 
  ProjectArchitecture, 
  StructureScore,
  DirectoryStructure,
  DirectoryNode,
  TechStack,
  CodeStyle,
  ModuleInfo,
  AnalysisCache,
  AnalysisChange,
  LanguageInfo,
  DependencyInfo,
  LayerInfo,
  NamingConvention,
  FormattingStyle,
  BestPractice,
} from '../types/index.js'

export class ProjectAnalyzer {
  private projectPath: string
  private cachePath: string
  private cache: AnalysisCache | null = null

  constructor(projectPath: string, memoryPath: string) {
    this.projectPath = projectPath
    this.cachePath = path.join(memoryPath, '.analysis-cache.json')
  }

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
      structure: { 
        root: this.projectPath, 
        directories: [], 
        maxDepth: 0, 
        totalFiles: 0, 
        totalDirs: 0 
      },
      structureScore: { 
        total: 0, 
        directory: 0, 
        config: 0, 
        organization: 0, 
        documentation: 0, 
        level: 'messy' 
      },
      techStack: { 
        languages: [], 
        frameworks: [], 
        libraries: [], 
        tools: [], 
        packageManager: null, 
        buildTool: null, 
        testFramework: null 
      },
      modules: [],
      entryPoints: [],
      layers: [],
      lastAnalyzed: new Date().toISOString(),
    }
  }

  private createSingleFileArchitecture(structure: DirectoryStructure): ProjectArchitecture {
    return {
      structure,
      structureScore: { 
        total: 10, 
        directory: 0, 
        config: 0, 
        organization: 10, 
        documentation: 0, 
        level: 'messy' 
      },
      techStack: { 
        languages: [], 
        frameworks: [], 
        libraries: [], 
        tools: [], 
        packageManager: null, 
        buildTool: null, 
        testFramework: null 
      },
      modules: [],
      entryPoints: [],
      layers: [],
      lastAnalyzed: new Date().toISOString(),
    }
  }

  private async analyzeStructure(): Promise<DirectoryStructure> {
    const directories: DirectoryNode[] = []
    let maxDepth = 0
    let totalFiles = 0
    let totalDirs = 0

    const walk = async (dir: string, depth: number): Promise<DirectoryNode> => {
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
      
      const children: DirectoryNode[] = []
      let fileCount = 0
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        if (this.shouldIgnore(entry.name)) continue
        
        if (entry.isDirectory()) {
          totalDirs++
          const child = await walk(fullPath, depth + 1)
          if (child) {
            children.push(child)
            maxDepth = Math.max(maxDepth, depth + 1)
          }
        } else if (entry.isFile()) {
          totalFiles++
          fileCount++
        }
      }
      
      const relativePath = path.relative(this.projectPath, dir)
      
      return {
        name: path.basename(dir),
        path: relativePath || '.',
        type: 'directory',
        children: children.length > 0 ? children : undefined,
        fileCount,
      }
    }

    const root = await walk(this.projectPath, 0)
    directories.push(root)

    return {
      root: this.projectPath,
      directories,
      maxDepth,
      totalFiles,
      totalDirs,
    }
  }

  private shouldIgnore(name: string): boolean {
    const ignorePatterns = [
      'node_modules', '.git', '.memory', 'dist', 'build', '.next',
      '__pycache__', '.cache', 'coverage', '.nyc_output', 'vendor',
      'target', 'out', 'bin', 'obj', '.gradle', '.mvn', 'Pods',
      'DerivedData', '.idea', '.vscode', '.vs', '.DS_Store', 'Thumbs.db',
    ]
    return ignorePatterns.includes(name) || name.startsWith('.')
  }

  private async calculateStructureScore(structure: DirectoryStructure): Promise<StructureScore> {
    let directoryScore = 0
    let configScore = 0
    let organizationScore = 0
    let documentationScore = 0

    const standardDirs = ['src', 'lib', 'core', 'app', 'apps', 'packages']
    const hasStandardDir = structure.directories.some((d: DirectoryNode) => 
      standardDirs.includes(d.name.toLowerCase())
    )
    if (hasStandardDir) directoryScore += 10

    const moduleDirs = ['modules', 'components', 'features', 'services', 'utils', 'helpers']
    const hasModuleDir = structure.directories.some((d: DirectoryNode) => 
      d.children?.some((c: DirectoryNode) => moduleDirs.includes(c.name.toLowerCase()))
    )
    if (hasModuleDir) directoryScore += 10

    if (structure.maxDepth <= 4) directoryScore += 10

    const configFiles = await this.checkConfigFiles()
    if (configFiles.hasPackage) configScore += 10
    if (configFiles.hasLint) configScore += 10
    if (configFiles.hasTest) configScore += 10

    const namingConsistency = await this.checkNamingConsistency()
    organizationScore += namingConsistency * 10

    const docs = await this.checkDocumentation()
    if (docs.hasReadme) documentationScore += 5
    if (docs.hasApiDocs) documentationScore += 5
    if (docs.hasArchDocs) documentationScore += 5

    const total = directoryScore + configScore + organizationScore + documentationScore
    
    let level: 'clear' | 'moderate' | 'messy'
    if (total >= 70) level = 'clear'
    else if (total >= 40) level = 'moderate'
    else level = 'messy'

    return {
      total,
      directory: directoryScore,
      config: configScore,
      organization: organizationScore,
      documentation: documentationScore,
      level,
    }
  }

  private async checkConfigFiles(): Promise<{
    hasPackage: boolean
    hasLint: boolean
    hasTest: boolean
  }> {
    const result = {
      hasPackage: false,
      hasLint: false,
      hasTest: false,
    }

    const packageFiles = ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle']
    
    for (const file of packageFiles) {
      const filePath = path.join(this.projectPath, file)
      if (await this.fileExists(filePath)) {
        result.hasPackage = true
        
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

  private async checkNamingConsistency(): Promise<number> {
    const entries = await fs.readdir(this.projectPath, { withFileTypes: true }).catch(() => [])
    
    const jsFiles: string[] = []
    const tsFiles: string[] = []
    const pyFiles: string[] = []
    
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const name = entry.name
      if (name.endsWith('.js') || name.endsWith('.jsx')) jsFiles.push(name)
      if (name.endsWith('.ts') || name.endsWith('.tsx')) tsFiles.push(name)
      if (name.endsWith('.py')) pyFiles.push(name)
    }

    let score = 0
    
    if (jsFiles.length > 0 || tsFiles.length > 0) {
      const camelCase = [...jsFiles, ...tsFiles].filter(f => /^[a-z][a-zA-Z0-9]*\./.test(f)).length
      const kebabCase = [...jsFiles, ...tsFiles].filter(f => /^[a-z][a-z0-9-]*\./.test(f)).length
      const total = jsFiles.length + tsFiles.length
      const consistency = Math.max(camelCase, kebabCase) / total
      score += consistency
    }
    
    if (pyFiles.length > 0) {
      const snakeCase = pyFiles.filter(f => /^[a-z][a-z0-9_]*\.py$/.test(f)).length
      const consistency = snakeCase / pyFiles.length
      score += consistency
    }

    return Math.min(score, 1)
  }

  private async checkDocumentation(): Promise<{
    hasReadme: boolean
    hasApiDocs: boolean
    hasArchDocs: boolean
  }> {
    const docs = {
      hasReadme: false,
      hasApiDocs: false,
      hasArchDocs: false,
    }

    const readmeFiles = ['README.md', 'README.txt', 'readme.md']
    for (const file of readmeFiles) {
      if (await this.fileExists(path.join(this.projectPath, file))) {
        docs.hasReadme = true
        break
      }
    }

    const apiDocDirs = ['docs', 'doc', 'api-docs', 'documentation']
    for (const dir of apiDocDirs) {
      if (await this.dirExists(path.join(this.projectPath, dir))) {
        docs.hasApiDocs = true
        break
      }
    }

    const archFiles = ['ARCHITECTURE.md', 'architecture.md', 'docs/architecture.md']
    for (const file of archFiles) {
      if (await this.fileExists(path.join(this.projectPath, file))) {
        docs.hasArchDocs = true
        break
      }
    }

    return docs
  }

  private async detectTechStack(): Promise<TechStack> {
    const languages = await this.detectLanguages()
    const { frameworks, libraries, tools, packageManager, buildTool, testFramework } = 
      await this.detectDependencies(languages)

    return {
      languages,
      frameworks,
      libraries,
      tools,
      packageManager,
      buildTool,
      testFramework,
    }
  }

  private async detectLanguages(): Promise<LanguageInfo[]> {
    const languageExtensions: Record<string, string[]> = {
      TypeScript: ['.ts', '.tsx'],
      JavaScript: ['.js', '.jsx', '.mjs', '.cjs'],
      Python: ['.py', '.pyw'],
      Go: ['.go'],
      Rust: ['.rs'],
      Java: ['.java'],
      Kotlin: ['.kt', '.kts'],
      C: ['.c', '.h'],
      'C++': ['.cpp', '.hpp', '.cc', '.cxx'],
      Ruby: ['.rb'],
      PHP: ['.php'],
      Swift: ['.swift'],
      ObjectiveC: ['.m', '.mm'],
    }

    const counts: Record<string, number> = {}
    const extensions: Record<string, string[]> = {}
    let total = 0

    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
      
      for (const entry of entries) {
        if (this.shouldIgnore(entry.name)) continue
        
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name)
          for (const [lang, exts] of Object.entries(languageExtensions)) {
            if (exts.includes(ext)) {
              counts[lang] = (counts[lang] || 0) + 1
              if (!extensions[lang]) extensions[lang] = []
              if (!extensions[lang].includes(ext)) extensions[lang].push(ext)
              total++
              break
            }
          }
        }
      }
    }

    await walk(this.projectPath)

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        fileCount: count,
        extensions: extensions[name] || [],
      }))
      .sort((a, b) => b.fileCount - a.fileCount)
  }

  private async detectDependencies(languages: LanguageInfo[]): Promise<{
    frameworks: DependencyInfo[]
    libraries: DependencyInfo[]
    tools: DependencyInfo[]
    packageManager: string | null
    buildTool: string | null
    testFramework: string | null
  }> {
    const result = {
      frameworks: [] as DependencyInfo[],
      libraries: [] as DependencyInfo[],
      tools: [] as DependencyInfo[],
      packageManager: null as string | null,
      buildTool: null as string | null,
      testFramework: null as string | null,
    }

    const packageJsonPath = path.join(this.projectPath, 'package.json')
    if (await this.fileExists(packageJsonPath)) {
      try {
        const content = await fs.readFile(packageJsonPath, 'utf-8')
        const pkg = JSON.parse(content)
        
        result.packageManager = 'npm'
        
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }
        
        const frameworks = ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'express', 
                           'fastify', 'nestjs', 'koa', 'electron', 'react-native']
        const testFrameworks = ['jest', 'vitest', 'mocha', 'jasmine', 'ava', 'cypress', 'playwright']
        const buildTools = ['webpack', 'vite', 'esbuild', 'rollup', 'parcel', 'turbo']
        
        for (const [name, version] of Object.entries(deps)) {
          const depInfo = {
            name,
            version: (version as string).replace(/^[\^~]/, ''),
            type: (pkg.dependencies?.[name] ? 'production' : 'development') as 'production' | 'development',
          }
          
          if (frameworks.includes(name)) {
            result.frameworks.push({ ...depInfo, category: 'framework' })
          } else if (testFrameworks.includes(name)) {
            result.tools.push({ ...depInfo, category: 'testing' })
            if (!result.testFramework) result.testFramework = name
          } else if (buildTools.includes(name)) {
            result.tools.push({ ...depInfo, category: 'build' })
            if (!result.buildTool) result.buildTool = name
          } else {
            result.libraries.push(depInfo)
          }
        }
      } catch {}
    }

    const pyprojectPath = path.join(this.projectPath, 'pyproject.toml')
    if (await this.fileExists(pyprojectPath)) {
      result.packageManager = 'pip'
      
      const frameworks = ['django', 'flask', 'fastapi', 'tornado', 'pyramid']
      const testFrameworks = ['pytest', 'unittest', 'nose']
      
      try {
        const content = await fs.readFile(pyprojectPath, 'utf-8')
        
        for (const fw of frameworks) {
          if (content.includes(fw)) {
            result.frameworks.push({ name: fw, version: 'unknown', type: 'production' as const, category: 'framework' })
          }
        }
        for (const tf of testFrameworks) {
          if (content.includes(tf)) {
            result.testFramework = tf
          }
        }
      } catch {}
    }

    const cargoPath = path.join(this.projectPath, 'Cargo.toml')
    if (await this.fileExists(cargoPath)) {
      result.packageManager = 'cargo'
      result.buildTool = 'cargo'
    }

    const goModPath = path.join(this.projectPath, 'go.mod')
    if (await this.fileExists(goModPath)) {
      result.packageManager = 'go modules'
      result.buildTool = 'go'
    }

    return result
  }

  private async detectModules(structure: DirectoryStructure): Promise<ModuleInfo[]> {
    const modules: ModuleInfo[] = []
    
    const modulePatterns = [
      { pattern: 'src/core', type: 'core' as const },
      { pattern: 'src/lib', type: 'core' as const },
      { pattern: 'src/utils', type: 'util' as const },
      { pattern: 'src/helpers', type: 'util' as const },
      { pattern: 'src/features', type: 'feature' as const },
      { pattern: 'src/modules', type: 'feature' as const },
      { pattern: 'src/components', type: 'feature' as const },
      { pattern: 'src/services', type: 'feature' as const },
      { pattern: 'src/config', type: 'config' as const },
      { pattern: 'src/__tests__', type: 'test' as const },
      { pattern: 'tests', type: 'test' as const },
      { pattern: '__tests__', type: 'test' as const },
    ]

    const findDirs = (node: DirectoryNode, parentPath: string = ''): string[] => {
      const dirs: string[] = []
      const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name
      
      if (node.type === 'directory') {
        dirs.push(currentPath)
        if (node.children) {
          for (const child of node.children) {
            dirs.push(...findDirs(child, currentPath))
          }
        }
      }
      return dirs
    }

    const allDirs: string[] = []
    for (const root of structure.directories) {
      allDirs.push(...findDirs(root))
    }

    for (const { pattern, type } of modulePatterns) {
      const matchingDir = allDirs.find(d => d === pattern || d.endsWith(`/${pattern}`))
      if (matchingDir) {
        const fullPath = path.join(this.projectPath, matchingDir)
        const fileCount = await this.countFiles(fullPath)
        
        modules.push({
          name: path.basename(matchingDir),
          path: matchingDir,
          type,
          fileCount,
          dependencies: [],
        })
      }
    }

    return modules
  }

  private async countFiles(dir: string): Promise<number> {
    let count = 0
    const walk = async (d: string) => {
      const entries = await fs.readdir(d, { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        if (this.shouldIgnore(entry.name)) continue
        const fullPath = path.join(d, entry.name)
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else if (entry.isFile()) {
          count++
        }
      }
    }
    await walk(dir)
    return count
  }

  private async findEntryPoints(): Promise<string[]> {
    const entryPoints: string[] = []
    
    const commonEntries = [
      'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
      'src/app.ts', 'src/app.js', 'index.ts', 'index.js',
      'main.py', 'app.py', '__init__.py',
      'main.go', 'cmd/main.go',
      'src/main.rs', 'main.rs',
      'Main.java',
    ]

    for (const entry of commonEntries) {
      const fullPath = path.join(this.projectPath, entry)
      if (await this.fileExists(fullPath)) {
        entryPoints.push(entry)
      }
    }

    return entryPoints
  }

  private inferLayers(structure: DirectoryStructure, modules: ModuleInfo[]): LayerInfo[] {
    const layers: LayerInfo[] = []
    
    const layerPatterns = [
      { names: ['api', 'routes', 'controllers'], purpose: 'API layer - handles HTTP requests and routing' },
      { names: ['services', 'business'], purpose: 'Service layer - contains business logic' },
      { names: ['models', 'entities', 'domain'], purpose: 'Domain layer - defines data models and entities' },
      { names: ['repositories', 'data', 'dao'], purpose: 'Data layer - handles data persistence' },
      { names: ['utils', 'helpers', 'common'], purpose: 'Utility layer - shared utilities and helpers' },
      { names: ['config', 'settings'], purpose: 'Configuration layer - app configuration and settings' },
    ]

    for (const { names, purpose } of layerPatterns) {
      const matchingModules = modules.filter(m => names.includes(m.name.toLowerCase()))
      if (matchingModules.length > 0) {
        layers.push({
          name: matchingModules[0].name,
          directories: matchingModules.map(m => m.path),
          purpose,
        })
      }
    }

    return layers
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private async dirExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath)
      return stat.isDirectory()
    } catch {
      return false
    }
  }

  private async saveCache(structureScore: StructureScore, techStack: TechStack): Promise<void> {
    this.cache = {
      structureScore,
      techStackHash: this.hashTechStack(techStack),
      structureHash: Date.now().toString(),
      lastAnalyzed: new Date().toISOString(),
      changes: [],
    }
    await fs.writeFile(this.cachePath, JSON.stringify(this.cache, null, 2), 'utf-8')
  }

  private hashTechStack(techStack: TechStack): string {
    const langs = techStack.languages.map(l => l.name).join(',')
    const fws = techStack.frameworks.map(f => f.name).join(',')
    return `${langs}|${fws}`
  }

  async loadCache(): Promise<AnalysisCache | null> {
    try {
      const content = await fs.readFile(this.cachePath, 'utf-8')
      this.cache = JSON.parse(content)
      return this.cache
    } catch {
      return null
    }
  }

  async needsReanalysis(): Promise<boolean> {
    const cache = await this.loadCache()
    if (!cache) return true

    const currentStructure = await this.analyzeStructure()
    const currentScore = await this.calculateStructureScore(currentStructure)
    
    if (Math.abs(currentScore.total - cache.structureScore.total) > 10) {
      return true
    }

    const configChanged = await this.checkConfigChanged(cache.lastAnalyzed)
    if (configChanged) return true

    return false
  }

  private async checkConfigChanged(since: string): Promise<boolean> {
    const configFiles = [
      'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod',
      'tsconfig.json', 'jest.config.js', 'vitest.config.ts',
    ]

    for (const file of configFiles) {
      const filePath = path.join(this.projectPath, file)
      try {
        const stat = await fs.stat(filePath)
        if (stat.mtime.toISOString() > since) {
          return true
        }
      } catch {}
    }

    return false
  }

  async analyzeCodeStyle(): Promise<CodeStyle[]> {
    const styles: CodeStyle[] = []
    const techStack = await this.detectTechStack()
    
    for (const lang of techStack.languages.slice(0, 3)) {
      const style = await this.analyzeLanguageStyle(lang.name)
      if (style) {
        styles.push(style)
      }
    }

    return styles
  }

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
        
        if (language === 'Python') {
          const varMatches = content.matchAll(/^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*=/gm)
          for (const m of varMatches) variableNames.push(m[2])
          
          const funcMatches = content.matchAll(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)/g)
          for (const m of funcMatches) functionNames.push(m[1])
          
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

  private detectNamingStyle(names: string[]): { style: 'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case' | 'UPPER_CASE'; consistency: number } {
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
      style: topStyle as 'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case' | 'UPPER_CASE',
      consistency: total > 0 ? topCount / total : 0,
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
    
    if (language === 'Python') {
      const hasBlack = await this.hasAnyFile(['pyproject.toml'])
      let hasBlackConfig = false
      if (hasBlack) {
        try {
          const content = await fs.readFile(path.join(this.projectPath, 'pyproject.toml'), 'utf-8')
          hasBlackConfig = content.includes('black')
        } catch {}
      }
      practices.push({
        name: 'Black Formatter',
        status: hasBlackConfig ? 'adopted' : 'missing',
        description: 'Project uses Black for code formatting',
      })
      
      const hasFlake8 = await this.hasAnyFile(['.flake8', 'setup.cfg', 'pyproject.toml'])
      practices.push({
        name: 'Flake8 Linter',
        status: hasFlake8 ? 'adopted' : 'missing',
        description: 'Project uses Flake8 for code quality',
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
}
