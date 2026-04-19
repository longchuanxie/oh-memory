import path from 'path'
import { promises as fs } from 'fs'
import crypto from 'crypto'
import matter from 'gray-matter'

import { Logger } from '../utils/logger.js'

import { 
  ensureDir, 
  fileExists, 
  readMarkdownFile, 
  writeMarkdownFile,
  listFiles,
  shouldIgnore,
  matchesPatterns,
  isGitRepository,
  isFileInGit,
  getGitTrackedFiles,
} from '../utils/file-utils.js'
import { exportToJSON } from '../utils/graph-utils.js'
import { GraphUpdater } from './graph-updater.js'
import { IngestOrchestrator } from './ingest-orchestrator.js'
import { ProjectAnalyzer } from './project-analyzer.js'
import { SensitiveDataFilter } from '../utils/sensitive-filter.js'
import { GlobalCacheManager, getGlobalCacheManager } from './global-cache-manager.js'
import { GraphCache } from './graph-cache.js'
import { IncrementalIndexer } from './incremental-indexer.js'
import { AutoTagger } from './auto-tagger.js'
import { CacheCoordinator } from './cache-coordinator.js'
import { LinkIndexManager } from './link-index.js'
import { ContentClassifier } from './content-classifier.js'
import { PathMapper } from './path-mapper.js'
import { GraphBuilder } from './graph-builder.js'
import { IndexManager } from './index-manager.js'
import { QueryEngine } from './query-engine.js'
import { ContentExtractor } from './content-extractor.js'
import { ContentSearcher } from './content-searcher.js'
import { DocGenerator } from './doc-generator.js'
import { PageProcessor } from './page-processor.js'
import { GraphIndexBuilder } from './graph-index-builder.js'
import type { 
  KnowledgeGraph, 
  KnowledgePage, 
  PageFrontmatter,
  IngestResult,
  QueryResult,
  QueryOptions,
  ConnectionStats,
  SourceInfo,
  Relations,
  ContentSummary,
  GraphUpdatePlan,
  IngestOptions,
  ProjectArchitecture,
  CodeStyle,
  PageData,
  DirectoryNode,
  ContentSearchResult,
  ContentSearchPageResult,
  ContentSearchMatch,
} from '../types/index.js'

export class KnowledgeBase {
  private basePath: string
  private projectPath: string
  private graph: KnowledgeGraph | null = null
  private updater: GraphUpdater
  private orchestrator: IngestOrchestrator
  private analyzer: ProjectAnalyzer
  private sensitiveFilter: SensitiveDataFilter
  private globalCache: GlobalCacheManager
  private graphCache: GraphCache
  private incrementalIndexer: IncrementalIndexer
  private cacheCoordinator: CacheCoordinator
  private autoTagger: AutoTagger
  private linkIndex: LinkIndexManager
  private classifier: ContentClassifier
  private pathMapper: PathMapper
  private graphBuilder: GraphBuilder
  private indexManager: IndexManager
  private queryEngine: QueryEngine
  private contentExtractor: ContentExtractor
  private contentSearcher: ContentSearcher
  private docGenerator: DocGenerator
  private pageProcessor: PageProcessor
  private graphIndexBuilder: GraphIndexBuilder
  private logger = Logger.getInstance()

  constructor(projectPath: string) {
    this.projectPath = projectPath
    this.basePath = path.join(projectPath, '.memory')
    this.updater = new GraphUpdater(this.basePath)
    this.orchestrator = new IngestOrchestrator(this.basePath)
    this.analyzer = new ProjectAnalyzer(projectPath, this.basePath)
    this.sensitiveFilter = new SensitiveDataFilter()
    this.globalCache = getGlobalCacheManager()
    this.graphCache = new GraphCache(this.basePath)
    this.incrementalIndexer = new IncrementalIndexer(this.basePath)
    this.cacheCoordinator = new CacheCoordinator(this.basePath)
    this.autoTagger = new AutoTagger()
    this.linkIndex = new LinkIndexManager()
    this.classifier = new ContentClassifier()
    this.pathMapper = new PathMapper()
    this.graphBuilder = new GraphBuilder()
    this.indexManager = new IndexManager(this.basePath)
    this.queryEngine = new QueryEngine()
    this.contentExtractor = new ContentExtractor()
    this.contentSearcher = new ContentSearcher()
    this.docGenerator = new DocGenerator(this.basePath)
    this.pageProcessor = new PageProcessor(this.sensitiveFilter)
    this.graphIndexBuilder = new GraphIndexBuilder()
  }

