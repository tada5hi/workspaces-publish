import {
    afterEach, 
    describe, 
    expect, 
    it,
} from 'vitest';
import {
    EnvTokenProvider, 
    MemoryTokenProvider,
} from '../../src/core/index.ts';

describe('MemoryTokenProvider', () => {
    it('should return configured token', async () => {
        const provider = new MemoryTokenProvider('test-token');
        const token = await provider.getToken('pkg', 'https://registry.npmjs.org/');

        expect(token).toEqual('test-token');
    });

    it('should return same token regardless of package name', async () => {
        const provider = new MemoryTokenProvider('fixed');

        const a = await provider.getToken('pkg-a', 'https://registry.npmjs.org/');
        const b = await provider.getToken('pkg-b', 'https://registry.npmjs.org/');

        expect(a).toEqual('fixed');
        expect(b).toEqual('fixed');
    });

    it('should return undefined when no token configured', async () => {
        const provider = new MemoryTokenProvider();
        const token = await provider.getToken('pkg', 'https://registry.npmjs.org/');

        expect(token).toBeUndefined();
    });
});

describe('EnvTokenProvider', () => {
    const originalEnv = process.env.NODE_AUTH_TOKEN;

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.NODE_AUTH_TOKEN;
        } else {
            process.env.NODE_AUTH_TOKEN = originalEnv;
        }
    });

    it('should return NODE_AUTH_TOKEN from environment', async () => {
        process.env.NODE_AUTH_TOKEN = 'env-token-value';

        const provider = new EnvTokenProvider();
        const token = await provider.getToken('pkg', 'https://registry.npmjs.org/');

        expect(token).toEqual('env-token-value');
    });

    it('should return undefined when NODE_AUTH_TOKEN is not set', async () => {
        delete process.env.NODE_AUTH_TOKEN;

        const provider = new EnvTokenProvider();
        const token = await provider.getToken('pkg', 'https://registry.npmjs.org/');

        expect(token).toBeUndefined();
    });

    it('should return undefined when NODE_AUTH_TOKEN is empty string', async () => {
        process.env.NODE_AUTH_TOKEN = '';

        const provider = new EnvTokenProvider();
        const token = await provider.getToken('pkg', 'https://registry.npmjs.org/');

        expect(token).toBeUndefined();
    });
});
