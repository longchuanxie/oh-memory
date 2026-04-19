import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { GlobalCacheManager } from '../src/core/global-cache-manager'

describe('GlobalCacheManager Memory Management', () => {
  let manager: GlobalCacheManager

  beforeEach(() => {
    GlobalCacheManager.reset()
    manager = GlobalCacheManager.getInstance()
  })

  afterEach(() => {
    GlobalCacheManager.reset()
  })

  it('should enforce max cache size', () => {
    manager.setMaxSize(2)
    manager.setMemoryCache('key1', 'value1')
    manager.setMemoryCache('key2', 'value2')
    manager.setMemoryCache('key3', 'value3')

    expect(manager.hasMemoryCache('key1')).toBe(false)
    expect(manager.hasMemoryCache('key2')).toBe(true)
    expect(manager.hasMemoryCache('key3')).toBe(true)
  })

  it('should cleanup expired entries', async () => {
    manager.setMemoryCache('key1', 'value1', 50) // 50ms TTL

    expect(manager.hasMemoryCache('key1')).toBe(true)

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(manager.hasMemoryCache('key1')).toBe(false)
  })

  it('should support manual cleanup', async () => {
    manager.setMemoryCache('key1', 'value1', 50)
    manager.setMemoryCache('key2', 'value2', 10000)

    await new Promise(resolve => setTimeout(resolve, 60))
    manager.cleanup()

    // Only expired entries should be removed
    expect(manager.hasMemoryCache('key1')).toBe(false)
    expect(manager.hasMemoryCache('key2')).toBe(true)
  })

  it('should clear all cache on invalidateAll', () => {
    manager.setMemoryCache('key1', 'value1')
    manager.setMemoryCache('key2', 'value2')

    manager.invalidateAll()

    expect(manager.hasMemoryCache('key1')).toBe(false)
    expect(manager.hasMemoryCache('key2')).toBe(false)
  })

  it('should return null for expired entries on get', async () => {
    manager.setMemoryCache('key1', 'value1', 50)

    expect(manager.getMemoryCache('key1')).toBe('value1')

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(manager.getMemoryCache('key1')).toBe(null)
  })

  it('should handle entries without TTL', async () => {
    manager.setMemoryCache('key1', 'value1') // No TTL

    await new Promise(resolve => setTimeout(resolve, 50))

    // Should still exist since no TTL
    expect(manager.hasMemoryCache('key1')).toBe(true)
    expect(manager.getMemoryCache('key1')).toBe('value1')
  })

  it('should handle empty cache cleanup', () => {
    // Should not throw
    manager.cleanup()
    expect(manager.hasMemoryCache('nonexistent')).toBe(false)
  })

  it('should handle max size of 0', () => {
    manager.setMaxSize(0)
    manager.setMemoryCache('key1', 'value1')

    // With max size 0, nothing should be stored
    expect(manager.hasMemoryCache('key1')).toBe(false)
  })

  it('should evict oldest entries when max size reached', () => {
    manager.setMaxSize(2)
    manager.setMemoryCache('key1', 'value1')
    manager.setMemoryCache('key2', 'value2')
    manager.setMemoryCache('key3', 'value3')

    // key1 should be evicted (oldest)
    expect(manager.hasMemoryCache('key1')).toBe(false)
    expect(manager.hasMemoryCache('key2')).toBe(true)
    expect(manager.hasMemoryCache('key3')).toBe(true)
  })

  it('should update entry on re-set', () => {
    manager.setMaxSize(2)
    manager.setMemoryCache('key1', 'value1')
    manager.setMemoryCache('key2', 'value2')
    manager.setMemoryCache('key1', 'updated1') // Update existing

    // Should not evict since we're updating
    expect(manager.getMemoryCache('key1')).toBe('updated1')
    expect(manager.hasMemoryCache('key2')).toBe(true)
  })

  it('should clear cleanup timer on reset', async () => {
    manager.setMaxSize(10)
    manager.setMemoryCache('key1', 'value1', 50)

    // Reset should clear timer
    GlobalCacheManager.reset()

    // New instance should work independently
    const newManager = GlobalCacheManager.getInstance()
    expect(newManager.hasMemoryCache('key1')).toBe(false)
  })
})