  async initialize(): Promise<void> {
    await this.globalCache.initialize(this.projectPath, this.basePath)
    
    const dirs = [
      'entities',
      'concepts',
      'sources',
      'synthesis',
      'pending',
    ]

    for (const dir of dirs) {
      await ensureDir(path.join(this.basePath, dir))
    }

    if (!await fileExists(path.join(this.basePath, 'index.md'))) {
      await this.createIndex()
    }

    if (!await fileExists(path.join(this.basePath, 'log.md'))) {
      await this.createLog()
    }

    if (!await fileExists(path.join(this.basePath, 'SCHEMA.md'))) {
      await this.createSchema()
    }

    await this.updater.initialize()
    
    const needsAnalysis = await this.analyzer.needsReanalysis()
    if (needsAnalysis) {
      await this.analyzeAndGenerateDocs()
    }
    
    await this.buildGraphIndex()
  }

  async analyzeAndGenerateDocs(): Promise<void> {
    this.logger.info('Analyzing project structure')
    
    const architecture = await this.analyzer.analyze()
    const codeStyles = await this.analyzer.analyzeCodeStyle()
    
    this.orchestrator.setStructureScore(architecture.structureScore)
    this.orchestrator.setModules(architecture.modules)
    
    await this.docGenerator.generateArchitectureDoc(architecture)
    await this.docGenerator.generateCodeStyleDoc(codeStyles)
    
    this.logger.info('Project analysis complete', {
      score: architecture.structureScore.total,
      level: architecture.structureScore.level
    })
  }

  private async createIndex(): Promise<void> {
    const frontmatter: PageFrontmatter = {
      id: 'index',
      title: 'Knowledge Base Index',
      type: 'synthesis',
      tags: ['index'],
      date: new Date().toISOString().split('T')[0],
      updated: new Date().toISOString().split('T')[0],
      description: 'Directory of all knowledge pages',
    }

    const content = `# Knowledge Base Index

This is the main index of the knowledge base.

## Entities
- Modules, functions, classes, and other code entities

## Concepts
- Architecture patterns, design decisions, and workflows

## Sources
- Summaries of source documents and files

## Synthesis
- Comprehensive analyses and cross-cutting topics

## Statistics
- Total pages: 0
- Last updated: ${new Date().toISOString()}
`

    await writeMarkdownFile(
      path.join(this.basePath, 'index.md'),
      frontmatter,
      content
    )
  }

  private async createLog(): Promise<void> {
    const frontmatter: PageFrontmatter = {
      id: 'log',
      title: 'Knowledge Base Log',
      type: 'synthesis',
      tags: ['log'],
      date: new Date().toISOString().split('T')[0],
      updated: new Date().toISOString().split('T')[0],
      description: 'Chronological log of knowledge base operations',
    }

    const content = `# Knowledge Base Log

This file records all operations on the knowledge base.

## [${new Date().toISOString().split('T')[0]}] Initialization
- Created knowledge base structure
- Generated default configuration
`

    await writeMarkdownFile(
      path.join(this.basePath, 'log.md'),
      frontmatter,
      content
    )
  }

  private async createSchema(): Promise<void> {
    const schemaContent = `# Knowledge Base Schema

This document defines the structure and conventions for the knowledge base.

## Page Types

### Entity Pages
- **Location**: \`entities/\`
- **Purpose**: Document code entities (modules, functions, classes)
- **Required Fields**: title, type, tags, date
- **Optional Fields**: source, description

### Concept Pages
- **Location**: \`concepts/\`
- **Purpose**: Document architectural concepts, patterns, decisions
- **Required Fields**: title, type, tags, date
- **Optional Fields**: description

### Source Pages
- **Location**: \`sources/\`
- **Purpose**: Summarize source documents and files
- **Required Fields**: title, type, tags, date, source
- **Optional Fields**: description

### Synthesis Pages
- **Location**: \`synthesis/\`
- **Purpose**: Comprehensive analyses and cross-cutting topics
- **Required Fields**: title, type, tags, date
- **Optional Fields**: description

## Linking Conventions

Use double bracket syntax for internal links:
- \`[[page-name]]\` - Link to another page
- \`[[page-name|display text]]\` - Link with custom text

## Tagging Guidelines

- Use lowercase tags
- Use hyphens for multi-word tags
- Examples: authentication, api-design, database

## Update Workflow

1. Ingest new sources
2. Generate/update knowledge pages
3. Validate links and consistency
4. Update index and graph
5. Log changes
`

    await fs.writeFile(
      path.join(this.basePath, 'SCHEMA.md'),
      schemaContent,
      'utf-8'
    )
  }

