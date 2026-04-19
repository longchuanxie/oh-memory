/**
 * Configuration manager for oh-memory
 * @module utils/config-manager
 */

import type {
  OhMemoryConfig,
  PartialConfig,
  ConfigValidationResult,
  ConfigValidationError
} from '../types/config.js'
import type { LogLevel } from '../types/logging.js'

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: OhMemoryConfig = {
  evolution: {
    enabled: true,
    watchPatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    updateThreshold: 5,
    requireApproval: true
  },
  cache: {
    maxSize: 100,
    ttl: 3600000 // 1 hour in milliseconds
  },
  logging: {
    level: 'info',
    transports: ['console']
  },
  performance: {
    concurrency: 4,
    batchSize: 50
  }
}

/**
 * Valid log levels for validation
 */
const VALID_LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']

/**
 * Configuration manager for centralized config handling
 *
 * @example
 * ```typescript
 * const manager = new ConfigManager()
 *
 * // Load with defaults and environment overrides
 * const config = manager.load()
 *
 * // Or merge custom configs
 * const customConfig = manager.merge(
 *   manager.loadDefaults(),
 *   { cache: { maxSize: 200 } }
 * )
 * ```
 */
export class ConfigManager {
  private config: OhMemoryConfig | null = null

  /**
   * Load default configuration
   * @returns Default configuration object
   */
  loadDefaults(): OhMemoryConfig {
    return this.deepClone(DEFAULT_CONFIG)
  }

  /**
   * Deep merge multiple configuration objects
   * @param configs - Configuration objects to merge (later ones override earlier ones)
   * @returns Merged configuration object
   */
  merge(...configs: PartialConfig[]): PartialConfig {
    if (configs.length === 0) {
      return {}
    }

    let result: PartialConfig = {}

    for (const config of configs) {
      result = this.deepMerge(result, config)
    }

    return result
  }

  /**
   * Validate configuration object
   * @param config - Configuration to validate
   * @returns True if valid, false otherwise
   */
  validate(config: OhMemoryConfig): boolean {
    const result = this.validateWithErrors(config)
    return result.valid
  }

  /**
   * Validate configuration and return detailed errors
   * @param config - Configuration to validate
   * @returns Validation result with errors
   */
  validateWithErrors(config: OhMemoryConfig): ConfigValidationResult {
    const errors: ConfigValidationError[] = []

    // Validate evolution config
    if (typeof config.evolution?.updateThreshold !== 'number' ||
        config.evolution.updateThreshold < 0) {
      errors.push({
        field: 'evolution.updateThreshold',
        message: 'updateThreshold must be a non-negative number',
        expected: 'number >= 0',
        actual: config.evolution?.updateThreshold
      })
    }

    // Validate cache config
    if (typeof config.cache?.maxSize !== 'number' ||
        config.cache.maxSize <= 0) {
      errors.push({
        field: 'cache.maxSize',
        message: 'maxSize must be a positive number',
        expected: 'number > 0',
        actual: config.cache?.maxSize
      })
    }

    if (typeof config.cache?.ttl !== 'number' ||
        config.cache.ttl <= 0) {
      errors.push({
        field: 'cache.ttl',
        message: 'ttl must be a positive number',
        expected: 'number > 0',
        actual: config.cache?.ttl
      })
    }

    // Validate logging config
    if (!VALID_LOG_LEVELS.includes(config.logging?.level as LogLevel)) {
      errors.push({
        field: 'logging.level',
        message: `level must be one of: ${VALID_LOG_LEVELS.join(', ')}`,
        expected: VALID_LOG_LEVELS.join(' | '),
        actual: config.logging?.level
      })
    }

    // Validate performance config
    if (typeof config.performance?.concurrency !== 'number' ||
        config.performance.concurrency <= 0) {
      errors.push({
        field: 'performance.concurrency',
        message: 'concurrency must be a positive number',
        expected: 'number > 0',
        actual: config.performance?.concurrency
      })
    }

    if (typeof config.performance?.batchSize !== 'number' ||
        config.performance.batchSize <= 0) {
      errors.push({
        field: 'performance.batchSize',
        message: 'batchSize must be a positive number',
        expected: 'number > 0',
        actual: config.performance?.batchSize
      })
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Load configuration from environment variables
   * @returns Partial configuration from environment
   */
  loadFromEnv(): PartialConfig {
    const config: PartialConfig = {}

    const logLevel = process.env.OH_MEMORY_LOG_LEVEL as LogLevel | undefined
    if (logLevel && VALID_LOG_LEVELS.includes(logLevel)) {
      config.logging = { level: logLevel, transports: ['console'] }
    }

    const cacheMaxSize = process.env.OH_MEMORY_CACHE_MAX_SIZE
    if (cacheMaxSize) {
      const size = parseInt(cacheMaxSize, 10)
      if (!isNaN(size) && size > 0) {
        config.cache = { maxSize: size, ttl: 3600000 }
      }
    }

    const concurrency = process.env.OH_MEMORY_CONCURRENCY
    if (concurrency) {
      const num = parseInt(concurrency, 10)
      if (!isNaN(num) && num > 0) {
        config.performance = { concurrency: num, batchSize: 50 }
      }
    }

    return config
  }

  /**
   * Load configuration from all sources (defaults + env)
   * @returns Complete configuration object
   */
  load(): OhMemoryConfig {
    if (this.config) {
      return this.config
    }

    const defaults = this.loadDefaults()
    const envConfig = this.loadFromEnv()

    this.config = this.merge(defaults, envConfig) as OhMemoryConfig
    return this.config
  }

  /**
   * Reset cached configuration (useful for testing)
   */
  reset(): void {
    this.config = null
  }

  /**
   * Deep clone an object
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj))
  }

  /**
   * Deep merge two objects
   */
  private deepMerge<T extends Record<string, unknown>>(
    target: Partial<T>,
    source: Partial<T>
  ): Partial<T> {
    const result: Partial<T> = { ...target }

    for (const key of Object.keys(source) as (keyof T)[]) {
      const sourceValue = source[key]
      const targetValue = target[key]

      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        // Deep merge nested objects
        result[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[keyof T]
      } else {
        // Replace arrays and primitives
        result[key] = sourceValue as T[keyof T]
      }
    }

    return result
  }
}
