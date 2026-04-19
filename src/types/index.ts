export interface KnowledgeNode {
  id: string
  title: string
  path: string
  type: 'entity' | 'concept' | 'source' | 'synthesis'
  tags: string[]
  lastUpdated: string
  description?: string
  sourceLocations?: SourceLocation[]
  primarySource?: string
}

export interface SourceLocation {
  path: string
  line?: number
  column?: number
  endLine?: number
  endColumn?: number
  description?: string
}

export interface KnowledgeEdge {
  from: string
  to: string
  type: 'uses' | 'implements' | 'references' | 'relates-to'
  context?: string
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
}

export interface PageFrontmatter {
  // 必需字段
  id: string
  title: string
  type: 'entity' | 'concept' | 'source' | 'synthesis'
  date: string
  updated: string
  
  // 索引相关字段
  connections?: ConnectionStats
  category?: string
  module?: string
  layer?: string
  tags: string[]
  importance?: Importance
  status?: Status
  
  // 源文件信息
  source?: SourceInfo
  
  // 关系信息
  relations?: Relations
  
  // 内容摘要
  summary?: ContentSummary
  
  // 兼容旧字段
  description?: string
}

export interface ConnectionStats {
  inbound: number
  outbound: number
  total: number
}

export interface SourceInfo {
  path: string
  hash: string
  lastModified: string
  lines: number
  language: string
}

export interface Relations {
  dependsOn: string[]
  usedBy: string[]
  relatedTo: string[]
}

export interface ContentSummary {
  description: string
  keywords: string[]
  keyFunctions?: string[]
}

export type Importance = 'low' | 'medium' | 'high' | 'critical'
export type Status = 'active' | 'deprecated' | 'draft'

export interface KnowledgePage {
  frontmatter: PageFrontmatter
  content: string
  links: string[]
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  type: 'format' | 'link' | 'content'
  message: string
  file: string
  line?: number
}

export interface ValidationWarning {
  type: 'orphan' | 'missing-ref' | 'outdated'
  message: string
  file: string
}

export interface IngestResult {
  success: boolean
  processedFiles: number
  createdPages: string[]
  updatedPages: string[]
  errors: string[]
}

export interface QueryOptions {
  type?: 'entity' | 'concept' | 'source' | 'synthesis' | 'all'
  limit?: number
  includeSummaries?: boolean
  maxSummaryLength?: number
}

export interface QueryResult {
  query: string
  answer: string
  sources: string[]
  relatedPages: string[]
  pageSummaries?: Array<{
    id: string
    title: string
    tags: string[]
    summary: string
  }>
}

export interface LintResult {
  valid: boolean
  issues: LintIssue[]
  fixed: number
}

export interface LintIssue {
  type: 'broken-link' | 'orphan-page' | 'missing-cross-ref' | 'contradiction'
  severity: 'error' | 'warning'
  message: string
  file: string
  suggestion?: string
}

export interface EvolutionConfig {
  enabled: boolean
  watchPatterns: string[]
  ignorePatterns: string[]
  updateThreshold: number
  scheduleTime: 'daily' | 'weekly' | 'manual'
  requireApproval: boolean
}

/**
 * Page data structure for graph building
 * Contains metadata, links, and file path information
 */
export interface PageData {
  id?: string
  metadata: PageFrontmatter
  content?: string
  links: string[]
  filePath?: string
}

/**
 * Options for file walking operations
 */
export interface WalkOptions {
  ignorePatterns?: string[]
  maxDepth?: number
  fileExtensions?: string[]
}

/**
 * Parsed frontmatter from markdown files
 */
export interface ParsedFrontmatter {
  id?: string
  title?: string
  type?: 'entity' | 'concept' | 'source' | 'synthesis'
  tags?: string[]
  date?: string
  updated?: string
  source?: {
    path?: string
    line?: number
    column?: number
    description?: string
  }
  sourceLocations?: Array<{
    path: string
    line?: number
    column?: number
    description?: string
  }>
  [key: string]: unknown
}

/**
 * Parsed page structure from markdown files
 */
export interface ParsedPage {
  frontmatter: ParsedFrontmatter
  content: string
}

/**
 * File watcher event input
 */
export interface FileWatcherInput {
  path: string
  type?: string
}

/**
 * File watcher event output
 */
export interface FileWatcherOutput {
  acknowledged?: boolean
  timestamp?: string
}

/**
 * Content search match result
 */
export interface ContentSearchMatch {
  term: string
  context: string
  lineNumber: number
}

/**
 * Content search page result
 */
export interface ContentSearchPageResult {
  pageId: string
  title: string
  category: string
  tags: string[]
  matches: ContentSearchMatch[]
}

/**
 * Content search result
 */
export interface ContentSearchResult {
  query: string
  matches: ContentSearchPageResult[]
}