  async ingestFiles(
    files: string[],
    options: IngestOptions = {}
  ): Promise<IngestResult> {
    const projectDir = path.dirname(this.basePath)
    const isGitRepo = await isGitRepository(projectDir)

    if (isGitRepo && !options.includeUntracked) {
      const gitTrackedFiles = await getGitTrackedFiles(projectDir)
      
      const requestedAbsolutePaths = files.map(f => path.resolve(projectDir, f))
      const trackedAbsolutePaths = gitTrackedFiles.map(f => path.resolve(projectDir, f))
      
      const filesToProcess = requestedAbsolutePaths.filter(requestedPath => {
        const isDirectory = !path.extname(requestedPath)
        
        if (isDirectory) {
          const hasTrackedFiles = trackedAbsolutePaths.some(trackedPath => 
            trackedPath.startsWith(requestedPath + path.sep) || trackedPath === requestedPath
          )
          return hasTrackedFiles
        } else {
          return trackedAbsolutePaths.includes(requestedPath)
        }
      })

      const expandedFiles: string[] = []
      for (const file of filesToProcess) {
        const relativePath = path.relative(projectDir, file)
        
        if (!path.extname(file)) {
          const dirFiles = gitTrackedFiles.filter(trackedFile => 
            trackedFile.startsWith(relativePath + path.sep) || trackedFile === relativePath
          )
          expandedFiles.push(...dirFiles)
        } else {
          expandedFiles.push(file)
        }
      }

      files = expandedFiles
    }

    const filteredFiles = files.filter(file => {
      if (shouldIgnore(file)) {
        return false
      }
      
      if (!matchesPatterns(file, [])) {
        return false
      }
      
      return true
    })

    const result = await this.orchestrator.processFiles(
      filteredFiles,
      (file) => this.processFile(file),
      options
    )

    this.cacheCoordinator.clearAllCaches()
    this.globalCache.invalidateCache('graph')
    
    await this.buildGraphIndex()
    await this.updateIndex()
    await this.appendLog('ingest', `Processed ${result.processedFiles} files`)

    return result
  }

  private async processFile(filePath: string): Promise<string | null> {
    const ext = path.extname(filePath)
    
    if (this.pageProcessor.isIgnoredFile(filePath)) {
      return null
    }

    if (!this.pageProcessor.isSupportedFile(filePath)) {
      return null
    }

    const content = await fs.readFile(filePath, 'utf-8')
    
    const filterResult = this.pageProcessor.filterSensitiveContent(content, filePath)
    
    let processedContent = content
    if (filterResult.warnings > 0) {
      this.logger.info('Filtered sensitive items', {
        count: filterResult.warnings,
        file: filePath
      })
      processedContent = filterResult.content
    }
    
    const relativePath = path.relative(path.dirname(this.basePath), filePath)
    const classification = this.classifier.classify(filePath, processedContent)
    const pageType = classification.category
    const knowledgePath = this.pathMapper.mapToKnowledgePath(relativePath, pageType)
    const stats = await fs.stat(filePath)
    
    const sourceInfo: SourceInfo = {
      path: relativePath,
      hash: this.contentExtractor.calculateHash(content),
      lastModified: stats.mtime.toISOString().split('T')[0],
      lines: processedContent.split('\n').length,
      language: this.contentExtractor.getLanguage(ext),
    }
    
    const summary: ContentSummary = {
      description: this.contentExtractor.generateDescription(processedContent),
      keywords: this.contentExtractor.extractKeywords(processedContent, ext),
      keyFunctions: this.contentExtractor.extractKeyFunctions(processedContent, ext),
    }
    
    const relations: Relations = {
      dependsOn: this.contentExtractor.extractDependencies(processedContent, ext),
      usedBy: [],
      relatedTo: [],
    }
    
    const manualTags = this.contentExtractor.extractTags(processedContent, ext)
    const imports = this.contentExtractor.extractImports(processedContent, ext)
    const functions = this.contentExtractor.extractFunctions(processedContent, ext)
    const autoTagResult = this.autoTagger.generateTags(filePath, processedContent, {
      imports,
      functions,
      techStack: []
    })
    const combinedTags = [...new Set([...manualTags, ...autoTagResult.tags])].slice(0, 10)
    
    const frontmatter: PageFrontmatter = {
      id: knowledgePath.fullPath,
      title: knowledgePath.name,
      type: pageType,
      tags: combinedTags,
      date: new Date().toISOString().split('T')[0],
      updated: new Date().toISOString().split('T')[0],
      source: sourceInfo,
      summary,
      relations,
      importance: this.contentExtractor.determineImportance(processedContent, ext),
      status: 'active',
      category: this.contentExtractor.extractCategory(filePath),
      module: this.contentExtractor.extractModule(filePath),
      layer: this.contentExtractor.extractLayer(filePath),
    }

    const pageContent = this.pageProcessor.generatePageContent(processedContent, filePath)
    
    const pageFilePath = path.join(
      this.basePath,
      this.pathMapper.generateFilePath(knowledgePath)
    )
    
    await ensureDir(path.dirname(pageFilePath))
    await writeMarkdownFile(pageFilePath, frontmatter, pageContent)

    return knowledgePath.fullPath
  }

