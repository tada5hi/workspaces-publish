import {
    describe, expect, it,
} from 'vitest';
import { NpmCliPublisher } from '../../src/core';

function createFakeExec(expectedArgs?: {
    command?: string;
    args?: string[];
    cwd?: string;
    envToken?: string;
}) {
    const calls: Array<{ command: string; args: string[]; options: { cwd: string; env: Record<string, string | undefined> } }> = [];

    const execFn = async (
        command: string,
        args: string[],
        options: { cwd: string; env: Record<string, string | undefined> },
    ) => {
        calls.push({ command, args, options });
        return { stdout: '', stderr: '' };
    };

    return { execFn, calls };
}

describe('src/core/publisher/npm-cli', () => {
    it('should call npm publish with correct cwd', async () => {
        const { execFn, calls } = createFakeExec();
        const publisher = new NpmCliPublisher({ execFn });

        await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            {},
        );

        expect(calls.length).toEqual(1);
        expect(calls[0].command).toEqual('npm');
        expect(calls[0].args[0]).toEqual('publish');
        expect(calls[0].options.cwd).toEqual('/project/packages/a');
    });

    it('should pass registry flag from auth token key', async () => {
        const { execFn, calls } = createFakeExec();
        const publisher = new NpmCliPublisher({ execFn });

        await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            { '//registry.npmjs.org/:_authToken': 'my-token' },
        );

        expect(calls[0].args).toContain('--registry');
        expect(calls[0].args).toContain('https://registry.npmjs.org');
    });

    it('should prefer options.registry over auth token key derived registry', async () => {
        const { execFn, calls } = createFakeExec();
        const publisher = new NpmCliPublisher({ execFn });

        await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            {
                registry: 'https://custom.registry.com/',
                '//registry.npmjs.org/:_authToken': 'my-token',
            },
        );

        expect(calls[0].args).toContain('--registry');
        expect(calls[0].args).toContain('https://custom.registry.com/');
        expect(calls[0].args).not.toContain('https://registry.npmjs.org');
    });

    it('should set NODE_AUTH_TOKEN in env', async () => {
        const { execFn, calls } = createFakeExec();
        const publisher = new NpmCliPublisher({ execFn });

        await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            { '//registry.npmjs.org/:_authToken': 'my-token' },
        );

        expect(calls[0].options.env.NODE_AUTH_TOKEN).toEqual('my-token');
    });

    it('should pass access flag when provided', async () => {
        const { execFn, calls } = createFakeExec();
        const publisher = new NpmCliPublisher({ execFn });

        await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            { access: 'public' },
        );

        expect(calls[0].args).toContain('--access');
        expect(calls[0].args).toContain('public');
    });

    it('should pass tag flag when provided', async () => {
        const { execFn, calls } = createFakeExec();
        const publisher = new NpmCliPublisher({ execFn });

        await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0-beta.1' },
            { tag: 'beta' },
        );

        expect(calls[0].args).toContain('--tag');
        expect(calls[0].args).toContain('beta');
    });

    it('should not pass tag flag when not provided', async () => {
        const { execFn, calls } = createFakeExec();
        const publisher = new NpmCliPublisher({ execFn });

        await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            {},
        );

        expect(calls[0].args).not.toContain('--tag');
    });

    it('should not set registry when no auth token key', async () => {
        const { execFn, calls } = createFakeExec();
        const publisher = new NpmCliPublisher({ execFn });

        await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            {},
        );

        expect(calls[0].args).not.toContain('--registry');
    });

    it('should propagate exec errors', async () => {
        const execFn = async () => {
            throw new Error('npm not found');
        };
        const publisher = new NpmCliPublisher({ execFn });

        await expect(publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            {},
        )).rejects.toThrow('npm not found');
    });

    it('should normalize npmjs version conflict error from stderr', async () => {
        const execFn = async () => {
            const err: Record<string, unknown> = new Error('Command failed');
            err.stderr = 'npm error code EPUBLISHCONFLICT';
            throw err;
        };
        const publisher = new NpmCliPublisher({ execFn });

        try {
            await publisher.publish(
                '/project/packages/a',
                { name: 'pkg-a', version: '1.0.0' },
                {},
            );
            expect.unreachable('should have thrown');
        } catch (e: any) {
            expect(e.code).toEqual('EPUBLISHCONFLICT');
        }
    });

    it('should normalize npmjs 403 version conflict error from stderr', async () => {
        const execFn = async () => {
            const err: Record<string, unknown> = new Error('Command failed');
            err.stderr = '403 Forbidden - You cannot publish over the previously published versions: 1.0.0.';
            throw err;
        };
        const publisher = new NpmCliPublisher({ execFn });

        try {
            await publisher.publish(
                '/project/packages/a',
                { name: 'pkg-a', version: '1.0.0' },
                {},
            );
            expect.unreachable('should have thrown');
        } catch (e: any) {
            expect(e.code).toEqual('EPUBLISHCONFLICT');
        }
    });

    it('should normalize GitHub Packages 409 conflict error from stderr', async () => {
        const execFn = async () => {
            const err: Record<string, unknown> = new Error('Command failed');
            err.stderr = '409 Conflict - Cannot publish over existing version';
            throw err;
        };
        const publisher = new NpmCliPublisher({ execFn });

        try {
            await publisher.publish(
                '/project/packages/a',
                { name: 'pkg-a', version: '1.0.0' },
                {},
            );
            expect.unreachable('should have thrown');
        } catch (e: any) {
            expect(e.code).toEqual('E409');
        }
    });
});
