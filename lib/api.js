import { NextResponse } from 'next/server';
import { getSessionUser } from './auth';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const json = (data, status = 200) => NextResponse.json(data, { status });

/**
 * Wraps a route handler with:
 *   - login check (and optional role check)
 *   - JSON error responses
 *   - translation of PostgreSQL errors into friendly messages
 *
 *   export const GET = route(async (req, { user, params }) => json({...}), { roles: ['Admin'] });
 *   Pass { public: true } for routes that do not need a login.
 */
export function route(handler, options = {}) {
  return async (req, ctx = {}) => {
    try {
      const params = ctx.params ? await ctx.params : {};
      let user = null;
      if (!options.public) {
        user = await getSessionUser(req);
        if (!user) throw new HttpError(401, 'Please log in first');
        if (options.roles && !options.roles.includes(user.role)) {
          throw new HttpError(403, 'You do not have permission to do that');
        }
      }
      return await handler(req, { user, params });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

function errorResponse(err) {
  if (err instanceof HttpError) return json({ error: err.message }, err.status);

  // PostgreSQL errors
  switch (err?.code) {
    case 'P0001': // RAISE EXCEPTION from our triggers / functions
      return json({ error: err.message }, 400);
    case '23505':
      return json({ error: 'That value already exists (duplicate entry)' }, 409);
    case '23503':
      return json({ error: 'This record is linked to other data, so it cannot be changed or removed. Set it to inactive instead.' }, 409);
    case '23514':
    case '22P02':
    case '22007':
    case '22008':
    case '22003':
      return json({ error: 'Some of the values you sent are not valid' }, 400);
    default:
      console.error('API error:', err);
      return json({ error: 'Something went wrong on the server' }, 500);
  }
}

export async function readBody(req) {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}

// ---- tiny validators --------------------------------------------------
export function text(value, label, { min = 1, max = 255, optional = false } = {}) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) {
    if (optional) return null;
    throw new HttpError(400, `${label} is required`);
  }
  if (v.length < min) throw new HttpError(400, `${label} must be at least ${min} characters`);
  if (v.length > max) throw new HttpError(400, `${label} must be at most ${max} characters`);
  return v;
}

export function oneOf(value, label, allowed, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (!allowed.includes(value)) throw new HttpError(400, `${label} must be one of: ${allowed.join(', ')}`);
  return value;
}

export function intId(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${label} is invalid`);
  return n;
}

export function dateStr(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${label} must be a date (YYYY-MM-DD)`);
  }
  return value;
}

export function timeStr(value, label) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new HttpError(400, `${label} must be a time (HH:MM)`);
  }
  return value;
}

export const VEHICLE_TYPES = ['Car', 'Bike', 'EV'];
export const PAYMENT_METHODS = ['UPI', 'Card', 'Cash', 'Wallet'];
export const COMPLAINT_CATEGORIES = ['Slot Occupied', 'Wrong Billing', 'Damaged Slot', 'Safety', 'Other'];
export const COMPLAINT_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
