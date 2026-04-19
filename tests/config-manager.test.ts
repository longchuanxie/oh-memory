import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { ConfigManager } from '../src/utils/config-manager'
import type { OhMemoryConfig } from '../src/types/config'

describe('ConfigManager', () => {
  let manager: ConfigManager
  let originalEnv: string | undefined

  beforeEach(() => {
    manager = new ConfigManager()
    originalEnv = process.env.OH_MEMORY_LOG_LEVEL
  })

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.OH_MEMORY_LOG_LEVEL = originalEnv
    } else {
      delete process.env.OH_MEMORY_LOG_LEVEL
    }
  })

  it('should load default config', () => {
    const config = manager.loadDefaults()

    expect(config.evolution.enabled).toBe(true)
    expect(config.cache.maxSize).toBe(100)
    expect(config.logging.level).toBe('info')
  })

  it('should merge configs correctly', () => {
    const config = manager.merge(
      { evolution: { enabled: false } },
      { cache: { maxSize: 200 } }
    )

    expect(config.evolution.enabled).toBe(false)
    expect(config.cache.maxSize).toBe(200)
  })

  it('should validate config', () => {
    const validConfig = manager.loadDefaults()

    expect(manager.validate(validConfig)).toBe(true)

    const invalidConfig = { ...validConfig, cache: { maxSize: -1 } }
    expect(manager.validate(invalidConfig)).toBe(false)
  })

  it('should load from environment variables', () => {
    process.env.OH_MEMORY_LOG_LEVEL = 'debug'

    const config = manager.loadFromEnv()

    expect(config.logging?.level).toBe('debug')
  })

  it('should deep merge nested config objects', () => {
    const base = manager.loadDefaults()
    const override = {
      evolution: {
        enabled: false,
        watchPatterns: ['**/*.custom.ts']
      }
    }

    const merged = manager.merge(base, override)

    // Should override enabled
    expect(merged.evolution.enabled).toBe(false)
    // Should override watchPatterns
    expect(merged.evolution.watchPatterns).toEqual(['**/*.custom.ts'])
    // Should preserve other nested properties
    expect(merged.evolution.ignorePatterns).toEqual(base.evolution.ignorePatterns)
    expect(merged.evolution.requireApproval).toBe(base.evolution.requireApproval)
  })

  it('should return empty object from loadFromEnv when no env vars set', () => {
    delete process.env.OH_MEMORY_LOG_LEVEL

    const config = manager.loadFromEnv()

    expect(config.logging?.level).toBeUndefined()
  })

  it('should validate cache.maxSize is positive', () => {
    const config = manager.loadDefaults()
    config.cache.maxSize = 0

    expect(manager.validate(config)).toBe(false)
  })

  it('should validate cache.ttl is positive', () => {
    const config = manager.loadDefaults()
    config.cache.ttl = -100

    expect(manager.validate(config)).toBe(false)
  })

  it('should validate performance.concurrency is positive', () => {
    const config = manager.loadDefaults()
    config.performance.concurrency = 0

    expect(manager.validate(config)).toBe(false)
  })

  it('should validate performance.batchSize is positive', () => {
    const config = manager.loadDefaults()
    config.performance.batchSize = -1

    expect(manager.validate(config)).toBe(false)
  })

  it('should validate logging.level is valid', () => {
    const config = manager.loadDefaults()
    ;(config.logging as { level: string }).level = 'invalid'

    expect(manager.validate(config)).toBe(false)
  })

  it('should validate updateThreshold is non-negative', () => {
    const config = manager.loadDefaults()
    config.evolution.updateThreshold = -1

    expect(manager.validate(config)).toBe(false)
  })

  it('should load all config sources and merge them', () => {
    process.env.OH_MEMORY_LOG_LEVEL = 'warn'

    const config = manager.load()

    expect(config.evolution.enabled).toBe(true) // default
    expect(config.cache.maxSize).toBe(100) // default
    expect(config.logging.level).toBe('warn') // from env
  })

  it('should provide config with defaults when loadFromEnv returns empty', () => {
    delete process.env.OH_MEMORY_LOG_LEVEL

    const config = manager.load()

    expect(config.logging.level).toBe('info') // default
  })

  it('should merge multiple partial configs', () => {
    const config = manager.merge(
      { evolution: { enabled: false } },
      { cache: { maxSize: 500 } },
      { logging: { level: 'debug' as const } }
    )

    expect(config.evolution.enabled).toBe(false)
    expect(config.cache.maxSize).toBe(500)
    expect(config.logging.level).toBe('debug')
  })

  it('should handle empty merge inputs', () => {
    const config = manager.merge()

    expect(config).toEqual({})
  })

  it('should handle single merge input', () => {
    const config = manager.merge({ evolution: { enabled: false } })

    expect(config.evolution.enabled).toBe(false)
  })

  it('should preserve arrays during merge', () => {
    const base = manager.loadDefaults()
    const override = {
      evolution: {
        watchPatterns: ['new-pattern']
      }
    }

    const merged = manager.merge(base, override)

    // Arrays should be replaced, not concatenated
    expect(merged.evolution.watchPatterns).toEqual(['new-pattern'])
  })
})

describe('ConfigManager validation errors', () => {
  let manager: ConfigManager

  beforeEach(() => {
    manager = new ConfigManager()
  })

  it('should return validation errors with details', () => {
    const config = manager.loadDefaults()
    config.cache.maxSize = -1

    const result = manager.validateWithErrors(config)

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0].field).toContain('cache.maxSize')
  })

  it('should return valid result for correct config', () => {
    const config = manager.loadDefaults()

    const result = manager.validateWithErrors(config)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('should collect multiple validation errors', () => {
    const config = manager.loadDefaults()
    config.cache.maxSize = -1
    config.cache.ttl = -1
    config.performance.concurrency = 0

    const result = manager.validateWithErrors(config)

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(3)
  })
})

describe('ConfigManager type safety', () => {
  let manager: ConfigManager

  beforeEach(() => {
    manager = new ConfigManager()
  })

  it('should have correct default types', () => {
    const config = manager.loadDefaults()

    expect(typeof config.evolution.enabled).toBe('boolean')
    expect(Array.isArray(config.evolution.watchPatterns)).toBe(true)
    expect(typeof config.cache.maxSize).toBe('number')
    expect(typeof config.logging.level).toBe('string')
  })

  it('should preserve type safety after merge', () => {
    const config = manager.merge(
      manager.loadDefaults(),
      { evolution: { enabled: false } }
    )

    // TypeScript should infer correct types
    const enabled: boolean = config.evolution.enabled
    const maxSize: number = config.cache.maxSize

    expect(enabled).toBe(false)
    expect(typeof maxSize).toBe('number')
  })
})
