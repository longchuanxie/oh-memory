import path from 'path'
import { promises as fs } from 'fs'
import type { 
  GraphUpdatePlan, 
  PageFrontmatter,
  ConnectionStats,
} from '../types/index.js'

interface FileCache {
  path: string
  hash: string
  lastModified: string
  pageId: string
}

interface GraphCache {
  files: Map<string, FileCache>
  lastUpdated: string
  version: string
}

export class GraphUpdater {
  private basePath: string
  private cachePath: string
  private logPath: string
  private cache: GraphCache | null = null

  constructor(memoryPath: string) {
    this.basePath = memoryPath
    this.cachePath = path.join(memoryPath, 'graph-cache.json')
    this.logPath = path.join(memoryPath, 'graph-update.log')
  }

  async initialize(): Promise<void> {
    await this.loadCache()
  }

  private async loadCache(): Promise<void> {
    try {
      const content = await fs.readFile(this.cachePath, 'utf-8')
      const data = JSON.parse(content)
      this.cache = {
        files: new Map(Object.entries(data.files || {})),
        lastUpdated: data.lastUpdated || '',
        version: data.version || '1.0.0',
      }
    } catch {
      this.cache = {
        files: new Map(),
        lastUpdated: '',
        version: '1.0.0',
      }
    }
  }

  private async saveCache(): Promise<void> {
    if (!this.cache) return
    
    const data = {
      files: Object.fromEntries(this.cache.files),
      lastUpdated: this.cache.lastUpdated,
      version: this.cache.version,
    }
    
    await fs.writeFile(this.cachePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  async detectChanges(
    currentFiles: Map<string, { hash: string; lastModified: string; pageId: string }>
  ): Promise<GraphUpdatePlan> {
    if (!this.cache) {
      await this.loadCache()
    }

    const plan: GraphUpdatePlan = {
      addedNodes: [],
      updatedNodes: [],
      deletedNodes: [],
      addedEdges: [],
      deletedEdges: [],
      affectedLayers: [],
    }

    for (const [filePath, info] of currentFiles) {
      const cached = this.cache!.files.get(filePath)
      
      if (!cached) {
        plan.addedNodes.push(info.pageId)
      } else if (cached.hash !== info.hash) {
        plan.updatedNodes.push(info.pageId)
      }
    }

    for (const [filePath, cached] of this.cache!.files) {
      if (!currentFiles.has(filePath)) {
        plan.deletedNodes.push(cached.pageId)
      }
    }

    const affectedTypes = new Set<string>()
    for (const nodeId of [...plan.addedNodes, ...plan.updatedNodes, ...plan.deletedNodes]) {
      const type = this.inferTypeFromId(nodeId)
      if (type) affectedTypes.add(type)
    }
    plan.affectedLayers = [...affectedTypes]

    return plan
  }

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

  async updateCache(
    files: Map<string, { hash: string; lastModified: string; pageId: string }>
  ): Promise<void> {
    if (!this.cache) {
      await this.loadCache()
    }

    this.cache!.files.clear()
    for (const [filePath, info] of files) {
      this.cache!.files.set(filePath, {
        path: filePath,
        hash: info.hash,
        lastModified: info.lastModified,
        pageId: info.pageId,
      })
    }
    
    this.cache!.lastUpdated = new Date().toISOString()
    await this.saveCache()
  }

  async appendUpdateLog(plan: GraphUpdatePlan, duration: number): Promise<void> {
    const timestamp = new Date().toISOString()
    const lines: string[] = [
      `[${timestamp}] Incremental update`,
      `- Added nodes: ${plan.addedNodes.length > 0 ? plan.addedNodes.join(', ') : 'none'}`,
      `- Updated nodes: ${plan.updatedNodes.length > 0 ? plan.updatedNodes.join(', ') : 'none'}`,
      `- Deleted nodes: ${plan.deletedNodes.length > 0 ? plan.deletedNodes.join(', ') : 'none'}`,
      `- Affected layers: ${plan.affectedLayers.length > 0 ? plan.affectedLayers.join(', ') : 'none'}`,
      `- Duration: ${duration}ms`,
      '',
    ]
    
    const logContent = lines.join('\n')
    
    try {
      await fs.appendFile(this.logPath, logContent, 'utf-8')
    } catch {
      await fs.writeFile(this.logPath, logContent, 'utf-8')
    }
  }

  shouldRebuildFull(plan: GraphUpdatePlan): boolean {
    const totalChanges = 
      plan.addedNodes.length + 
      plan.updatedNodes.length + 
      plan.deletedNodes.length
    
    if (totalChanges === 0) return false
    
    const totalFiles = this.cache?.files.size || 1
    const deletedRatio = plan.deletedNodes.length / totalFiles
    
    if (deletedRatio > 0.3) return true
    
    if (plan.deletedNodes.length > 20) return true
    
    if (totalChanges > 100) return true
    
    return false
  }

  canIncrementalUpdate(plan: GraphUpdatePlan): boolean {
    return !this.shouldRebuildFull(plan)
  }

  getCache(): GraphCache | null {
    return this.cache
  }

  getCacheStats(): { totalFiles: number; lastUpdated: string } {
    return {
      totalFiles: this.cache?.files.size || 0,
      lastUpdated: this.cache?.lastUpdated || 'never',
    }
  }
}
