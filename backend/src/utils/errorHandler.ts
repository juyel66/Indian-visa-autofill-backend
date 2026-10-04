/**
 * Returns a user-friendly error message in production,
 * while preserving detailed error messages in development.
 */
export function formatErrorMessage(fallback: string, error?: unknown): string {
  if (process.env.NODE_ENV === 'production') {
    return fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return typeof error === 'string' ? error : fallback;
}
