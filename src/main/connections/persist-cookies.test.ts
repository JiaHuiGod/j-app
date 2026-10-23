import { describe, expect, it, vi } from 'vitest';
import type { SiteConnection } from '@shared/connections';
import type { Session } from 'electron';
import { persist115SessionCookies } from './persist-cookies';

const connection: SiteConnection = {
  id: '0f2a63a7-0a9f-4b0a-9d0b-6b8e1c1a2f5d',
  name: '115 网盘',
  loginUrl: 'https://115.com/',
  createdAt: '2026-10-21T13:00:00.000Z',
  lastLoginAt: null,
  pinned: false,
};

function createSession(cookies: unknown[]) {
  const set = vi
    .fn<(details: unknown) => Promise<void>>()
    .mockResolvedValue(undefined);
  const flushStore = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const session = {
    cookies: {
      get: vi.fn<() => Promise<unknown[]>>().mockResolvedValue(cookies),
      set,
      flushStore,
    },
  } as unknown as Session;

  return { session, set, flushStore };
}

describe('115 session cookie persistence', () => {
  it('promotes only known session auth cookies and preserves flags', async () => {
    const { session, set, flushStore } = createSession([
      {
        name: 'UID',
        value: 'user-id',
        domain: '.115.com',
        path: '/',
        session: true,
        secure: false,
        httpOnly: true,
        sameSite: 'lax',
      },
      {
        name: 'USERSESSIONID',
        value: 'persistent',
        domain: '.115.com',
        path: '/',
        session: false,
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
      },
      {
        name: 'acw_tc',
        value: 'guest',
        domain: '.115.com',
        path: '/',
        session: true,
        secure: false,
        httpOnly: true,
        sameSite: 'lax',
      },
    ]);

    await persist115SessionCookies(connection, session);

    expect(set).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'UID',
        domain: '.115.com',
        httpOnly: true,
        sameSite: 'lax',
        expirationDate: expect.any(Number),
      }),
    );
    expect(flushStore).toHaveBeenCalledOnce();
  });

  it('does nothing for non-115 connections', async () => {
    const { session, set, flushStore } = createSession([]);

    await persist115SessionCookies(
      { ...connection, loginUrl: 'https://example.com/' },
      session,
    );

    expect(set).not.toHaveBeenCalled();
    expect(flushStore).not.toHaveBeenCalled();
  });
});
