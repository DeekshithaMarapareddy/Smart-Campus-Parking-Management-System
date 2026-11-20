import { SignJWT, jwtVerify } from 'jose';
import { query } from './db';

export const COOKIE_NAME = 'scpms_token';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET is missing or too short. Set it in .env.local');
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(user) {
  return new SignJWT({ uid: user.user_id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export function setAuthCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearAuthCookie(response) {
  response.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/**
 * Reads the login cookie and returns the CURRENT user row from the database
 * (so a blocked user or a changed role takes effect immediately), or null.
 */
export async function getSessionUser(req) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const { rows } = await query(
      `SELECT user_id, name, email, phone, role, status FROM users WHERE user_id = $1`,
      [payload.uid]
    );
    const user = rows[0];
    if (!user || user.status !== 'Active') return null;
    return user;
  } catch {
    return null;
  }
}
