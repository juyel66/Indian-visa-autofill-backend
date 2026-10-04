import jwt from 'jsonwebtoken';
import { env } from '../config/env';

/**
 * Parses a duration string (e.g. '365d', '7d', '24h', '15m', '60s') or numeric seconds into milliseconds.
 * Defaults to 365 days if unparseable or empty.
 */
export function parseDurationToMs(duration?: string | number, defaultDays: number = 365): number {
  if (typeof duration === 'number') {
    return duration * 1000;
  }
  if (!duration || typeof duration !== 'string') {
    return defaultDays * 24 * 60 * 60 * 1000;
  }

  const match = duration.trim().match(/^(\d+)\s*(d|day|days|h|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds|w|week|weeks|y|year|years)?$/i);
  if (!match) {
    const num = Number(duration);
    if (!isNaN(num) && num > 0) {
      return num * 1000;
    }
    return defaultDays * 24 * 60 * 60 * 1000;
  }

  const value = parseInt(match[1], 10);
  const unit = (match[2] || 's').toLowerCase();

  switch (unit) {
    case 'd':
    case 'day':
    case 'days':
      return value * 24 * 60 * 60 * 1000;
    case 'h':
    case 'hour':
    case 'hours':
      return value * 60 * 60 * 1000;
    case 'm':
    case 'min':
    case 'mins':
    case 'minute':
    case 'minutes':
      return value * 60 * 1000;
    case 's':
    case 'sec':
    case 'secs':
    case 'second':
    case 'seconds':
      return value * 1000;
    case 'w':
    case 'week':
    case 'weeks':
      return value * 7 * 24 * 60 * 60 * 1000;
    case 'y':
    case 'year':
    case 'years':
      return value * 365 * 24 * 60 * 60 * 1000;
    default:
      return defaultDays * 24 * 60 * 60 * 1000;
  }
}

/**
 * Calculates the expiration Date for a refresh token.
 * Uses the exact `exp` claim from the signed JWT if present to keep JWT and DB expiration 100% in sync.
 * Fallback to Date.now() + parsed JWT_REFRESH_EXPIRES_IN (approx 365 days).
 */
export function calculateRefreshTokenExpiresAt(token?: string): Date {
  if (token) {
    try {
      const decoded = jwt.decode(token) as jwt.JwtPayload | null;
      if (decoded && typeof decoded.exp === 'number') {
        return new Date(decoded.exp * 1000);
      }
    } catch {
      // Fallback below
    }
  }

  return new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN, 365));
}
