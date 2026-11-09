import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { callbackUrl, newState, verifyState } from './oauth.ts';

describe('OAuth state', () => {
  it('returns the saved path only when the state matches the cookie', () => {
    const { nonce, cookie } = newState('/repositories/a/b');
    assert.equal(verifyState(cookie, nonce), '/repositories/a/b');
    assert.equal(verifyState(cookie, `${nonce}x`), null);
    assert.equal(verifyState(cookie, newState('/').nonce), null);
    assert.equal(verifyState(undefined, nonce), null);
    assert.equal(verifyState('not-base64-json', nonce), null);
  });
});

describe('callbackUrl', () => {
  it('uses the public URL when set and the request origin otherwise', () => {
    const request = new Request('http://127.0.0.1:3000/api/auth/github/login?next=/');
    assert.equal(callbackUrl(request, {}), 'http://127.0.0.1:3000/api/auth/github/callback');
    assert.equal(
      callbackUrl(request, { SPECTRUM_PUBLIC_URL: 'https://spectrum.example/' }),
      'https://spectrum.example/api/auth/github/callback',
    );
  });

  it('keeps the host the user opened rather than the one Next.js reports', () => {
    const request = new Request('http://localhost:3000/api/auth/github/login', {
      headers: { host: '127.0.0.1:3000' },
    });
    assert.equal(callbackUrl(request, {}), 'http://127.0.0.1:3000/api/auth/github/callback');
  });

  it('ignores a malformed Host header', () => {
    const request = new Request('http://localhost:3000/api/auth/github/login', {
      headers: { host: 'evil.example/path?x=' },
    });
    assert.equal(callbackUrl(request, {}), 'http://localhost:3000/api/auth/github/callback');
  });
});
