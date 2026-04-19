import { promises as fs } from 'fs'
import path from 'path'

export interface CacheManagerConfig {
  projectPath: string
  memoryPath: string
}

export interface CacheVersion {
  version: string
  graphVersion: string
  indexVersion: string
  lastUpdated: string
}

interface CacheEntry<T> {
  value: T
  timestamp: number
  ttl: number // 0 means no TTL
}

export class GlobalCacheManager {
  private static instance: GlobalCacheManager | null = null
  private config: CacheManagerConfig | null = null

  private memoryCache: Map<string, CacheEntry<any>> = new Map()
  private maxSize: number = 100
  private cleanupInterval?: ReturnType<typeof setInterval>
  private version: CacheVersion | null = null
  private initialized: boolean = false

  private constructor() {}

  static getInstance(): GlobalCacheManager {
    if (!GlobalCacheManager.instance) {
      GlobalCacheManager.instance = new GlobalCacheManager()
    }
    return GlobalCacheManager.instance
  }

  async initialize(projectPath: string, memoryPath: string): Promise<void> {
    if (this.initialized && this.config?.projectPath === projectPath) {
      return
    }

    this.config = { projectPath, memoryPath }
    this.initialized = true

    // Start periodic cleanup (every 60 seconds)
    this.startCleanupTimer()

    await this.loadVersion()
  }

  private startCleanupTimer(): void {
    this.stopCleanupTimer()
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  private stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }
  }

  private async loadVersion(): Promise<void> {
    if (!this.config) return

    const versionPath = path.join(this.config.memoryPath, 'cache-version.json')

    try {
      const content = await fs.readFile(versionPath, 'utf-8')
      this.version = JSON.parse(content)
    } catch {
      this.version = {
        version: '1.0.0',
        graphVersion: '',
        indexVersion: '',
        lastUpdated: new Date().toISOString()
      }
    }
  }

  async saveVersion(): Promise<void> {
    if (!this.config || !this.version) return

    const versionPath = path.join(this.config.memoryPath, 'cache-version.json')
    await fs.writeFile(versionPath, JSON.stringify(this.version, null, 2), 'utf-8')
  }

  setMaxSize(size: number): void {
    this.maxSize = Math.max(0, size)
  }

  setMemoryCache<T>(key: string, value: T, ttl?: number): void {
    // If max size is 0, don't store anything
    if (this.maxSize === 0) {
      return
    }

    // If key already exists, just update it
    if (this.memoryCache.has(key)) {
      this.memoryCache.set(key, {
        value,
        timestamp: Date.now(),
        ttl: ttl ?? 0
      })
      return
    }

    // Evict oldest entries if at max capacity
    while (this.memoryCache.size >= this.maxSize) {
      const oldestKey = this.memoryCache.keys().next().value
      if (oldestKey !== undefined) {
        this.memoryCache.delete(oldestKey)
      }
    }

    this.memoryCache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl ?? 0
    })
  }

  getMemoryCache<T>(key: string): T | null {
    const entry = this.memoryCache.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    if (entry.ttl > 0) {
      const now = Date.now()
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key)
        return null
      }
    }

    return entry.value as T
  }

  hasMemoryCache(key: string): boolean {
    const entry = this.memoryCache.get(key)

    if (!entry) {
      return false
    }

    // Check if expired
    if (entry.ttl > 0) {
      const now = Date.now()
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key)
        return false
      }
    }

    return true
  }

  cleanup(): void {
    const now = Date.now()

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.ttl > 0 && now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key)
      }
    }
  }

  invalidateCache(key: string): void {
    this.memoryCache.delete(key)

    if (this.version) {
      if (key === 'graph') {
        this.version.graphVersion = this.generateNewVersion()
      } else if (key === 'index') {
        this.version.indexVersion = this.generateNewVersion()
      }
      this.version.lastUpdated = new Date().toISOString()
      this.saveVersion()
    }
  }

  invalidateAll(): void {
    this.memoryCache.clear()

    if (this.version) {
      this.version.graphVersion = this.generateNewVersion()
      this.version.indexVersion = this.generateNewVersion()
      this.version.lastUpdated = new Date().toISOString()
      this.saveVersion()
    }
  }

  getVersion(): CacheVersion | null {
    return this.version
  }

  isInitialized(): boolean {
    return this.initialized
  }

  getConfig(): CacheManagerConfig | null {
    return this.config
  }

  private generateNewVersion(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  async clear(): Promise<void> {
    this.memoryCache.clear()
    await this.saveVersion()
  }

  static reset(): void {
    if (GlobalCacheManager.instance) {
      GlobalCacheManager.instance.stopCleanupTimer()
    }
    GlobalCacheManager.instance = null
  }
}

export function getGlobalCacheManager(): GlobalCacheManager {
  return GlobalCacheManager.getInstance()
}
