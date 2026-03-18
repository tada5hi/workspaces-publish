import {
    describe, expect, it,
} from 'vitest';
import { OidcTokenProvider } from '../../src/core';

function createFakeFetch(responses: Array<{ ok: boolean; status: number; body: any }>) {
    let callIndex = 0;
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    const fetchFn = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        const response = responses[callIndex++];
        return {
            ok: response.ok,
            status: response.status,
            statusText: response.ok ? 'OK' : 'Error',
            json: async () => response.body,
        } as Response;
    };

    return { fetchFn, calls };
}

describe('OidcTokenProvider', () => {
    it('should fetch OIDC token and exchange with npm registry', async () => {
        const { fetchFn, calls } = createFakeFetch([
            { ok: true, status: 200, body: { value: 'oidc-id-token-123' } },
            { ok: true, status: 201, body: { token: 'npm-short-lived-token' } },
        ]);

        const provider = new OidcTokenProvider({
            requestUrl: 'https://actions.github.com/oidc/token?api-version=1.0',
            requestToken: 'github-bearer-token',
            fetchFn,
        });

        const token = await provider.getToken('@scope/my-pkg', 'https://registry.npmjs.org/');

        expect(token).toEqual('npm-short-lived-token');
        expect(calls.length).toEqual(2);

        // Step 1: OIDC token request to GitHub
        expect(calls[0].url).toContain('audience=npm%3Aregistry.npmjs.org');
        expect(calls[0].url).toContain('&audience=');
        expect(calls[0].init?.headers).toEqual(
            expect.objectContaining({ Authorization: 'Bearer github-bearer-token' }),
        );

        // Step 2: Token exchange with npm registry
        expect(calls[1].url).toContain('/-/npm/v1/oidc/token/exchange/package/@scope%2Fmy-pkg');
        expect(calls[1].init?.method).toEqual('POST');
        expect(calls[1].init?.headers).toEqual(
            expect.objectContaining({ Authorization: 'Bearer oidc-id-token-123' }),
        );
        // Should NOT send Content-Type since there is no body
        expect(calls[1].init?.headers).not.toEqual(
            expect.objectContaining({ 'Content-Type': expect.any(String) }),
        );
    });

    it('should cache tokens for repeated calls to same package', async () => {
        const { fetchFn, calls } = createFakeFetch([
            { ok: true, status: 200, body: { value: 'oidc-token' } },
            { ok: true, status: 201, body: { token: 'cached-token' } },
        ]);

        const provider = new OidcTokenProvider({
            requestUrl: 'https://actions.github.com/oidc/token?api-version=1.0',
            requestToken: 'bearer',
            fetchFn,
        });

        const token1 = await provider.getToken('pkg-a', 'https://registry.npmjs.org/');
        const token2 = await provider.getToken('pkg-a', 'https://registry.npmjs.org/');

        expect(token1).toEqual('cached-token');
        expect(token2).toEqual('cached-token');
        // Only 2 HTTP calls total (not 4), proving cache works
        expect(calls.length).toEqual(2);
    });

    it('should fetch separate tokens for different packages', async () => {
        const { fetchFn, calls } = createFakeFetch([
            { ok: true, status: 200, body: { value: 'oidc-1' } },
            { ok: true, status: 201, body: { token: 'token-a' } },
            { ok: true, status: 200, body: { value: 'oidc-2' } },
            { ok: true, status: 201, body: { token: 'token-b' } },
        ]);

        const provider = new OidcTokenProvider({
            requestUrl: 'https://actions.github.com/oidc/token?v=1',
            requestToken: 'bearer',
            fetchFn,
        });

        const tokenA = await provider.getToken('pkg-a', 'https://registry.npmjs.org/');
        const tokenB = await provider.getToken('pkg-b', 'https://registry.npmjs.org/');

        expect(tokenA).toEqual('token-a');
        expect(tokenB).toEqual('token-b');
        expect(calls.length).toEqual(4);
    });

    it('should throw when OIDC token fetch fails', async () => {
        const { fetchFn } = createFakeFetch([
            { ok: false, status: 401, body: { error: 'unauthorized' } },
        ]);

        const provider = new OidcTokenProvider({
            requestUrl: 'https://actions.github.com/oidc/token',
            requestToken: 'bad-token',
            fetchFn,
        });

        await expect(
            provider.getToken('pkg-a', 'https://registry.npmjs.org/'),
        ).rejects.toThrow('Failed to fetch OIDC token from GitHub');
    });

    it('should throw when npm token exchange fails', async () => {
        const { fetchFn } = createFakeFetch([
            { ok: true, status: 200, body: { value: 'oidc-token' } },
            { ok: false, status: 404, body: { error: 'package not found' } },
        ]);

        const provider = new OidcTokenProvider({
            requestUrl: 'https://actions.github.com/oidc/token',
            requestToken: 'bearer',
            fetchFn,
        });

        await expect(
            provider.getToken('pkg-a', 'https://registry.npmjs.org/'),
        ).rejects.toThrow('Failed to exchange OIDC token with npm registry');
    });

    it('should construct correct audience from registry URL', async () => {
        const { fetchFn, calls } = createFakeFetch([
            { ok: true, status: 200, body: { value: 'token' } },
            { ok: true, status: 201, body: { token: 't' } },
        ]);

        const provider = new OidcTokenProvider({
            requestUrl: 'https://actions.github.com/oidc/token?v=1',
            requestToken: 'bearer',
            fetchFn,
        });

        await provider.getToken('pkg', 'https://npm.pkg.github.com/');

        expect(calls[0].url).toContain('audience=npm%3Anpm.pkg.github.com');
    });

    it('should use ? separator when requestUrl has no query string', async () => {
        const { fetchFn, calls } = createFakeFetch([
            { ok: true, status: 200, body: { value: 'token' } },
            { ok: true, status: 201, body: { token: 't' } },
        ]);

        const provider = new OidcTokenProvider({
            requestUrl: 'https://actions.github.com/oidc/token',
            requestToken: 'bearer',
            fetchFn,
        });

        await provider.getToken('pkg', 'https://registry.npmjs.org/');

        expect(calls[0].url).toEqual(
            'https://actions.github.com/oidc/token?audience=npm%3Aregistry.npmjs.org',
        );
    });

    it('should encode unscoped package names correctly', async () => {
        const { fetchFn, calls } = createFakeFetch([
            { ok: true, status: 200, body: { value: 'token' } },
            { ok: true, status: 201, body: { token: 't' } },
        ]);

        const provider = new OidcTokenProvider({
            requestUrl: 'https://actions.github.com/oidc/token?v=1',
            requestToken: 'bearer',
            fetchFn,
        });

        await provider.getToken('my-package', 'https://registry.npmjs.org/');

        expect(calls[1].url).toContain('/-/npm/v1/oidc/token/exchange/package/my-package');
    });
});