  async query(query: string, options?: QueryOptions): Promise<QueryResult> {
    const queryStart = Date.now()
    
    const cacheKey = `query:${query}:${options?.type || 'all'}:${options?.limit || 10}`
    const cachedResult = this.cacheCoordinator.getQueryCache().get(cacheKey)
    if (cachedResult) {
      this.logger.info('Query result from cache')
      return cachedResult
    }
    
    const globalCachedGraph = this.globalCache.getMemoryCache<KnowledgeGraph>('graph')
    if (globalCachedGraph) {
      this.graph = globalCachedGraph
    }
    
    if (!this.graph) {
      const loadedGraph = await this.cacheCoordinator.loadGraphCache()
      if (loadedGraph) {
        this.graph = loadedGraph
      } else {
        await this.buildGraphIndex()
      }
    } else {
      const isValid = await this.cacheCoordinator.isGraphCacheValid()
      if (!isValid) {
        await this.buildGraphIndex()
      }
    }

    const results: QueryResult = {
      query,
      answer: '',
      sources: [],
      relatedPages: [],
    }

    if (!this.graph) {
      return results
    }

    // Use QueryEngine for search
    const searchResults = this.queryEngine.search(
      this.graph,
      query,
      {
        type: options?.type || 'all',
        limit: options?.limit || 10
      }
    )
    
    if (searchResults.length === 0) {
      return results
    }
    
    results.relatedPages = searchResults.map(item => item.id)
    results.sources = searchResults.slice(0, 5).map(item => item.id)

    if (options?.includeSummaries && results.relatedPages.length > 0) {
      const maxSummaryLength = options?.maxSummaryLength || 500
      const summaries = await Promise.all(
        results.relatedPages.map(pageId => this.getPageSummary(pageId, maxSummaryLength))
      )
      results.pageSummaries = summaries.filter(s => s !== null)
    }

    const duration = Date.now() - queryStart
    if (duration > 100) {
      this.logger.info('Query completed', {
        query: query.substring(0, 30) + (query.length > 30 ? '...' : ''),
        duration,
        results: results.relatedPages.length
      })
    }
    
    this.cacheCoordinator.getQueryCache().set(cacheKey, results)

    return results
  }

  private async buildGraphIndex(): Promise<void> {
    const startTime = Date.now()
    
    await this.graphCache.loadHashCache()
    this.incrementalIndexer.setFileHashes(this.graphCache.getFileHashes())
    
    const changes = await this.incrementalIndexer.detectChanges()
    const hasChanges = changes.some(c => c.status !== 'unchanged')
    
    if (!hasChanges) {
      const cachedGraph = await this.graphCache.loadGraph()
      if (cachedGraph) {
        this.graph = cachedGraph
        this.globalCache.setMemoryCache('graph', cachedGraph)
        return
      }
    }
    
    // Use GraphIndexBuilder to load pages
    const pages = await this.graphIndexBuilder.loadPagesFromDirectory(this.basePath)
    
    // Process batches to calculate hashes and update cache
    const fileHashes = new Map<string, { hash: string; lastModified: string; pageId: string }>()
    
    const categories = ['entities', 'concepts', 'sources', 'synthesis']
    const allFiles: Array<{ category: string; path: string }> = []
    
    for (const category of categories) {
      const categoryPath = path.join(this.basePath, category)
      
      if (!await fileExists(categoryPath)) {
        continue
      }

      const files = await listFiles(categoryPath, ['.md'])
      for (const file of files) {
        allFiles.push({ category, path: file })
      }
    }
    
    const batches = this.graphIndexBuilder.chunkArray(allFiles, 10)
    
    for (const batch of batches) {
      const results = await this.graphIndexBuilder.processBatch(batch)
      
      for (const result of results) {
        const pageId = path.basename(result.filePath, '.md')
        
        fileHashes.set(result.filePath, {
          hash: result.hash,
          lastModified: result.stats.mtime.toISOString(),
          pageId,
        })
        
        this.graphCache.updateFileHash(result.filePath, result.hash)
      }
    }

    const updatePlan = await this.updater.detectChanges(fileHashes)
    const shouldRebuild = this.updater.shouldRebuildFull(updatePlan)
    
    if (!shouldRebuild && updatePlan.addedNodes.length === 0 && 
        updatePlan.updatedNodes.length === 0 && updatePlan.deletedNodes.length === 0) {
      return
    }

    if (!shouldRebuild && updatePlan.deletedNodes.length > 0) {
      await this.handleDeletedNodes(updatePlan.deletedNodes)
    }

    // Use GraphIndexBuilder to build graph
    const buildResult = await this.graphIndexBuilder.build(pages)
    this.graph = buildResult.graph
    
    const connectionStats = this.graphBuilder.calculateConnectionStats(pages)
    
    const hasChangesToWrite = updatePlan.addedNodes.length > 0 || updatePlan.updatedNodes.length > 0
    
    if (hasChangesToWrite) {
      await this.updatePagesWithConnectionStats(pages, connectionStats)
    }
    
    await this.graphCache.saveGraph(this.graph)
    await this.graphCache.saveHashCache()
    this.globalCache.setMemoryCache('graph', this.graph)
    
    await fs.writeFile(
      path.join(this.basePath, 'graph.json'),
      exportToJSON(this.graph),
      'utf-8'
    )
    
    await this.generateGraphIndexes(pages, connectionStats, {
      updateRelations: hasChangesToWrite,
      generateIndexes: hasChangesToWrite,
    })
    
    await this.updater.updateCache(fileHashes)
    
    const duration = Date.now() - startTime
    await this.updater.appendUpdateLog(updatePlan, duration)
    
    if (duration > 500) {
      this.logger.info('Graph build completed', {
        duration,
        pages: pages.size,
        nodes: this.graph?.nodes.length ?? 0
      })
    }
  }

