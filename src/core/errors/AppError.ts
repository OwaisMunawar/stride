/**
 * Every failure the UI can react to has a code. Screens switch on the code,
 * never on message text, so copy can change without breaking behaviour.
 */
export const ErrorCodes = [
  'DB_MIGRATION_FAILED',
  'RUN_NOT_FOUND',
  'RECORDING_ALREADY_ACTIVE',
  'NO_ACTIVE_RECORDING',
  'LOCATION_PERMISSION_DENIED',
  'LOCATION_SERVICES_OFF',
  'LOCATION_START_FAILED',
  'GPX_INVALID',
  'GPX_EMPTY',
  'EXPORT_FAILED',
  'COACH_UNAVAILABLE',
  'COACH_INVALID_OUTPUT',
  'COACH_FAILED',
  'CANCELLED',
  'UNKNOWN',
] as const;

export type ErrorCode = (typeof ErrorCodes)[number];

export class AppError extends Error {
  override readonly name = 'AppError';
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
  }
}

export function isAppError(error: unknown, code?: ErrorCode): error is AppError {
  return error instanceof AppError && (code === undefined || error.code === code);
}

/**
 * Normalises anything thrown (native module errors arrive as plain objects or
 * strings after crossing JSI) into an AppError, keeping the original as cause.
 */
export function toAppError(error: unknown, fallback: ErrorCode, message?: string): AppError {
  if (error instanceof AppError) return error;
  const detail = error instanceof Error ? error.message : String(error);
  return new AppError(fallback, message ?? detail, { cause: error });
}
