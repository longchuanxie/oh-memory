import { promises as fs } from 'fs'
import path from 'path'

export interface CacheEntry<T> {
  value: T
  timestamp: number
  ttl: number
}

export interface CacheStats {
  hits: number
  misses: number
  size: number
  memoryUsage: number
}

export class MemoryCache<K, V> {
  private cache: Map<K, CacheEntry<V>> = new Map()
  private maxSize: number
  private defaultTtl: number
  private stats = { hits: 0, misses: 0 }

  constructor(options: { maxSize: number; defaultTtl: number }) {
    this.maxSize = options.maxSize
    this.defaultTtl = options.defaultTtl
  }

  get(key: K): V | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.stats.misses++
      return null
    }
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }
    
    this.stats.hits++
    return entry.value
  }

  set(key: K, value: V, ttl?: number): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU()
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl
    })
  }

  has(key: K): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  delete(key: K): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
    this.stats = { hits: 0, misses: 0 }
  }

  private evictLRU(): void {
    let oldestKey: K | null = null
    let oldestTime = Infinity
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.cache.size,
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  private estimateMemoryUsage(): number {
    let size = 0
    for (const entry of this.cache.values()) {
      size += JSON.stringify(entry.value).length
    }
    return size
  }
}