  private async handleDeletedNodes(deletedNodes: string[]): Promise<void> {
    const categories = ['entities', 'concepts', 'sources', 'synthesis']
    
    for (const nodeId of deletedNodes) {
      for (const category of categories) {
        const pagePath = path.join(this.basePath, category, `${nodeId}.md`)
        try {
          await fs.unlink(pagePath)
          this.logger.info('Deleted page', { pagePath })
        } catch {
          // ignore if file doesn't exist
        }
      }
    }
  }

  private async updatePagesWithConnectionStats(
    pages: Map<string, PageData>,
    connectionStats: Map<string, ConnectionStats>
  ): Promise<void> {
    for (const [pageId, page] of pages) {
      const stats = connectionStats.get(pageId)
      if (stats && page.filePath) {
        const existingPage = await readMarkdownFile(page.filePath)
        if (existingPage) {
          existingPage.frontmatter.connections = stats
          existingPage.frontmatter.updated = new Date().toISOString().split('T')[0]
          await writeMarkdownFile(page.filePath, existingPage.frontmatter, existingPage.content)
        }
      }
    }
  }

  private async generateGraphIndexes(
    pages: Map<string, PageData>,
    connectionStats: Map<string, ConnectionStats>,
    options: { 
      updateRelations: boolean
      generateIndexes: boolean
    } = { updateRelations: true, generateIndexes: true }
  ): Promise<void> {
    if (options.updateRelations) {
      await this.populateReverseRelations(pages)
    }
    if (options.generateIndexes) {
      // Use IndexManager for index generation
      await this.indexManager.generateMainIndex(pages, connectionStats, this.graph!)
      await this.indexManager.generateLayerIndexes(pages, connectionStats)
      await this.generateDOTFile(pages, connectionStats)
      await this.generateInteractiveHTML(pages, connectionStats)
    }
  }

  private async populateReverseRelations(pages: Map<string, PageData>): Promise<void> {
    const usedByMap = new Map<string, string[]>()
    const relatedToMap = new Map<string, string[]>()
    
    for (const [pageId, page] of pages) {
      const dependsOn = page.metadata?.relations?.dependsOn || []
      
      for (const dep of dependsOn) {
        if (!usedByMap.has(dep)) {
          usedByMap.set(dep, [])
        }
        if (!usedByMap.get(dep)!.includes(pageId)) {
          usedByMap.get(dep)!.push(pageId)
        }
      }
      
      const links = page.links || []
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
    
    for (const [pageId, page] of pages) {
      const usedBy = usedByMap.get(pageId) || []
      const relatedTo = relatedToMap.get(pageId) || []
      
      if (usedBy.length > 0 || relatedTo.length > 0) {
        if (!page.metadata.relations) {
          page.metadata.relations = { dependsOn: [], usedBy: [], relatedTo: [] }
        }
        
        page.metadata.relations.usedBy = usedBy
        page.metadata.relations.relatedTo = relatedTo
        
        if (page.filePath) {
          try {
            const content = await fs.readFile(page.filePath, 'utf-8')
            const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, '')
            await writeMarkdownFile(page.filePath, page.metadata, contentWithoutFrontmatter)
          } catch {
            // ignore
          }
        }
      }
    }
  }

