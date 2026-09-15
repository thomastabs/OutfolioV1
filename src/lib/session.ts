import crypto from 'node:crypto';
import type { Request, Response } from 'express';

export type RegisteredUserSessionInput = {
  id: string;
  username: string;
  email: string;
};

export type SessionResult = {
  expiresAt: string;
};

export const SESSION_COOKIE_NAME = 'next-auth.session-token';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = {
  userId: string;
  username: string;
  email: string;
  expiresAt: string;
};

export type SessionValidationResult =
  | {
      valid: true;
      userId: string;
      username: string;
      email: string;
      expiresAt: string;
    }
  | {
      valid: false;
      reason: 'missing' | 'invalid' | 'expired';
    };

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  };
}

function signingSecret() {
  return process.env.NEXTAUTH_SECRET || 'outfolio-local-session-secret';
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(payload: string) {
  return crypto.createHmac('sha256', signingSecret()).update(payload).digest('base64url');
}

function createSessionToken(payload: SessionPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function readCookie(req: Pick<Request, 'headers'>, name: string) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return '';

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const cookie = cookies.find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : '';
}

export async function establishRegistrationSession(
  user: RegisteredUserSessionInput,
  res: Response,
): Promise<SessionResult> {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const sessionToken = createSessionToken({
    userId: user.id,
    username: user.username,
    email: user.email,
    expiresAt: expiresAt.toISOString(),
  });

  res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions(expiresAt));

  return { expiresAt: expiresAt.toISOString() };
}

export function validateSession(req: Pick<Request, 'headers'>, now = new Date()): SessionValidationResult {
  const token = readCookie(req, SESSION_COOKIE_NAME);
  if (!token) {
    return { valid: false, reason: 'missing' };
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature || sign(encodedPayload) !== signature) {
    return { valid: false, reason: 'invalid' };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<SessionPayload>;

    if (!payload.userId || !payload.username || !payload.email || !payload.expiresAt) {
      return { valid: false, reason: 'invalid' };
    }

    if (new Date(payload.expiresAt).getTime() <= now.getTime()) {
      return { valid: false, reason: 'expired' };
    }

    return {
      valid: true,
      userId: payload.userId,
      username: payload.username,
      email: payload.email,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return { valid: false, reason: 'invalid' };
  }
}

export function clearSessionCookie(res: Response) {
  res.cookie(SESSION_COOKIE_NAME, '', sessionCookieOptions(new Date(0)));
}
