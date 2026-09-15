import crypto from 'node:crypto';
import type { Response } from 'express';

export type RegisteredUserSessionInput = {
  id: string;
  username: string;
  email: string;
};

export type SessionResult = {
  expiresAt: string;
};

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function establishRegistrationSession(
  user: RegisteredUserSessionInput,
  res: Response,
): Promise<SessionResult> {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const tokenSeed = `${user.id}:${user.email}:${Date.now()}:${crypto.randomUUID()}`;
  const sessionToken = crypto.createHash('sha256').update(tokenSeed).digest('hex');

  res.cookie('next-auth.session-token', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  return { expiresAt: expiresAt.toISOString() };
}
