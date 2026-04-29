import {
    describe, 
    expect, 
    it,
} from 'vitest';
import { OidcTokenProvider } from '../../src/core/index.ts';

function createFakeFetch(responses: Array<{
    ok: boolean; 
    status: number; 
    body: any 
}>) {
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

const OIDC_URL = 'https://actions.github.com/oidc/token';
const OIDC_URL_QS = `${OIDC_URL}?v=1`;
const NPM_REGISTRY = 'https://registry.npmjs.org/';
const GITHUB_REGISTRY = 'https://npm.pkg.github.com/';

function ok(body: any, status = 200) {
    return {
        ok: true, 
        status, 
        body, 
    };
}

function fail(status: number) {
    return {
        ok: false, 
        status, 
        body: {}, 
    };
}

function createProvider(
    fetchFn: typeof globalThis.fetch,
    options: { url?: string; maxRetries?: number } = {},
) {
    return new OidcTokenProvider({
        requestUrl: options.url ?? OIDC_URL_QS,
        requestToken: 'bearer',
        fetchFn,
        maxRetries: options.maxRetries,
        retryDelayMs: 0,
    });
}

describe('OidcTokenProvider', () => {
    it('should fetch OIDC token and exchange with npm registry', async () => {
        const { fetchFn, calls } = createFakeFetch([
            ok({ value: 'oidc-id-token-123' }),
            ok({ token: 'npm-short-lived-token' }, 201),
        ]);

        const provider = new OidcTokenProvider({
            requestUrl: `${OIDC_URL}?api-version=1.0`,
            requestToken: 'github-bearer-token',
            fetchFn,
            retryDelayMs: 0,
        });

        const token = await provider.getToken('@scope/my-pkg', NPM_REGISTRY);

        expect(token).toEqual('npm-short-lived-token');
        expect(calls).toHaveLength(2);
        expect(calls[0].url).toContain('audience=npm%3Aregistry.npmjs.org');
        expect(calls[0].url).toContain('&audience=');
        expect(calls[0].init?.headers).toEqual(
            expect.objectContaining({ Authorization: 'Bearer github-bearer-token' }),
        );
        expect(calls[1].url).toContain('/-/npm/v1/oidc/token/exchange/package/@scope%2Fmy-pkg');
        expect(calls[1].init?.method).toEqual('POST');
    });

    it('should cache tokens for repeated calls to same package and registry', async () => {
        const { fetchFn, calls } = createFakeFetch([
            ok({ value: 'oidc-token' }),
            ok({ token: 'cached-token' }, 201),
        ]);

        const provider = createProvider(fetchFn);
        const token1 = await provider.getToken('pkg-a', NPM_REGISTRY);
        const token2 = await provider.getToken('pkg-a', NPM_REGISTRY);

        expect(token1).toEqual('cached-token');
        expect(token2).toEqual('cached-token');
        expect(calls).toHaveLength(2);
    });

    it('should fetch separate tokens for different packages', async () => {
        const { fetchFn, calls } = createFakeFetch([
            ok({ value: 'oidc-1' }), 
            ok({ token: 'token-a' }, 201),
            ok({ value: 'oidc-2' }), 
            ok({ token: 'token-b' }, 201),
        ]);

        const provider = createProvider(fetchFn);

        expect(await provider.getToken('pkg-a', NPM_REGISTRY)).toEqual('token-a');
        expect(await provider.getToken('pkg-b', NPM_REGISTRY)).toEqual('token-b');
        expect(calls).toHaveLength(4);
    });

    it('should use separate cache entries for different registries', async () => {
        const { fetchFn, calls } = createFakeFetch([
            ok({ value: 'oidc-1' }), 
            ok({ token: 'npm-token' }, 201),
            ok({ value: 'oidc-2' }), 
            ok({ token: 'github-token' }, 201),
        ]);

        const provider = createProvider(fetchFn);

        expect(await provider.getToken('pkg-a', NPM_REGISTRY)).toEqual('npm-token');
        expect(await provider.getToken('pkg-a', GITHUB_REGISTRY)).toEqual('github-token');
        expect(calls).toHaveLength(4);
    });

    it('should throw when OIDC token fetch fails', async () => {
        const { fetchFn } = createFakeFetch([fail(401)]);
        const provider = createProvider(fetchFn, { maxRetries: 0 });

        await expect(
            provider.getToken('pkg-a', NPM_REGISTRY),
        ).rejects.toThrow('Failed to fetch OIDC token from GitHub');
    });

    it('should throw when npm token exchange fails', async () => {
        const { fetchFn } = createFakeFetch([
            ok({ value: 'oidc-token' }),
            fail(404),
        ]);
        const provider = createProvider(fetchFn, { maxRetries: 0 });

        await expect(
            provider.getToken('pkg-a', NPM_REGISTRY),
        ).rejects.toThrow('Failed to exchange OIDC token with npm registry');
    });

    it('should construct correct audience from registry URL', async () => {
        const { fetchFn, calls } = createFakeFetch([
            ok({ value: 'token' }), 
            ok({ token: 't' }, 201),
        ]);

        const provider = createProvider(fetchFn);
        await provider.getToken('pkg', GITHUB_REGISTRY);

        expect(calls[0].url).toContain('audience=npm%3Anpm.pkg.github.com');
    });

    it('should use ? separator when requestUrl has no query string', async () => {
        const { fetchFn, calls } = createFakeFetch([
            ok({ value: 'token' }), 
            ok({ token: 't' }, 201),
        ]);

        const provider = createProvider(fetchFn, { url: OIDC_URL });
        await provider.getToken('pkg', NPM_REGISTRY);

        expect(calls[0].url).toEqual(
            `${OIDC_URL}?audience=npm%3Aregistry.npmjs.org`,
        );
    });

    it('should encode unscoped package names correctly', async () => {
        const { fetchFn, calls } = createFakeFetch([
            ok({ value: 'token' }), 
            ok({ token: 't' }, 201),
        ]);

        const provider = createProvider(fetchFn);
        await provider.getToken('my-package', NPM_REGISTRY);

        expect(calls[1].url).toContain('/-/npm/v1/oidc/token/exchange/package/my-package');
    });

    it('should retry on 5xx and succeed', async () => {
        const { fetchFn } = createFakeFetch([
            fail(500),
            ok({ value: 'oidc-token' }),
            ok({ token: 'npm-token' }, 201),
        ]);

        const provider = createProvider(fetchFn, { maxRetries: 1 });
        expect(await provider.getToken('pkg-a', NPM_REGISTRY)).toEqual('npm-token');
    });

    it('should not retry on 4xx errors', async () => {
        const { fetchFn, calls } = createFakeFetch([fail(403)]);
        const provider = createProvider(fetchFn, { maxRetries: 2 });

        await expect(
            provider.getToken('pkg-a', NPM_REGISTRY),
        ).rejects.toThrow('Failed to fetch OIDC token from GitHub');
        expect(calls).toHaveLength(1);
    });

    it('should retry on network error and succeed', async () => {
        let callCount = 0;
        const fetchFn = async () => {
            callCount++;
            if (callCount === 1) throw new Error('ECONNRESET');
            if (callCount === 2) {return {
                ok: true, 
                status: 200, 
                statusText: 'OK', 
                json: async () => ({ value: 'oidc-token' }), 
            } as Response;}
            return {
                ok: true, 
                status: 201, 
                statusText: 'OK', 
                json: async () => ({ token: 'npm-token' }), 
            } as Response;
        };

        const provider = createProvider(fetchFn, { maxRetries: 1 });
        expect(await provider.getToken('pkg-a', NPM_REGISTRY)).toEqual('npm-token');
    });

    it('should fail after max retries exhausted', async () => {
        const { fetchFn } = createFakeFetch([fail(500), fail(500), fail(500)]);
        const provider = createProvider(fetchFn, { maxRetries: 2 });

        await expect(
            provider.getToken('pkg-a', NPM_REGISTRY),
        ).rejects.toThrow('Failed to fetch OIDC token from GitHub: 500');
    });
});