export interface PluginContext {
  project: unknown
  client: {
    app: {
      log: (params: { body: { service: string; level: string; message: string; extra?: Record<string, unknown> } }) => Promise<void>
    }
  }
  $: unknown
  directory: string
  worktree: string
}

export interface GraphUpdatePlan {
  addedNodes: string[]
  updatedNodes: string[]
  deletedNodes: string[]
  addedEdges: string[]
  deletedEdges: string[]
  affectedLayers: string[]
}

export interface GraphIndexStats {
  totalNodes: number
  totalEdges: number
  entitiesCount: number
  conceptsCount: number
  sourcesCount: number
  synthesisCount: number
  lastUpdated: string
}

export interface ProjectAnalysis {
  totalFiles: number
  totalSize: number
  strategy: 'fast' | 'batch' | 'module'
  batchSize: number
  concurrency: number
}

export interface IngestCheckpoint {
  id: string
  startTime: string
  totalFiles: number
  processedFiles: string[]
  pendingFiles: string[]
  errors: Array<{ file: string; error: string }>
  lastUpdated: string
}

export interface IngestProgress {
  total: number
  processed: number
  percentage: number
  currentFile: string
  elapsed: number
  estimated: number
  speed: number
}

export interface IngestOptions {
  includeUntracked?: boolean
  resume?: boolean
  concurrency?: number
  batchSize?: number
  onProgress?: (progress: IngestProgress) => void
}

export interface StructureScore {
  total: number
  directory: number
  config: number
  organization: number
  documentation: number
  level: 'clear' | 'moderate' | 'messy'
}

export interface DirectoryStructure {
  root: string
  directories: DirectoryNode[]
  maxDepth: number
  totalFiles: number
  totalDirs: number
}

export interface DirectoryNode {
  name: string
  path: string
  type: 'directory' | 'file'
  children?: DirectoryNode[]
  fileCount?: number
}

export interface TechStack {
  languages: LanguageInfo[]
  frameworks: DependencyInfo[]
  libraries: DependencyInfo[]
  tools: DependencyInfo[]
  packageManager: string | null
  buildTool: string | null
  testFramework: string | null
}

export interface LanguageInfo {
  name: string
  percentage: number
  fileCount: number
  extensions: string[]
}

export interface DependencyInfo {
  name: string
  version: string
  type: 'production' | 'development'
  category?: string
}

export interface CodeStyle {
  language: string
  namingConventions: NamingConvention[]
  formatting: FormattingStyle
  bestPractices: BestPractice[]
  summary: string
}

export interface NamingConvention {
  type: 'variable' | 'function' | 'class' | 'constant' | 'file'
  style: 'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case' | 'UPPER_CASE'
  consistency: number
  examples: string[]
}

export interface FormattingStyle {
  indent: 'space' | 'tab'
  indentSize: number
  semicolons: boolean
  quotes: 'single' | 'double' | 'mixed'
  trailingComma: boolean
}

export interface BestPractice {
  name: string
  status: 'adopted' | 'partial' | 'missing'
  description: string
  evidence?: string
}

export interface ProjectArchitecture {
  structure: DirectoryStructure
  structureScore: StructureScore
  techStack: TechStack
  modules: ModuleInfo[]
  entryPoints: string[]
  layers: LayerInfo[]
  lastAnalyzed: string
}

export interface ModuleInfo {
  name: string
  path: string
  type: 'core' | 'feature' | 'util' | 'config' | 'test'
  fileCount: number
  dependencies: string[]
  description?: string
}

export interface LayerInfo {
  name: string
  directories: string[]
  purpose: string
}

export interface AnalysisChange {
  type: 'config' | 'structure' | 'dependency'
  file: string
  timestamp: string
}

export interface AnalysisCache {
  structureScore: StructureScore
  techStackHash: string
  structureHash: string
  lastAnalyzed: string
  changes: AnalysisChange[]
}

export interface SensitivePattern {
  id: string
  name: string
  description: string
  pattern: RegExp
  severity: 'critical' | 'high' | 'medium'
  action: 'redact' | 'warn' | 'ignore'
}

export interface SensitiveMatch {
  patternId: string
  type: string
  value: string
  location: {
    line: number
    start: number
    end: number
  }
  severity: 'critical' | 'high' | 'medium'
}

export interface FilterResult {
  original: string
  filtered: string
  matches: SensitiveMatch[]
  redactedCount: number
  warningCount: number
}

// Re-export logging types
export type { LogLevel, LogEntry, LogTransport, LoggerOptions } from './logging.js'

// Re-export config types
export type {
  OhMemoryConfig,
  CacheConfig,
  LoggingConfig,
  PerformanceConfig,
  PartialConfig,
  ConfigValidationError,
  ConfigValidationResult
} from './config.js'
