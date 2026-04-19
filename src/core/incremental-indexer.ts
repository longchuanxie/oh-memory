import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from '../types/index.js'
import { readMarkdownFile, listFiles, fileExists } from '../utils/file-utils.js'

export interface FileChange {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'unchanged'
  oldHash?: string
  newHash?: string
}

export interface IncrementalIndexResult {
  addedNodes: string[]
  updatedNodes: string[]
  deletedNodes: string[]
  rebuildRequired: boolean
  duration: number
}

export class IncrementalIndexer {
  private basePath: string
  private fileHashes: Map<string, string> = new Map()

  constructor(basePath: string) {
    this.basePath = basePath
  }

  async detectChanges(): Promise<FileChange[]> {
    const changes: FileChange[] = []
    const categories = ['entities', 'concepts', 'sources', 'synthesis']
    
    const currentFiles = new Set<string>()
    
    for (const category of categories) {
      const categoryPath = path.join(this.basePath, category)
      
      if (!await fileExists(categoryPath)) {
        continue
      }

      const files = await listFiles(categoryPath, ['.md'])
      
      for (const file of files) {
        currentFiles.add(file)
        const currentHash = await this.computeFileHash(file)
        const oldHash = this.fileHashes.get(file)
        
        if (!oldHash) {
          changes.push({
            path: file,
            status: 'added',
            newHash: currentHash
          })
        } else if (oldHash !== currentHash) {
          changes.push({
            path: file,
            status: 'modified',
            oldHash,
            newHash: currentHash
          })
        } else {
          changes.push({
            path: file,
            status: 'unchanged'
          })
        }
        
        this.fileHashes.set(file, currentHash)
      }
    }

    for (const [file, hash] of this.fileHashes) {
      if (!currentFiles.has(file)) {
        changes.push({
          path: file,
          status: 'deleted',
          oldHash: hash
        })
        this.fileHashes.delete(file)
      }
    }

    return changes
  }

  async incrementalBuild(
    existingGraph: KnowledgeGraph,
    changes: FileChange[]
  ): Promise<IncrementalIndexResult> {
    const startTime = Date.now()
    const result: IncrementalIndexResult = {
      addedNodes: [],
      updatedNodes: [],
      deletedNodes: [],
      rebuildRequired: false,
      duration: 0
    }

    if (this.shouldRebuildFull(changes)) {
      result.rebuildRequired = true
      result.duration = Date.now() - startTime
      return result
    }

    const nodesMap = new Map(existingGraph.nodes.map(n => [n.id, n]))
    const edgesMap = new Map<string, KnowledgeEdge[]>()

    for (const edge of existingGraph.edges) {
      const key = `${edge.from}->${edge.to}`
      if (!edgesMap.has(key)) {
        edgesMap.set(key, [])
      }
      edgesMap.get(key)!.push(edge)
    }

    for (const change of changes.filter(c => c.status === 'deleted')) {
      const pageId = path.basename(change.path, '.md')
      nodesMap.delete(pageId)
      result.deletedNodes.push(pageId)
      
      for (const [key, edges] of edgesMap) {
        edgesMap.set(key, edges.filter(e => e.from !== pageId && e.to !== pageId))
      }
    }

    for (const change of changes.filter(c => c.status === 'added' || c.status === 'modified')) {
      const page = await readMarkdownFile(change.path)
      
      if (!page) continue

      const pageId = path.basename(change.path, '.md')
      
      const node: KnowledgeNode = {
        id: pageId,
        title: page.frontmatter.title || pageId,
        path: change.path,
        type: page.frontmatter.type || 'entity',
        tags: page.frontmatter.tags || [],
        lastUpdated: new Date().toISOString(),
        description: page.frontmatter.description
      }
      
      nodesMap.set(pageId, node)
      
      if (change.status === 'added') {
        result.addedNodes.push(pageId)
      } else {
        result.updatedNodes.push(pageId)
      }
    }

    result.duration = Date.now() - startTime
    return result
  }

  private shouldRebuildFull(changes: FileChange[]): boolean {
    const changeCount = changes.filter(c => c.status !== 'unchanged').length
    const totalCount = this.fileHashes.size || 1
    
    if (changeCount / totalCount > 0.3) {
      return true
    }
    
    if (changeCount > 100) {
      return true
    }

    return false
  }

  private async computeFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8')
    return crypto.createHash('md5').update(content).digest('hex')
  }

  setFileHashes(hashes: Map<string, string>): void {
    this.fileHashes = hashes
  }

  getFileHashes(): Map<string, string> {
    return this.fileHashes
  }

  loadFileHashes(hashes: Record<string, string>): void {
    this.fileHashes = new Map(Object.entries(hashes))
  }

  exportFileHashes(): Record<string, string> {
    return Object.fromEntries(this.fileHashes)
  }
}
