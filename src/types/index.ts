import type { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from './graph.js'

export type { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from './graph.js'

export type PageType = 'module' | 'concept' | 'config' | 'synthesis'

export interface PageFrontmatter {
  id: string
  title: string
  type: PageType
  date: string
  updated: string
  category?: string
  tags: string[]
  source?: string
  description?: string
}

export interface ConnectionStats {
  inbound: number
  outbound: number
  total: number
}

export interface PageLink {
  target: string
  section?: string
}

export interface KnowledgePage {
  frontmatter: PageFrontmatter
  content: string
  links: PageLink[]
}

export interface PageData {
  id?: string
  metadata: PageFrontmatter
  content?: string
  links: PageLink[]
  filePath?: string
}

export interface EvolutionConfig {
  enabled: boolean
  watchPatterns: string[]
  ignorePatterns: string[]
  updateThreshold: number
  scheduleTime: 'daily' | 'weekly' | 'manual'
  requireApproval: boolean
}

export interface FileWatcherInput {
  path: string
  type?: string
}

export interface FileWatcherOutput {
  acknowledged?: boolean
  timestamp?: string
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

export interface IngestResult {
  success: boolean
  processedFiles: number
  createdPages: string[]
  updatedPages: string[]
  errors: string[]
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
  modulesCount: number
  conceptsCount: number
  configsCount: number
  synthesisCount: number
  lastUpdated: string
}

export type { LogLevel, LogEntry, LogTransport, LoggerOptions } from './logging.js'
export type {
  OhMemoryConfig,
  CacheConfig,
  LoggingConfig,
  PerformanceConfig,
  PartialConfig,
  ConfigValidationError,
  ConfigValidationResult
} from './config.js'
