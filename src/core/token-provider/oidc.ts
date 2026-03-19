/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ITokenProvider } from './types.ts';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

type OidcTokenProviderOptions = {
    requestUrl: string;
    requestToken: string;
    fetchFn?: FetchFn;
    maxRetries?: number;
    retryDelayMs?: number;
};

export class OidcTokenProvider implements ITokenProvider {
    private readonly requestUrl: string;

    private readonly requestToken: string;

    private readonly fetchFn: FetchFn;

    private readonly maxRetries: number;

    private readonly retryDelayMs: number;

    private readonly tokenCache: Map<string, string>;

    // ----------------------------------------------------

    constructor(options: OidcTokenProviderOptions) {
        this.requestUrl = options.requestUrl;
        this.requestToken = options.requestToken;
        this.fetchFn = options.fetchFn ?? globalThis.fetch;
        this.maxRetries = options.maxRetries ?? 2;
        this.retryDelayMs = options.retryDelayMs ?? 1000;
        this.tokenCache = new Map();
    }

    // ----------------------------------------------------

    async getToken(packageName: string, registry: string): Promise<string | undefined> {
        const cacheKey = `${packageName}@${registry}`;
        const cached = this.tokenCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const audience = `npm:${new URL(registry).host}`;

        const separator = this.requestUrl.includes('?') ? '&' : '?';
        const oidcUrl = `${this.requestUrl}${separator}audience=${encodeURIComponent(audience)}`;

        const oidcResponse = await this.fetchWithRetry(oidcUrl, {
            headers: { Authorization: `Bearer ${this.requestToken}` },
        });

        if (!oidcResponse.ok) {
            throw new Error(
                `Failed to fetch OIDC token from GitHub: ${oidcResponse.status} ${oidcResponse.statusText}`,
            );
        }

        const oidcBody = await oidcResponse.json() as { value?: string };
        const idToken = oidcBody.value;
        if (!idToken) {
            throw new Error('OIDC response did not contain a valid token');
        }

        const encodedName = encodeURIComponent(packageName).replace(/^%40/, '@');
        const exchangeUrl = new URL(
            `/-/npm/v1/oidc/token/exchange/package/${encodedName}`,
            registry,
        ).toString();

        const exchangeResponse = await this.fetchWithRetry(exchangeUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${idToken}`,
            },
        });

        if (!exchangeResponse.ok) {
            throw new Error(
                `Failed to exchange OIDC token with npm registry: ${exchangeResponse.status} ${exchangeResponse.statusText}`,
            );
        }

        const { token } = await exchangeResponse.json() as { token?: string };
        if (!token) {
            throw new Error('Token exchange response did not contain a valid token');
        }

        this.tokenCache.set(cacheKey, token);

        return token;
    }

    // ----------------------------------------------------

    private async fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this.fetchFn(url, init);
                if (response.ok || response.status < 500) {
                    return response;
                }

                if (attempt < this.maxRetries) {
                    await this.delay(this.retryDelayMs * (attempt + 1));
                    continue;
                }

                return response;
            } catch (e) {
                if (attempt >= this.maxRetries) {
                    throw e;
                }

                await this.delay(this.retryDelayMs * (attempt + 1));
            }
        }

        throw new Error('Unreachable');
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}
