import { promises as fs } from 'fs'

import matter from 'gray-matter'
import crypto from 'crypto'
import type { KnowledgePage, PageFrontmatter, PageLink } from '../types/index.js'

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
    if (!await fileExists(filePath)) return null

    const rawContent = await fs.readFile(filePath, 'utf-8')
    const { data, content } = matter(rawContent)
    const links = extractLinks(content)

    return {
      frontmatter: data as PageFrontmatter,
      content: content.trim(),
      links,
    }
  } catch {
    return null
  }
}

function removeUndefinedValues(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const cleaned = removeUndefinedValues(value as Record<string, unknown>)
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned
      }
    } else {
      result[key] = value
    }
  }

  return result
}

export async function writeMarkdownFile(
  filePath: string,
  frontmatter: PageFrontmatter,
  content: string
): Promise<void> {
  const cleanedFrontmatter = removeUndefinedValues(frontmatter as unknown as Record<string, unknown>)
  const fileContent = matter.stringify(content, cleanedFrontmatter)
  await fs.writeFile(filePath, fileContent, 'utf-8')
}




export function extractLinks(content: string): PageLink[] {
  const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
  const seen = new Set<string>()
  const links: PageLink[] = []

  const lines = content.split('\n')
  let currentSection: string | undefined

  for (const line of lines) {
    const headingMatch = line.match(/^#{2,3}\s+(.+)/)
    if (headingMatch) {
      currentSection = headingMatch[1].trim()
    }

    let match: RegExpExecArray | null
    const regex = new RegExp(linkRegex.source, 'g')
    while ((match = regex.exec(line)) !== null) {
      const target = match[1].trim()
      if (!seen.has(target)) {
        seen.add(target)
        links.push({ target, section: currentSection })
      }
    }
  }

  return links
}

export async function listFiles(
  dirPath: string,
  patterns: string[]
): Promise<string[]> {
  const files: string[] = []
  
  async function walk(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = `${currentPath}/${entry.name}`
      
      if (entry.isDirectory()) {
        if (!shouldIgnore(fullPath)) {
          await walk(fullPath)
        }
      } else if (entry.isFile() && matchesPatterns(entry.name, patterns)) {
        files.push(fullPath)
      }
    }
  }
  
  await walk(dirPath)
  return files
}

export function shouldIgnore(filePath: string): boolean {
  const ignorePatterns = [
    'node_modules', '.git', '.memory', 'dist', 'build', '.next',
    '__pycache__', '.cache', 'coverage', '.nyc_output', 'vendor',
    'target', 'out', 'bin', 'obj', '.gradle', '.mvn', 'Pods',
    'DerivedData', '.idea', '.vscode', '.vs',
  ]
  return ignorePatterns.some(pattern => filePath.includes(pattern))
}

export function matchesPatterns(fileName: string, patterns: string[]): boolean {
  return patterns.some(pattern => fileName.endsWith(pattern))
}

export async function getFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath)
  return crypto.createHash('md5').update(content).digest('hex')
}
