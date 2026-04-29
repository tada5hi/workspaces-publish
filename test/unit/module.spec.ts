import {
    describe, expect, it,
} from 'vitest';
import {
    MemoryFileSystem, MemoryPublisher,
    MemoryRegistryClient, MemoryTokenProvider, NoopLogger,
} from '../../src/core/index.ts';
import type { ILogger } from '../../src/core/index.ts';
import { publish } from '../../src/module.ts';

function createTestFileSystem() {
    return new MemoryFileSystem({
        '/project/package.json': JSON.stringify({
            name: 'foo',
            version: '1.0.0',
            workspaces: ['packages/*'],
        }),
        '/project/packages/pkgA/package.json': JSON.stringify({
            name: 'pkg-a',
            version: '1.0.0',
            dependencies: { 'pkg-b': 'workspace:^' },
        }),
        '/project/packages/pkgB/package.json': JSON.stringify({
            name: 'pkg-b',
            private: true,
            version: '1.0.0',
        }),
        '/project/packages/pkgC/package.json': JSON.stringify({
            name: 'pkg-c',
            version: '1.0.0',
            dependencies: { 'pkg-b': 'workspace:~' },
            peerDependencies: { 'pkg-a': '*' },
        }),
    });
}

function createTestOptions(overrides: Record<string, any> = {}) {
    return {
        cwd: '/project',
        fileSystem: createTestFileSystem(),
        registryClient: new MemoryRegistryClient(),
        publisher: new MemoryPublisher(),
        tokenProvider: new MemoryTokenProvider('test-token'),
        logger: new NoopLogger(),
        ...overrides,
    };
}

function createSpyLogger(): ILogger & { warnings: string[] } {
    const warnings: string[] = [];
    return {
        warnings,
        info: () => {},
        success: () => {},
        warn: (msg: string) => { warnings.push(msg); },
        error: () => {},
    };
}

