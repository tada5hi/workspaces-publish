import {
    describe, expect, it,
} from 'vitest';
import { MemoryPublisher, MemoryRegistryClient, NpmCliPublisher } from '../../src/core';
import {
    isPackagePublishable, isPackagePublished, publishPackage,
} from '../../src/package';
import type { Package } from '../../src/core/package/types';

describe('src/package', () => {
    describe('isPackagePublishable', () => {
        it('should return true for a valid package', () => {
            const pkg: Package = {
                path: '/project/packages/a',
                content: { name: 'pkg-a', version: '1.0.0' },
            };
            expect(isPackagePublishable(pkg)).toBe(true);
        });

        it('should return false for a private package', () => {
            const pkg: Package = {
                path: '/project/packages/a',
                content: { name: 'pkg-a', version: '1.0.0', private: true },
            };
            expect(isPackagePublishable(pkg)).toBe(false);
        });

        it('should return false for a package without a name', () => {
            const pkg: Package = {
                path: '/project/packages/a',
                content: { name: '', version: '1.0.0' },
            };
            expect(isPackagePublishable(pkg)).toBe(false);
        });

        it('should return false for a package without a version', () => {
            const pkg: Package = {
                path: '/project/packages/a',
                content: { name: 'pkg-a', version: '' },
            };
            expect(isPackagePublishable(pkg)).toBe(false);
        });
    });

    describe('isPackagePublished', () => {
        it('should return true when version exists in registry', async () => {
            const registry = new MemoryRegistryClient({
                'pkg-a': {
                    name: 'pkg-a',
                    'dist-tags': {},
                    versions: { '1.0.0': { name: 'pkg-a', version: '1.0.0' } },
                },
            });

            const pkg: Package = {
                path: '/project/packages/a',
                content: { name: 'pkg-a', version: '1.0.0' },
            };

            const result = await isPackagePublished(pkg, registry, {
                registry: 'https://registry.npmjs.org/',
            });
            expect(result).toBe(true);
        });

        it('should return false when version does not exist', async () => {
            const registry = new MemoryRegistryClient({
                'pkg-a': {
                    name: 'pkg-a',
                    'dist-tags': {},
                    versions: { '0.9.0': { name: 'pkg-a', version: '0.9.0' } },
                },
            });

            const pkg: Package = {
                path: '/project/packages/a',
                content: { name: 'pkg-a', version: '1.0.0' },
            };

            const result = await isPackagePublished(pkg, registry, {
                registry: 'https://registry.npmjs.org/',
            });
            expect(result).toBe(false);
        });

        it('should return false when package does not exist in registry', async () => {
            const registry = new MemoryRegistryClient();
            const pkg: Package = {
                path: '/project/packages/a',
                content: { name: 'pkg-a', version: '1.0.0' },
            };

            const result = await isPackagePublished(pkg, registry, {
                registry: 'https://registry.npmjs.org/',
            });
            expect(result).toBe(false);
        });

        it('should throw when name or version is missing', async () => {
            const registry = new MemoryRegistryClient();
            const pkg: Package = {
                path: '/project/packages/a',
                content: { name: '', version: '1.0.0' },
            };

            await expect(isPackagePublished(pkg, registry, {
                registry: 'https://registry.npmjs.org/',
            })).rejects.toThrow('Name or version attribute is missing');
        });
    });

    describe('publishPackage', () => {
        it('should publish and return true', async () => {
            const publisher = new MemoryPublisher();
            const pkg: Package = {
                path: '/project/packages/a',
                content: { name: 'pkg-a', version: '1.0.0' },
            };

            const result = await publishPackage(pkg, publisher, {
                token: 'test-token',
                registry: 'https://registry.npmjs.org/',
            });

            expect(result).toBe(true);
            expect(publisher.published.length).toEqual(1);
            expect(publisher.published[0].manifest.name).toEqual('pkg-a');
        });

        it('should include auth token in publish options', async () => {
            const publisher = new MemoryPublisher();
            const pkg: Package = {
                path: '/project/packages/a',
                content: { name: 'pkg-a', version: '1.0.0' },
            };

            await publishPackage(pkg, publisher, {
                token: 'my-token',
                registry: 'https://registry.npmjs.org/',
            });

            expect(publisher.published[0].options['//registry.npmjs.org/:_authToken']).toEqual('my-token');
        });

        it('should merge publishConfig from package.json', async () => {
            const publisher = new MemoryPublisher();
            const pkg: Package = {
                path: '/project/packages/a',
                content: {
                    name: 'pkg-a',
                    version: '1.0.0',
                    publishConfig: { access: 'public' },
                },
            };

            await publishPackage(pkg, publisher, {
                registry: 'https://registry.npmjs.org/',
            });

            expect(publisher.published[0].options.access).toEqual('public');
        });

        it('should return false on npmjs EPUBLISHCONFLICT', async () => {
            const execFn = async () => {
                const err: Record<string, unknown> = new Error('Command failed');
                err.stderr = 'npm error code EPUBLISHCONFLICT';
                throw err;
            };
            const publisher = new NpmCliPublisher({ execFn });
            const pkg: Package = {
                path: '/project/packages/a',
                content: { name: 'pkg-a', version: '1.0.0' },
            };

            const result = await publishPackage(pkg, publisher, {
                token: 'test-token',
                registry: 'https://registry.npmjs.org/',
            });

            expect(result).toBe(false);
        });

        it('should return false on npmjs 403 version conflict', async () => {
            const execFn = async () => {
                const err: Record<string, unknown> = new Error('Command failed');
                err.stderr = '403 Forbidden - You cannot publish over the previously published versions: 1.0.0.';
                throw err;
            };
            const publisher = new NpmCliPublisher({ execFn });
            const pkg: Package = {
                path: '/project/packages/a',
                content: { name: 'pkg-a', version: '1.0.0' },
            };

            const result = await publishPackage(pkg, publisher, {
                token: 'test-token',
                registry: 'https://registry.npmjs.org/',
            });

            expect(result).toBe(false);
        });

        it('should return false on GitHub Packages 409 conflict', async () => {
            const execFn = async () => {
                const err: Record<string, unknown> = new Error('Command failed');
                err.stderr = '409 Conflict - Cannot publish over existing version';
                throw err;
            };
            const publisher = new NpmCliPublisher({ execFn });
            const pkg: Package = {
                path: '/project/packages/a',
                content: { name: 'pkg-a', version: '1.0.0' },
            };

            const result = await publishPackage(pkg, publisher, {
                token: 'test-token',
                registry: 'https://npm.pkg.github.com/',
            });

            expect(result).toBe(false);
        });

        it('should throw on non-conflict npm CLI errors', async () => {
            const execFn = async () => {
                throw new Error('npm ERR! 500 Internal Server Error');
            };
            const publisher = new NpmCliPublisher({ execFn });
            const pkg: Package = {
                path: '/project/packages/a',
                content: { name: 'pkg-a', version: '1.0.0' },
            };

            await expect(publishPackage(pkg, publisher, {
                token: 'test-token',
                registry: 'https://registry.npmjs.org/',
            })).rejects.toThrow();
        });
    });
});