  private async generateDOTFile(
    pages: Map<string, PageData>,
    connectionStats: Map<string, ConnectionStats>
  ): Promise<void> {
    const lines: string[] = [
      'digraph KnowledgeGraph {',
      '  rankdir=TB;',
      '  node [shape=box, style=filled];',
      '  graph [compound=true];',
      ''
    ]
    
    const types = ['entity', 'concept', 'source', 'synthesis'] as const
    const colors = {
      entity: 'lightblue',
      concept: 'lightgreen',
      source: 'lightyellow',
      synthesis: 'lightpink'
    }
    
    for (const type of types) {
      const typePages = [...pages.entries()].filter(([, p]) => p.metadata.type === type)
      if (typePages.length === 0) continue
      
      lines.push(`  subgraph cluster_${type}s {`)
      lines.push(`    label="${type.charAt(0).toUpperCase() + type.slice(1)}s";`)
      lines.push('    style=filled;')
      lines.push(`    color="${colors[type]}";`)
      lines.push('')
      
      for (const [id, page] of typePages) {
        const label = (page.metadata.title || id).replace(/"/g, "'")
        lines.push(`    ${id.replace(/-/g, '_')} [label="${label}", fillcolor="${colors[type]}"];`)
      }
      
      lines.push('  }')
      lines.push('')
    }
    
    for (const edge of this.graph?.edges || []) {
      const fromId = edge.from.replace(/-/g, '_')
      const toId = edge.to.replace(/-/g, '_')
      lines.push(`  ${fromId} -> ${toId};`)
    }
    
    lines.push('}')
    
    await fs.writeFile(
      path.join(this.basePath, 'graph.dot'),
      lines.join('\n'),
      'utf-8'
    )
  }

  private async generateInteractiveHTML(
    pages: Map<string, PageData>,
    connectionStats: Map<string, ConnectionStats>
  ): Promise<void> {
    const nodesData = [...pages.entries()].map(([id, page]) => ({
      id,
      title: page.metadata.title || id,
      type: page.metadata.type || 'entity',
      connections: connectionStats.get(id)?.total || 0,
      description: page.metadata.summary?.description || page.metadata.description || ''
    }))
    
    const edgesData = this.graph?.edges.map(e => ({
      from: e.from,
      to: e.to
    })) || []
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Knowledge Graph Visualization</title>
  <script src="https://cdn.jsdelivr.net/npm/viz.js@2.1.2/viz.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/viz.js@2.1.2/full.render.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background: #f5f5f5;
      display: flex;
      height: 100vh;
    }
    #sidebar {
      width: 300px;
      background: white;
      padding: 20px;
      overflow-y: auto;
      border-right: 1px solid #ddd;
    }
    #main {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    #toolbar {
      padding: 10px 20px;
      background: white;
      border-bottom: 1px solid #ddd;
      display: flex;
      gap: 10px;
      align-items: center;
    }
    #search {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    #graph-container {
      flex: 1;
      overflow: auto;
      background: white;
      padding: 20px;
    }
    #graph {
      transform-origin: top left;
    }
    h1 { margin: 0 0 20px 0; font-size: 20px; }
    h2 { margin: 20px 0 10px 0; font-size: 16px; color: #666; }
    .node-list { list-style: none; padding: 0; margin: 0; }
    .node-item {
      padding: 8px;
      cursor: pointer;
      border-radius: 4px;
      margin-bottom: 4px;
    }
    .node-item:hover { background: #f0f0f0; }
    .node-item.active { background: #e3f2fd; }
    .node-type {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      margin-right: 6px;
    }
    .type-entity { background: #bbdefb; }
    .type-concept { background: #c8e6c9; }
    .type-source { background: #fff9c4; }
    .type-synthesis { background: #f8bbd9; }
    .connections { color: #666; font-size: 12px; }
    button {
      padding: 8px 16px;
      border: 1px solid #ddd;
      background: white;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover { background: #f5f5f5; }
    select {
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div id="sidebar">
    <h1>Knowledge Graph</h1>
    <h2>Statistics</h2>
    <p>Total Nodes: ${nodesData.length}</p>
    <p>Total Edges: ${edgesData.length}</p>
    <h2>Nodes</h2>
    <ul class="node-list" id="node-list"></ul>
  </div>
  <div id="main">
    <div id="toolbar">
      <input type="text" id="search" placeholder="Search nodes...">
      <select id="filter-type">
        <option value="all">All Types</option>
        <option value="entity">Entities</option>
        <option value="concept">Concepts</option>
        <option value="source">Sources</option>
        <option value="synthesis">Synthesis</option>
      </select>
      <button id="zoom-in">Zoom In</button>
      <button id="zoom-out">Zoom Out</button>
      <button id="reset">Reset</button>
    </div>
    <div id="graph-container">
      <div id="graph"></div>
    </div>
  </div>
  <script>
    const nodes = ${JSON.stringify(nodesData)};
    const edges = ${JSON.stringify(edgesData)};
    let scale = 1;
    
    function renderNodeList(filter = 'all', search = '') {
      const list = document.getElementById('node-list');
      const filtered = nodes.filter(n => {
        const matchType = filter === 'all' || n.type === filter;
        const matchSearch = !search || n.title.toLowerCase().includes(search.toLowerCase());
        return matchType && matchSearch;
      });
      
      list.innerHTML = filtered.map(n => 
        '<li class="node-item" data-id="' + n.id + '">' +
        '<span class="node-type type-' + n.type + '">' + n.type + '</span>' +
        n.title +
        '<span class="connections"> (' + n.connections + ')</span>' +
        '</li>'
      ).join('');
      
      list.querySelectorAll('.node-item').forEach(item => {
        item.addEventListener('click', () => highlightNode(item.dataset.id));
      });
    }
    
    function highlightNode(id) {
      document.querySelectorAll('.node-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id === id);
      });
    }
    
    function generateDOT(filter = 'all', search = '') {
      const filtered = nodes.filter(n => {
        const matchType = filter === 'all' || n.type === filter;
        const matchSearch = !search || n.title.toLowerCase().includes(search.toLowerCase());
        return matchType && matchSearch;
      });
      
      const filteredIds = new Set(filtered.map(n => n.id));
      const colors = {
        entity: 'lightblue',
        concept: 'lightgreen',
        source: 'lightyellow',
        synthesis: 'lightpink'
      };
      
      let dot = 'digraph { rankdir=TB; node [shape=box, style=filled]; ';
      
      filtered.forEach(n => {
        const safeId = n.id.replace(/-/g, '_');
        dot += safeId + ' [label="' + n.title + '", fillcolor="' + colors[n.type] + '"]; ';
      });
      
      edges.forEach(e => {
        if (filteredIds.has(e.from) && filteredIds.has(e.to)) {
          dot += e.from.replace(/-/g, '_') + ' -> ' + e.to.replace(/-/g, '_') + '; ';
        }
      });
      
      dot += '}';
      return dot;
    }
    
    async function renderGraph() {
      const filter = document.getElementById('filter-type').value;
      const search = document.getElementById('search').value;
      const dot = generateDOT(filter, search);
      
      const viz = new Viz();
      try {
        const svg = await viz.renderSVGElement(dot);
        const container = document.getElementById('graph');
        container.innerHTML = '';
        container.appendChild(svg);
        container.style.transform = 'scale(' + scale + ')';
      } catch (e) {
        console.error(e);
      }
    }
    
    document.getElementById('search').addEventListener('input', () => {
      const filter = document.getElementById('filter-type').value;
      const search = document.getElementById('search').value;
      renderNodeList(filter, search);
      renderGraph();
    });
    
    document.getElementById('filter-type').addEventListener('change', () => {
      const filter = document.getElementById('filter-type').value;
      const search = document.getElementById('search').value;
      renderNodeList(filter, search);
      renderGraph();
    });
    
    document.getElementById('zoom-in').addEventListener('click', () => {
      scale *= 1.2;
      document.getElementById('graph').style.transform = 'scale(' + scale + ')';
    });
    
    document.getElementById('zoom-out').addEventListener('click', () => {
      scale /= 1.2;
      document.getElementById('graph').style.transform = 'scale(' + scale + ')';
    });
    
    document.getElementById('reset').addEventListener('click', () => {
      scale = 1;
      document.getElementById('graph').style.transform = 'scale(1)';
      document.getElementById('search').value = '';
      document.getElementById('filter-type').value = 'all';
      renderNodeList();
      renderGraph();
    });
    
    renderNodeList();
    renderGraph();
  </script>
</body>
</html>`

    await fs.writeFile(
      path.join(this.basePath, 'graph.html'),
      html,
      'utf-8'
    )
  }

  private async updateIndex(): Promise<void> {
    if (!this.graph) {
      return
    }

    const indexContent = `# Knowledge Base Index

This is the main index of the knowledge base.

## Statistics
- Total pages: ${this.graph.nodes.length}
- Total links: ${this.graph.edges.length}
- Last updated: ${new Date().toISOString()}

## Entities (${this.graph.nodes.filter(n => n.type === 'entity').length})
${this.graph.nodes.filter(n => n.type === 'entity').map(n => `- [[${n.id}|${n.title}]]`).join('\n')}

## Concepts (${this.graph.nodes.filter(n => n.type === 'concept').length})
${this.graph.nodes.filter(n => n.type === 'concept').map(n => `- [[${n.id}|${n.title}]]`).join('\n')}

## Sources (${this.graph.nodes.filter(n => n.type === 'source').length})
${this.graph.nodes.filter(n => n.type === 'source').map(n => `- [[${n.id}|${n.title}]]`).join('\n')}

## Synthesis (${this.graph.nodes.filter(n => n.type === 'synthesis').length})
${this.graph.nodes.filter(n => n.type === 'synthesis').map(n => `- [[${n.id}|${n.title}]]`).join('\n')}
`

    const indexPath = path.join(this.basePath, 'index.md')
    const indexPage = await readMarkdownFile(indexPath)
    
    if (indexPage) {
      await writeMarkdownFile(indexPath, indexPage.frontmatter, indexContent)
    }
  }

  private async appendLog(operation: string, message: string): Promise<void> {
    const logPath = path.join(this.basePath, 'log.md')
    const logPage = await readMarkdownFile(logPath)
    
    if (logPage) {
      const timestamp = new Date().toISOString()
      const newEntry = `\n## [${timestamp.split('T')[0]}] ${operation}\n${message}\n`
      
      await writeMarkdownFile(
        logPath,
        logPage.frontmatter,
        logPage.content + newEntry
      )
    }
  }

  getGraph(): KnowledgeGraph | null {
    return this.graph
  }

  getBasePath(): string {
    return this.basePath
  }

  async getPageSummary(pageId: string, maxLength: number = 500): Promise<{
    id: string
    title: string
    tags: string[]
    summary: string
  } | null> {
    try {
      const categories = ['entities', 'concepts', 'sources', 'synthesis']
      
      for (const category of categories) {
        const filePath = path.join(this.basePath, category, `${pageId}.md`)
        if (!await fileExists(filePath)) continue
        
        const content = await fs.readFile(filePath, 'utf-8')
        const { data: frontmatter, content: markdownContent } = matter(content)
        
        const title = frontmatter?.title || pageId
        const tags = frontmatter?.tags || []
        
        const summary = markdownContent.length > maxLength 
          ? markdownContent.substring(0, maxLength) + '...'
          : markdownContent
        
        return { id: pageId, title, tags, summary }
      }
      
      return null
    } catch (error) {
      this.logger.warn('Failed to get page summary', { pageId, error: error instanceof Error ? error.message : String(error) })
      return null
    }
  }

  async previewChanges(files: string[]): Promise<{
    newPages: Array<{ pageId: string; category: string; sourceFile: string }>
    updatedPages: Array<{ pageId: string; filePath: string; sourceFile: string; changeType: string }>
    deletedPages: Array<{ pageId: string; filePath: string }>
    unchangedPages: Array<{ pageId: string; sourceFile: string }>
  }> {
    const result = {
      newPages: [] as Array<{ pageId: string; category: string; sourceFile: string }>,
      updatedPages: [] as Array<{ pageId: string; filePath: string; sourceFile: string; changeType: string }>,
      deletedPages: [] as Array<{ pageId: string; filePath: string }>,
      unchangedPages: [] as Array<{ pageId: string; sourceFile: string }>,
    }
    
    for (const file of files) {
      if (!await fileExists(file)) continue
        
        const content = await fs.readFile(file, 'utf-8')
        const classification = this.classifier.classify(file, content)
        const pageId = this.pathMapper.mapToKnowledgePath(
          path.relative(path.dirname(this.basePath), file),
          classification.category
        ).fullPath
        const pageFilePath = path.join(
          this.basePath,
          this.pathMapper.generateFilePath(
            this.pathMapper.parseKnowledgePath(pageId)
          )
        )
        const currentHash = this.contentExtractor.calculateHash(content)
        
        if (await fileExists(pageFilePath)) {
          const pageContent = await fs.readFile(pageFilePath, 'utf-8')
          const { data: frontmatter } = matter(pageContent)
        const existingHash = frontmatter?.source?.hash
        
        if (existingHash !== currentHash) {
          result.updatedPages.push({
            pageId,
            filePath: pageFilePath,
            sourceFile: file,
            changeType: 'content',
          })
        } else {
          result.unchangedPages.push({ pageId, sourceFile: file })
        }
      } else {
        const knowledgePath = this.pathMapper.parseKnowledgePath(pageId)
        result.newPages.push({
          pageId,
          category: knowledgePath.category + 's',
          sourceFile: file,
        })
      }
    }
    
    return result
  }

  async searchContent(query: string, options?: {
    limit?: number
    contextLength?: number
    caseSensitive?: boolean
  }): Promise<ContentSearchResult> {
    const limit = options?.limit || 10
    const contextLength = options?.contextLength || 200
    const caseSensitive = options?.caseSensitive || false

    const results: ContentSearchResult = {
      query,
      matches: [],
    }

    if (!query.trim()) {
      return results
    }

    const categories = ['entities', 'concepts', 'sources', 'synthesis']
    const pages: PageData[] = []

    // 收集所有页面内容
    for (const category of categories) {
      const categoryPath = path.join(this.basePath, category)
      if (!await fileExists(categoryPath)) continue

      const files = await listFiles(categoryPath, ['.md'])

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const { data: frontmatter, content: body } = matter(content)

          pages.push({
            id: path.basename(filePath, '.md'),
            metadata: {
              id: path.basename(filePath, '.md'),
              title: frontmatter?.title || path.basename(filePath, '.md'),
              type: frontmatter?.type || 'entity',
              date: frontmatter?.date || new Date().toISOString(),
              updated: frontmatter?.updated || new Date().toISOString(),
              tags: frontmatter?.tags || [],
              category
            },
            content: body,
            links: []
          })
        } catch {
          continue
        }
      }
    }

    // 使用ContentSearcher进行搜索
    const searchResults = await this.contentSearcher.searchContent(pages, query, {
      limit,
      contextLines: 2,
      caseSensitive,
      maxContextLength: contextLength
    })

    results.matches = searchResults

    return results
  }

}