describe('src/module', () => {
    it('should publish packages', async () => {
        const packages = await publish(createTestOptions());

        expect(packages.length).toEqual(3);

        const [pkgRoot, pkgA, pkgC] = packages;

        expect(pkgRoot?.modified).toBeFalsy();

        expect(pkgA?.modified).toBeTruthy();
        expect(pkgA?.content?.dependencies?.['pkg-b']).toEqual('^1.0.0');

        expect(pkgC?.modified).toBeTruthy();
        expect(pkgC?.content?.dependencies?.['pkg-b']).toEqual('~1.0.0');
        expect(pkgC?.content?.peerDependencies?.['pkg-a']).toEqual('*');
    });

    it('should skip already published packages', async () => {
        const registryClient = new MemoryRegistryClient({
            'foo': {
                name: 'foo',
                'dist-tags': {},
                versions: { '1.0.0': { name: 'foo', version: '1.0.0' } },
            },
            'pkg-a': {
                name: 'pkg-a',
                'dist-tags': {},
                versions: { '1.0.0': { name: 'pkg-a', version: '1.0.0' } },
            },
            'pkg-c': {
                name: 'pkg-c',
                'dist-tags': {},
                versions: { '1.0.0': { name: 'pkg-c', version: '1.0.0' } },
            },
        });

        const packages = await publish(createTestOptions({ registryClient }));

        expect(packages.length).toEqual(0);
    });

    it('should skip private packages', async () => {
        const fs = new MemoryFileSystem({
            '/project/package.json': JSON.stringify({
                name: 'root',
                version: '1.0.0',
                private: true,
                workspaces: ['packages/*'],
            }),
            '/project/packages/pkgA/package.json': JSON.stringify({
                name: 'pkg-a',
                version: '1.0.0',
                private: true,
            }),
        });

        const packages = await publish(createTestOptions({
            fileSystem: fs,
            rootPackage: false,
        }));

        expect(packages.length).toEqual(0);
    });

    it('should not write package.json in dryRun mode', async () => {
        const fs = createTestFileSystem();

        await publish(createTestOptions({ fileSystem: fs, dryRun: true }));

        const pkgA = JSON.parse(await fs.readFile('/project/packages/pkgA/package.json'));
        expect(pkgA.dependencies['pkg-b']).toEqual('workspace:^');
    });

    it('should not call publisher in dryRun mode', async () => {
        const publisher = new MemoryPublisher();

        const packages = await publish(createTestOptions({ publisher, dryRun: true }));

        expect(packages.length).toEqual(3);
        expect(publisher.published.length).toEqual(0);
    });

    it('should write modified package.json when not in dryRun mode', async () => {
        const fs = createTestFileSystem();

        await publish(createTestOptions({ fileSystem: fs, dryRun: false }));

        const pkgA = JSON.parse(await fs.readFile('/project/packages/pkgA/package.json'));
        expect(pkgA.dependencies['pkg-b']).toEqual('^1.0.0');
    });

    it('should record published packages in publisher', async () => {
        const publisher = new MemoryPublisher();

        await publish(createTestOptions({ publisher }));

        expect(publisher.published.length).toEqual(3);
        const names = publisher.published.map((p) => p.manifest.name);
        expect(names).toContain('foo');
        expect(names).toContain('pkg-a');
        expect(names).toContain('pkg-c');
    });

    it('should forward explicit tag to all published packages', async () => {
        const publisher = new MemoryPublisher();

        await publish(createTestOptions({ publisher, tag: 'next' }));

        expect(publisher.published.length).toEqual(3);
        for (const p of publisher.published) {
            expect(p.options.tag).toEqual('next');
        }
    });

    it('should auto-detect prerelease tag per package', async () => {
        const publisher = new MemoryPublisher();
        const fs = new MemoryFileSystem({
            '/project/package.json': JSON.stringify({
                name: 'foo',
                version: '2.0.0-beta.0',
                workspaces: ['packages/*'],
            }),
            '/project/packages/pkgA/package.json': JSON.stringify({
                name: 'pkg-a',
                version: '1.0.0',
            }),
        });

        await publish(createTestOptions({ publisher, fileSystem: fs }));

        const root = publisher.published.find((p) => p.manifest.name === 'foo');
        const a = publisher.published.find((p) => p.manifest.name === 'pkg-a');
        expect(root?.options.tag).toEqual('beta');
        expect(a?.options.tag).toBeUndefined();
    });

    it('should not include root package when rootPackage is false', async () => {
        const packages = await publish(createTestOptions({ rootPackage: false }));

        expect(packages.length).toEqual(2);
        const names = packages.map((p) => p.content.name);
        expect(names).not.toContain('foo');
    });

    it('should publish without a token', async () => {
        const publisher = new MemoryPublisher();
        const fs = new MemoryFileSystem({
            '/project/package.json': JSON.stringify({
                name: 'solo',
                version: '1.0.0',
            }),
        });

        const packages = await publish({
            cwd: '/project',
            fileSystem: fs,
            registryClient: new MemoryRegistryClient(),
            publisher,
            tokenProvider: new MemoryTokenProvider(undefined),
            logger: new NoopLogger(),
        });

        expect(packages.length).toEqual(1);
        expect(publisher.published.length).toEqual(1);
        // Auth token key should not be present in publish options
        const opts = publisher.published[0].options;
        const authKeys = Object.keys(opts).filter((k) => k.includes(':_authToken'));
        expect(authKeys.length).toEqual(0);
    });

    it('should throw descriptive error on invalid root package.json JSON', async () => {
        const fs = new MemoryFileSystem({
            '/project/package.json': '{ invalid json',
        });

        await expect(publish(createTestOptions({ fileSystem: fs }))).rejects.toThrow(
            'Invalid JSON in package.json at /project/package.json',
        );
    });

    it('should return empty array when no workspaces and rootPackage is false', async () => {
        const fs = new MemoryFileSystem({
            '/project/package.json': JSON.stringify({
                name: 'solo',
                version: '1.0.0',
            }),
        });

        const packages = await publish(createTestOptions({
            fileSystem: fs,
            rootPackage: false,
        }));

        expect(packages.length).toEqual(0);
    });

    it('should skip packages with unresolved workspace dependencies', async () => {
        const logger = createSpyLogger();
        const packages = await publish(createTestOptions({
            fileSystem: new MemoryFileSystem({
                '/project/package.json': JSON.stringify({
                    name: 'root', version: '1.0.0', workspaces: ['packages/*'],
                }),
                '/project/packages/pkgA/package.json': JSON.stringify({
                    name: 'pkg-a', version: '1.0.0',
                    dependencies: { 'pkg-missing': 'workspace:^' },
                }),
                '/project/packages/pkgB/package.json': JSON.stringify({
                    name: 'pkg-b', version: '1.0.0',
                }),
            }),
            logger,
            rootPackage: false,
        }));

        const names = packages.map((p) => p.content.name);
        expect(names).not.toContain('pkg-a');
        expect(names).toContain('pkg-b');
        expect(logger.warnings.some((w) => w.includes('pkg-a') && w.includes('unresolved'))).toBe(true);
    });

    it('should handle empty workspaces array', async () => {
        const fs = new MemoryFileSystem({
            '/project/package.json': JSON.stringify({
                name: 'root',
                version: '1.0.0',
                workspaces: [],
            }),
        });

        const packages = await publish(createTestOptions({
            fileSystem: fs,
            rootPackage: false,
        }));

        expect(packages.length).toEqual(0);
    });

    it('should skip invalid workspace package.json and process valid ones', async () => {
        const fs = new MemoryFileSystem({
            '/project/package.json': JSON.stringify({
                name: 'root',
                version: '1.0.0',
                workspaces: ['packages/*'],
            }),
            '/project/packages/pkgA/package.json': '{ broken json',
            '/project/packages/pkgB/package.json': JSON.stringify({
                name: 'pkg-b',
                version: '1.0.0',
            }),
        });

        const packages = await publish(createTestOptions({
            fileSystem: fs,
            rootPackage: false,
        }));

        expect(packages.length).toEqual(1);
        expect(packages[0].content.name).toEqual('pkg-b');
    });

    it('should skip package when writeFile fails during dependency rewrite', async () => {
        const baseFs = new MemoryFileSystem({
            '/project/package.json': JSON.stringify({
                name: 'root', version: '1.0.0', workspaces: ['packages/*'],
            }),
            '/project/packages/pkgA/package.json': JSON.stringify({
                name: 'pkg-a', version: '1.0.0',
                dependencies: { 'pkg-b': 'workspace:^' },
            }),
            '/project/packages/pkgB/package.json': JSON.stringify({
                name: 'pkg-b', version: '1.0.0',
            }),
        });

        const logger = createSpyLogger();
        const packages = await publish(createTestOptions({
            dryRun: false,
            fileSystem: {
                readFile: (fp: string) => baseFs.readFile(fp),
                glob: (p: string[], o: { cwd?: string; ignore?: string[] }) => baseFs.glob(p, o),
                writeFile: () => Promise.reject(new Error('disk full')),
            },
            logger,
            rootPackage: false,
        }));

        const names = packages.map((p) => p.content.name);
        expect(names).not.toContain('pkg-a');
        expect(names).toContain('pkg-b');
        expect(logger.warnings.some((w) => w.includes('pkg-a') && w.includes('disk full'))).toBe(true);
    });
});
