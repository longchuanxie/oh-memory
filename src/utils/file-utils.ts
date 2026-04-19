import { promises as fs } from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { KnowledgePage, PageFrontmatter } from '../types/index.js'

const execAsync = promisify(exec)

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error) {
    if ((error as any).code !== 'EEXIST') {
      throw error
    }
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function readMarkdownFile(filePath: string): Promise<KnowledgePage | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const { data, content: markdown } = matter(content)
    
    const links = extractLinks(markdown)
    
    return {
      frontmatter: data as PageFrontmatter,
      content: markdown,
      links,
    }
  } catch (error) {
    return null
  }
}

export async function writeMarkdownFile(
  filePath: string,
  frontmatter: PageFrontmatter,
  content: string
): Promise<void> {
  const fileContent = matter.stringify(content, frontmatter)
  await fs.writeFile(filePath, fileContent, 'utf-8')
}

export async function listFiles(
  dirPath: string,
  patterns: string[]
): Promise<string[]> {
  const files: string[] = []
  
  async function walk(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)
      
      if (entry.isDirectory()) {
        if (!shouldIgnore(fullPath)) {
          await walk(fullPath)
        }
      } else if (entry.isFile()) {
        if (matchesPatterns(fullPath, patterns)) {
          files.push(fullPath)
        }
      }
    }
  }
  
  await walk(dirPath)
  return files
}

export function extractLinks(content: string): string[] {
  const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
  const links: string[] = []
  let match
  
  while ((match = linkRegex.exec(content)) !== null) {
    links.push(match[1].trim())
  }
  
  return [...new Set(links)]
}

export function shouldIgnore(filePath: string): boolean {
  const ignorePatterns = [
    'node_modules',
    '.git',
    '.memory',
    'dist',
    'build',
    '.next',
    '__pycache__',
    '.cache',
    'coverage',
    '.nyc_output',
    'vendor',
    'target',
    'out',
    'bin',
    'obj',
    '.gradle',
    '.mvn',
    'Pods',
    'DerivedData',
    '.idea',
    '.vscode',
    '.vs',
  ]
  
  const ignoreFiles = [
    '.DS_Store',
    'Thumbs.db',
    '.env',
    '.env.local',
    '.env.development.local',
    '.env.test.local',
    '.env.production.local',
    'npm-debug.log',
    'yarn-debug.log',
    'yarn-error.log',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
  ]
  
  const fileName = path.basename(filePath)
  
  if (ignoreFiles.includes(fileName)) {
    return true
  }
  
  return ignorePatterns.some(pattern => filePath.includes(pattern))
}

export function matchesPatterns(filePath: string, patterns: string[]): boolean {
  const ext = path.extname(filePath)
  const fileName = path.basename(filePath)
  
  const supportedExtensions = [
    '.md', '.txt', '.js', '.ts', '.jsx', '.tsx',
    '.py', '.java', '.go', '.rs', '.rb',
    '.json', '.yaml', '.yml', '.toml',
    '.sh', '.bash', '.zsh',
    '.sql',
    '.proto',
    '.graphql', '.gql',
    '.vue', '.svelte',
    '.css', '.scss', '.sass', '.less',
    '.html', '.htm',
  ]
  
  const ignoredExtensions = [
    '.class',
    '.jar',
    '.war',
    '.ear',
    '.dll',
    '.exe',
    '.so',
    '.dylib',
    '.o',
    '.obj',
    '.a',
    '.lib',
    '.pyc',
    '.pyo',
    '.pyd',
    '.swp',
    '.swo',
    '.log',
    '.tmp',
    '.temp',
    '.bak',
    '.backup',
    '.orig',
    '.min.js',
    '.min.css',
    '.map',
    '.lock',
  ]
  
  if (ignoredExtensions.some(ignoredExt => fileName.endsWith(ignoredExt) || ext === ignoredExt)) {
    return false
  }
  
  return supportedExtensions.includes(ext)
}

export async function getFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath)
  const hash = Bun.hash(content)
  return hash.toString()
}

export async function copyTemplate(
  templatePath: string,
  targetPath: string,
  replacements: Record<string, string> = {}
): Promise<void> {
  let content = await fs.readFile(templatePath, 'utf-8')
  
  for (const [key, value] of Object.entries(replacements)) {
    content = content.replace(new RegExp(`{{${key}}}`, 'g'), value)
  }
  
  await fs.writeFile(targetPath, content, 'utf-8')
}

export async function isGitRepository(projectDir: string): Promise<boolean> {
  try {
    await execAsync('git rev-parse --git-dir', { cwd: projectDir })
    return true
  } catch (error) {
    return false
  }
}

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
