import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';
import hapic, { isObject } from 'hapic';
import { publish } from '../../src';

describe('src/module', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mock('libnpmpublish', async (importOriginal) => {
            const mod = await importOriginal();

            return {
                ...(isObject(mod) ? mod : {}),
                publish: () => Promise.resolve(),
            };
        });

        vi.spyOn(hapic, 'get').mockImplementation(
            async () => new Response(JSON.stringify({
                versions: {},
            })),
        );
    });

    it('should publish packages', async () => {
        const packages = await publish({
            cwd: 'test/data',
            token: 'foo',
            dryRun: true,
        });

        expect(packages.length).toEqual(3);

        const [pkgRoot, pkgA, pkgC] = packages;

        expect(pkgRoot?.modified).toBeFalsy();

        expect(pkgA?.modified).toBeTruthy();
        expect(pkgA?.content?.dependencies?.['pkg-b']).toEqual('^1.0.0');

        expect(pkgC?.modified).toBeTruthy();
        expect(pkgC?.content?.dependencies?.['pkg-b']).toEqual('~1.0.0');
        expect(pkgC?.content?.peerDependencies?.['pkg-a']).toEqual('*');
    });
});
