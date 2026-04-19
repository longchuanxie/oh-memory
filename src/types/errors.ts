/**
 * Error severity levels for classification
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Context information for error tracking
 */
export interface ErrorContext {
  operation?: string
  file?: string
  line?: number
  [key: string]: unknown
}

/**
 * Custom error class for oh-memory operations
 */
export class OhMemoryError extends Error {
  public readonly code: string
  public readonly severity: string
  public readonly context?: Record<string, unknown>

  constructor(message: string, code: string, severity: string, context?: Record<string, unknown>) {
    super(message)
    this.name = 'OhMemoryError'
    this.code = code
    this.severity = severity
    this.context = context
  }
}

/**
 * Log entry structure for error logging
 */
export interface ErrorLogEntry {
  error: OhMemoryError
  context: Record<string, unknown>
  timestamp: string
}

/**
 * Custom logger function type
 */
export type ErrorLogger = (entry: ErrorLogEntry) => void
