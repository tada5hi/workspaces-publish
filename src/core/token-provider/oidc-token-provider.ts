import type { ITokenProvider } from './types';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

type OidcTokenProviderOptions = {
    requestUrl: string;
    requestToken: string;
    fetchFn?: FetchFn;
};

export class OidcTokenProvider implements ITokenProvider {
    private requestUrl: string;

    private requestToken: string;

    private fetchFn: FetchFn;

    private tokenCache: Map<string, string>;

    constructor(options: OidcTokenProviderOptions) {
        this.requestUrl = options.requestUrl;
        this.requestToken = options.requestToken;
        this.fetchFn = options.fetchFn ?? globalThis.fetch;
        this.tokenCache = new Map();
    }

    async getToken(packageName: string, registry: string): Promise<string | undefined> {
        const cached = this.tokenCache.get(packageName);
        if (cached) {
            return cached;
        }

        const audience = `npm:${new URL(registry).host}`;

        const separator = this.requestUrl.includes('?') ? '&' : '?';
        const oidcUrl = `${this.requestUrl}${separator}audience=${encodeURIComponent(audience)}`;

        const oidcResponse = await this.fetchFn(oidcUrl, {
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

        const exchangeResponse = await this.fetchFn(exchangeUrl, {
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

        this.tokenCache.set(packageName, token);

        return token;
    }
}
