import {
    describe, expect, it,
} from 'vitest';
import { ChainTokenProvider, MemoryTokenProvider } from '../../src/core/index.ts';

describe('ChainTokenProvider', () => {
    it('should return token from first provider that has one', async () => {
        const chain = new ChainTokenProvider([
            new MemoryTokenProvider(undefined),
            new MemoryTokenProvider('second-token'),
            new MemoryTokenProvider('third-token'),
        ]);

        const token = await chain.getToken('pkg-a', 'https://registry.npmjs.org/');

        expect(token).toEqual('second-token');
    });

    it('should return token from first provider if available', async () => {
        const chain = new ChainTokenProvider([
            new MemoryTokenProvider('first-token'),
            new MemoryTokenProvider('second-token'),
        ]);

        const token = await chain.getToken('pkg-a', 'https://registry.npmjs.org/');

        expect(token).toEqual('first-token');
    });

    it('should return undefined when no provider has a token', async () => {
        const chain = new ChainTokenProvider([
            new MemoryTokenProvider(undefined),
            new MemoryTokenProvider(undefined),
        ]);

        const token = await chain.getToken('pkg-a', 'https://registry.npmjs.org/');

        expect(token).toBeUndefined();
    });

    it('should return undefined with empty providers list', async () => {
        const chain = new ChainTokenProvider([]);

        const token = await chain.getToken('pkg-a', 'https://registry.npmjs.org/');

        expect(token).toBeUndefined();
    });
});
