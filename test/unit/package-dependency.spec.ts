import {
    describe, expect, it,
} from 'vitest';
import { updatePackagesDependencies } from '../../src/package-dependency.ts';
import type { Package } from '../../src/core/index.ts';

describe('src/package-dependency', () => {
    it('should resolve workspace:^ to ^version', () => {
        const packages: Package[] = [
            {
                path: '/project/packages/a',
                content: {
                    name: 'pkg-a',
                    version: '1.0.0',
                    dependencies: { 'pkg-b': 'workspace:^' },
                },
            },
            {
                path: '/project/packages/b',
                content: { name: 'pkg-b', version: '2.0.0' },
            },
        ];

        updatePackagesDependencies(packages);

        expect(packages[0].content.dependencies!['pkg-b']).toEqual('^2.0.0');
        expect(packages[0].modified).toBe(true);
    });

    it('should resolve workspace:~ to ~version', () => {
        const packages: Package[] = [
            {
                path: '/project/packages/a',
                content: {
                    name: 'pkg-a',
                    version: '1.0.0',
                    dependencies: { 'pkg-b': 'workspace:~' },
                },
            },
            {
                path: '/project/packages/b',
                content: { name: 'pkg-b', version: '3.0.0' },
            },
        ];

        updatePackagesDependencies(packages);

        expect(packages[0].content.dependencies!['pkg-b']).toEqual('~3.0.0');
        expect(packages[0].modified).toBe(true);
    });

    it('should resolve workspace:* to exact version', () => {
        const packages: Package[] = [
            {
                path: '/project/packages/a',
                content: {
                    name: 'pkg-a',
                    version: '1.0.0',
                    dependencies: { 'pkg-b': 'workspace:*' },
                },
            },
            {
                path: '/project/packages/b',
                content: { name: 'pkg-b', version: '4.0.0' },
            },
        ];

        updatePackagesDependencies(packages);

        expect(packages[0].content.dependencies!['pkg-b']).toEqual('4.0.0');
        expect(packages[0].modified).toBe(true);
    });

    it('should resolve workspace deps in peerDependencies', () => {
        const packages: Package[] = [
            {
                path: '/project/packages/a',
                content: {
                    name: 'pkg-a',
                    version: '1.0.0',
                    peerDependencies: { 'pkg-b': 'workspace:^' },
                },
            },
            {
                path: '/project/packages/b',
                content: { name: 'pkg-b', version: '1.5.0' },
            },
        ];

        updatePackagesDependencies(packages);

        expect(packages[0].content.peerDependencies!['pkg-b']).toEqual('^1.5.0');
    });

    it('should resolve workspace deps in devDependencies', () => {
        const packages: Package[] = [
            {
                path: '/project/packages/a',
                content: {
                    name: 'pkg-a',
                    version: '1.0.0',
                    devDependencies: { 'pkg-b': 'workspace:~' },
                },
            },
            {
                path: '/project/packages/b',
                content: { name: 'pkg-b', version: '2.3.0' },
            },
        ];

        updatePackagesDependencies(packages);

        expect(packages[0].content.devDependencies!['pkg-b']).toEqual('~2.3.0');
    });

    it('should not modify non-workspace dependencies', () => {
        const packages: Package[] = [
            {
                path: '/project/packages/a',
                content: {
                    name: 'pkg-a',
                    version: '1.0.0',
                    dependencies: { lodash: '^4.0.0' },
                },
            },
        ];

        updatePackagesDependencies(packages);

        expect(packages[0].content.dependencies!.lodash).toEqual('^4.0.0');
        expect(packages[0].modified).toBeUndefined();
    });

    it('should not modify packages without dependencies', () => {
        const packages: Package[] = [
            {
                path: '/project/packages/a',
                content: { name: 'pkg-a', version: '1.0.0' },
            },
        ];

        updatePackagesDependencies(packages);

        expect(packages[0].modified).toBeUndefined();
    });
});
