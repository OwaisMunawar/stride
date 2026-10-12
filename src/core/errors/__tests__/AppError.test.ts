import { AppError, isAppError, toAppError } from '../AppError';

describe('AppError', () => {
  it('carries a code and matches by code', () => {
    const error = new AppError('RUN_NOT_FOUND', 'missing');
    expect(isAppError(error)).toBe(true);
    expect(isAppError(error, 'RUN_NOT_FOUND')).toBe(true);
    expect(isAppError(error, 'GPX_EMPTY')).toBe(false);
    expect(isAppError(new Error('x'))).toBe(false);
  });

  it('normalises anything thrown and keeps the cause', () => {
    const original = new Error('boom');
    const wrapped = toAppError(original, 'COACH_FAILED');
    expect(wrapped.code).toBe('COACH_FAILED');
    expect(wrapped.message).toBe('boom');
    expect(wrapped.cause).toBe(original);
    expect(toAppError('text', 'UNKNOWN', 'Custom').message).toBe('Custom');
    expect(toAppError(wrapped, 'UNKNOWN')).toBe(wrapped);
  });
});
