import {
    describe, expect, it,
} from 'vitest';
import {
    MemoryFileSystem, MemoryPublisher,
    MemoryRegistryClient, MemoryTokenProvider, NoopLogger,
} from '../../src/core';
import { publish } from '../../src/module';

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
        dryRun: true,
        fileSystem: createTestFileSystem(),
        registryClient: new MemoryRegistryClient(),
        publisher: new MemoryPublisher(),
        tokenProvider: new MemoryTokenProvider('test-token'),
        logger: new NoopLogger(),
        ...overrides,
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
            dryRun: true,
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
});
