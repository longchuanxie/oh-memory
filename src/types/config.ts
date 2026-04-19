/**
 * Configuration types for oh-memory
 * @module types/config
 */

/**
 * Evolution configuration options
 */
export interface EvolutionConfig {
  /** Enable automatic evolution */
  enabled: boolean
  /** File patterns to watch for changes */
  watchPatterns: string[]
  /** File patterns to ignore */
  ignorePatterns: string[]
  /** Minimum number of changes before triggering update */
  updateThreshold: number
  /** Require approval before applying changes */
  requireApproval: boolean
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Maximum number of items in cache */
  maxSize: number
  /** Time-to-live in milliseconds */
  ttl: number
}

/**
 * Logging configuration options
 */
export interface LoggingConfig {
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error'
  /** Log transport names */
  transports: string[]
}

/**
 * Performance configuration options
 */
export interface PerformanceConfig {
  /** Number of concurrent operations */
  concurrency: number
  /** Batch size for bulk operations */
  batchSize: number
}

/**
 * Main configuration interface for oh-memory
 */
export interface OhMemoryConfig {
  /** Evolution settings */
  evolution: EvolutionConfig
  /** Cache settings */
  cache: CacheConfig
  /** Logging settings */
  logging: LoggingConfig
  /** Performance settings */
  performance: PerformanceConfig
}

/**
 * Partial configuration for merging
 */
export type PartialConfig = Partial<OhMemoryConfig>

/**
 * Validation error details
 */
export interface ConfigValidationError {
  /** Field path that failed validation */
  field: string
  /** Error message */
  message: string
  /** Expected value or type */
  expected?: string
  /** Actual value */
  actual?: unknown
}

/**
 * Validation result with errors
 */
export interface ConfigValidationResult {
  /** Whether configuration is valid */
  valid: boolean
  /** List of validation errors */
  errors: ConfigValidationError[]
}
