import { promises as fs } from 'fs'
import path from 'path'

export interface PerformanceMetric {
  name: string
  value: number
  unit: 'ms' | 'bytes' | 'count'
  timestamp: string
  tags?: Record<string, string>
}

export interface PerformanceReport {
  period: {
    start: string
    end: string
  }
  metrics: {
    avgQueryTime: number
    avgIndexTime: number
    avgIngestTime: number
    cacheHitRate: number
    totalQueries: number
    totalIngests: number
    errorRate: number
  }
  recommendations: string[]
  trends: {
    queryTime: 'improving' | 'stable' | 'degrading'
    cacheHitRate: 'improving' | 'stable' | 'degrading'
  }
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private metricsPath: string
  private maxMetrics: number = 1000

  constructor(memoryPath: string) {
    this.metricsPath = path.join(memoryPath, 'performance-metrics.json')
  }

  recordMetric(
    name: string,
    value: number,
    unit: 'ms' | 'bytes' | 'count',
    tags?: Record<string, string>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      tags
    }

    this.metrics.push(metric)

    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  recordQuery(duration: number, cacheHit: boolean): void {
    this.recordMetric('query_time', duration, 'ms', { cacheHit: String(cacheHit) })
  }

  recordIndex(duration: number, nodeCount: number): void {
    this.recordMetric('index_time', duration, 'ms', { nodeCount: String(nodeCount) })
  }

  recordIngest(duration: number, fileCount: number): void {
    this.recordMetric('ingest_time', duration, 'ms', { fileCount: String(fileCount) })
  }

  recordCacheStats(hits: number, misses: number): void {
    const total = hits + misses
    const hitRate = total > 0 ? (hits / total) * 100 : 0
    this.recordMetric('cache_hit_rate', hitRate, 'count')
  }

  getMetrics(name?: string, since?: Date): PerformanceMetric[] {
    let filtered = this.metrics

    if (name) {
      filtered = filtered.filter(m => m.name === name)
    }

    if (since) {
      filtered = filtered.filter(m => new Date(m.timestamp) >= since)
    }

    return filtered
  }

  getAverage(name: string, since?: Date): number {
    const metrics = this.getMetrics(name, since)
    
    if (metrics.length === 0) return 0

    const sum = metrics.reduce((acc, m) => acc + m.value, 0)
    return sum / metrics.length
  }

  generateReport(since?: Date): PerformanceReport {
    const now = new Date()
    const startDate = since || new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const queryMetrics = this.getMetrics('query_time', startDate)
    const indexMetrics = this.getMetrics('index_time', startDate)
    const ingestMetrics = this.getMetrics('ingest_time', startDate)
    const cacheMetrics = this.getMetrics('cache_hit_rate', startDate)

    const avgQueryTime = this.calculateAverage(queryMetrics)
    const avgIndexTime = this.calculateAverage(indexMetrics)
    const avgIngestTime = this.calculateAverage(ingestMetrics)
    const avgCacheHitRate = this.calculateAverage(cacheMetrics)

    const totalQueries = queryMetrics.length
    const totalIngests = ingestMetrics.length

    const recommendations = this.generateRecommendations(
      avgQueryTime,
      avgIndexTime,
      avgIngestTime,
      avgCacheHitRate
    )

    const trends = this.analyzeTrends(queryMetrics, cacheMetrics)

    return {
      period: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      metrics: {
        avgQueryTime,
        avgIndexTime,
        avgIngestTime,
        cacheHitRate: avgCacheHitRate,
        totalQueries,
        totalIngests,
        errorRate: 0
      },
      recommendations,
      trends
    }
  }

  private calculateAverage(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0
    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length
  }

  private generateRecommendations(
    avgQueryTime: number,
    avgIndexTime: number,
    avgIngestTime: number,
    cacheHitRate: number
  ): string[] {
    const recommendations: string[] = []

    if (avgQueryTime > 500) {
      recommendations.push('查询时间较长，建议检查索引是否需要优化')
    }

    if (avgIndexTime > 5000) {
      recommendations.push('索引构建时间较长，建议启用增量索引')
    }

    if (cacheHitRate < 50) {
      recommendations.push('缓存命中率较低，建议增加缓存大小或调整缓存策略')
    }

    if (avgIngestTime > 10000) {
      recommendations.push('摄入时间较长，建议减少批量大小或启用并行处理')
    }

    if (recommendations.length === 0) {
      recommendations.push('性能表现良好，继续保持')
    }

    return recommendations
  }

  private analyzeTrends(
    queryMetrics: PerformanceMetric[],
    cacheMetrics: PerformanceMetric[]
  ): { queryTime: 'improving' | 'stable' | 'degrading'; cacheHitRate: 'improving' | 'stable' | 'degrading' } {
    const queryTrend = this.analyzeTrend(queryMetrics)
    const cacheTrend = this.analyzeTrend(cacheMetrics)

    return {
      queryTime: queryTrend,
      cacheHitRate: cacheTrend === 'improving' ? 'improving' : 
                    queryTrend === 'degrading' ? 'degrading' : 'stable'
    }
  }

  private analyzeTrend(metrics: PerformanceMetric[]): 'improving' | 'stable' | 'degrading' {
    if (metrics.length < 5) return 'stable'

    const recent = metrics.slice(-5)
    const older = metrics.slice(-10, -5)

    if (older.length === 0) return 'stable'

    const recentAvg = this.calculateAverage(recent)
    const olderAvg = this.calculateAverage(older)

    const change = (recentAvg - olderAvg) / olderAvg

    if (change < -0.1) return 'improving'
    if (change > 0.1) return 'degrading'
    return 'stable'
  }

  async save(): Promise<void> {
    const data = {
      metrics: this.metrics,
      lastUpdated: new Date().toISOString()
    }
    await fs.writeFile(this.metricsPath, JSON.stringify(data, null, 2), 'utf-8')
  }

  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.metricsPath, 'utf-8')
      const data = JSON.parse(content)
      this.metrics = data.metrics || []
    } catch {
      this.metrics = []
    }
  }

  clear(): void {
    this.metrics = []
  }
}
