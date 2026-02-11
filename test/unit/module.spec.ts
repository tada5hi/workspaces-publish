import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';
import hapic from 'hapic';
import libnpmpublish from 'libnpmpublish';
import { publish } from '../../src';

describe('src/module', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        vi.spyOn(libnpmpublish, 'publish').mockImplementation(async () => true);
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

    it('should throw on no token', async () => {
        try {
            await publish({});
            expect(0).toEqual(1);
        } catch (e) {
            expect(e).toBeDefined();
            expect((e as Record<string, any>).message).toEqual('A token must be provided.');
        }
    });
});
