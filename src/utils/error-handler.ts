import type { ErrorSeverity, ErrorContext, ErrorLogger, ErrorLogEntry } from '../types/errors.js'

import { Logger } from './logger.js'

/**
 * Custom error class for oh-memory application errors.
 * Provides structured error information with codes, severity, and context.
 */
export class OhMemoryError extends Error {
  /** Error code for programmatic handling */
  public readonly code: string

  /** Severity level for error classification */
  public readonly severity: ErrorSeverity

  /** Additional context information */
  public readonly context: Record<string, unknown>

  /**
   * Creates a new OhMemoryError instance.
   *
   * @param message - Human-readable error message
   * @param code - Error code for programmatic handling
   * @param severity - Error severity level
   * @param context - Additional context information
   */
  constructor(
    message: string,
    code: string,
    severity: ErrorSeverity,
    context: ErrorContext = {}
  ) {
    super(message)
    this.name = 'OhMemoryError'
    this.code = code
    this.severity = severity
    this.context = context

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OhMemoryError)
    }
  }

  /**
   * Converts the error to a JSON-serializable object for logging.
   *
   * @returns JSON representation of the error
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      context: this.context,
      stack: this.stack
    }
  }
}

/**
 * Normalized error input type - can be various error formats
 */
type NormalizableError = Error | string | unknown

/**
 * Unified error handler for normalizing and logging errors.
 * Provides consistent error handling across the application.
 */
export class ErrorHandler {
  private logger: ErrorLogger | null = null
  private structuredLogger = Logger.getInstance()

  /**
   * Sets a custom logger function for error logging.
   *
   * @param logger - Custom logger function or null to disable
   */
  public setLogger(logger: ErrorLogger | null): void {
    this.logger = logger
  }

  /**
   * Normalizes any error type to an OhMemoryError instance.
   * Preserves existing OhMemoryError instances.
   *
   * @param error - The error to normalize
   * @param code - Default error code to use
   * @param severity - Default severity level to use
   * @param context - Additional context to merge
   * @returns Normalized OhMemoryError instance
   */
  public normalize(
    error: NormalizableError,
    code: string,
    severity: ErrorSeverity,
    context: ErrorContext = {}
  ): OhMemoryError {
    // Preserve existing OhMemoryError instances
    if (error instanceof OhMemoryError) {
      return error
    }

    // Handle standard Error instances
    if (error instanceof Error) {
      return new OhMemoryError(error.message, code, severity, context)
    }

    // Handle string errors
    if (typeof error === 'string') {
      return new OhMemoryError(error, code, severity, context)
    }

    // Handle unknown error types - serialize to string
    let message: string
    try {
      message = JSON.stringify(error)
    } catch {
      message = String(error)
    }

    return new OhMemoryError(message, code, severity, context)
  }

  /**
   * Handles an error by logging it with context.
   * Critical errors are always logged to console.
   *
   * @param error - The error to handle
   * @param context - Additional context for the error
   */
  public handle(error: OhMemoryError, context: Record<string, unknown> = {}): void {
    const logEntry: ErrorLogEntry = {
      error,
      context,
      timestamp: new Date().toISOString()
    }

    // Log to custom logger if set
    if (this.logger) {
      this.logger(logEntry)
    }

    // Always log critical errors
    if (error.severity === 'critical') {
      this.structuredLogger.error(
        `CRITICAL ERROR [${error.code}]: ${error.message}`,
        error,
        error.context
      )
    }
  }

  /**
   * Creates and handles an error in one step.
   * Convenience method for common error handling pattern.
   *
   * @param message - Error message
   * @param code - Error code
   * @param severity - Severity level
   * @param context - Additional context
   * @returns The created OhMemoryError instance
   */
  public createAndHandle(
    message: string,
    code: string,
    severity: ErrorSeverity,
    context: ErrorContext = {}
  ): OhMemoryError {
    const error = new OhMemoryError(message, code, severity, context)
    this.handle(error, context)
    return error
  }
}

/**
 * Default error handler instance for application-wide use
 */
export const defaultErrorHandler = new ErrorHandler()
