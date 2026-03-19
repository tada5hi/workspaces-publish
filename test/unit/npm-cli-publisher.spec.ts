import path from 'node:path';
import {
    describe, expect, it,
} from 'vitest';
import { NpmCliPublisher, PublishError } from '../../src/core/index.ts';

function createFakeFs() {
    const files: Record<string, string> = {};
    const unlinked: string[] = [];

    return {
        files,
        unlinked,
        readFileFn: async (fp: string) => {
            if (fp in files) {
                return files[fp];
            }
            throw new Error('ENOENT');
        },
        writeFileFn: async (fp: string, content: string) => {
            files[fp] = content;
        },
        unlinkFn: async (fp: string) => {
            unlinked.push(fp);
            delete files[fp];
        },
    };
}

function createFakeExec() {
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
        const fs = createFakeFs();
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

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
        const fs = createFakeFs();
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

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
        const fs = createFakeFs();
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

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
        const fs = createFakeFs();
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

        await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            { '//registry.npmjs.org/:_authToken': 'my-token' },
        );

        expect(calls[0].options.env.NODE_AUTH_TOKEN).toEqual('my-token');
    });

    it('should write .npmrc with auth token reference', async () => {
        const { execFn } = createFakeExec();
        const fs = createFakeFs();
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

        await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            { '//registry.npmjs.org/:_authToken': 'my-token' },
        );

        // .npmrc should be cleaned up after publish
        expect(fs.unlinked).toContain(path.join('/project/packages/a', '.npmrc'));
    });

    it('should preserve existing .npmrc content during publish', async () => {
        const { calls } = createFakeExec();
        const fs = createFakeFs();
        fs.files[path.join('/project/packages/a', '.npmrc')] = 'legacy-peer-deps=true\n';

        let contentDuringPublish = '';
        const capturingExecFn = async (
            command: string,
            args: string[],
            options: { cwd: string; env: Record<string, string | undefined> },
        ) => {
            contentDuringPublish = fs.files[path.join('/project/packages/a', '.npmrc')] || '';
            calls.push({ command, args, options });
            return { stdout: '', stderr: '' };
        };

        const publisher = new NpmCliPublisher({
            execFn: capturingExecFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

        await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            { '//registry.npmjs.org/:_authToken': 'my-token' },
        );

        expect(contentDuringPublish).toContain('legacy-peer-deps=true');
        expect(contentDuringPublish).toContain('//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}');
    });

    it('should restore existing .npmrc after publish', async () => {
        const { execFn } = createFakeExec();
        const fs = createFakeFs();
        fs.files['/project/packages/a/.npmrc'] = 'existing-content';
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

        await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            { '//registry.npmjs.org/:_authToken': 'my-token' },
        );

        expect(fs.files['/project/packages/a/.npmrc']).toEqual('existing-content');
    });

    it('should write correct .npmrc content for custom registry', async () => {
        const { execFn } = createFakeExec();
        const fs = createFakeFs();
        let writtenContent = '';
        const writeFileFn = async (_fp: string, content: string) => {
            writtenContent = content;
            fs.files[_fp] = content;
        };
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn, unlinkFn: fs.unlinkFn,
        });

        await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            {
                registry: 'https://npm.pkg.github.com/',
                '//npm.pkg.github.com/:_authToken': 'gh-token',
            },
        );

        expect(writtenContent).toEqual('//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n');
    });

    it('should not write .npmrc when no auth token', async () => {
        const { execFn } = createFakeExec();
        const fs = createFakeFs();
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

        await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            {},
        );

        expect(Object.keys(fs.files).length).toEqual(0);
        expect(fs.unlinked.length).toEqual(0);
    });

    it('should pass access flag when provided', async () => {
        const { execFn, calls } = createFakeExec();
        const fs = createFakeFs();
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

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
        const fs = createFakeFs();
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

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
        const fs = createFakeFs();
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

        await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            {},
        );

        expect(calls[0].args).not.toContain('--tag');
    });

    it('should not set registry when no auth token key', async () => {
        const { execFn, calls } = createFakeExec();
        const fs = createFakeFs();
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

        await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            {},
        );

        expect(calls[0].args).not.toContain('--registry');
    });

    it('should wrap exec errors in PublishError', async () => {
        const execFn = async () => {
            throw new Error('npm not found');
        };
        const fs = createFakeFs();
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

        await expect(publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            {},
        )).rejects.toThrow(PublishError);
    });

    it('should clean up .npmrc after exec error', async () => {
        const execFn = async () => {
            throw new Error('npm publish failed');
        };
        const fs = createFakeFs();
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

        try {
            await publisher.publish(
                '/project/packages/a',
                { name: 'pkg-a', version: '1.0.0' },
                { '//registry.npmjs.org/:_authToken': 'my-token' },
            );
        } catch {
            // expected
        }

        expect(fs.unlinked).toContain(path.join('/project/packages/a', '.npmrc'));
    });

    it('should return false on npmjs EPUBLISHCONFLICT from stderr', async () => {
        const execFn = async () => {
            const err: Record<string, unknown> = new Error('Command failed');
            err.stderr = 'npm error code EPUBLISHCONFLICT';
            throw err;
        };
        const fs = createFakeFs();
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

        const result = await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            {},
        );

        expect(result).toBe(false);
    });

    it('should return false on npmjs 403 version conflict from stderr', async () => {
        const execFn = async () => {
            const err: Record<string, unknown> = new Error('Command failed');
            err.stderr = '403 Forbidden - You cannot publish over the previously published versions: 1.0.0.';
            throw err;
        };
        const fs = createFakeFs();
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

        const result = await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            {},
        );

        expect(result).toBe(false);
    });

    it('should return false on GitHub Packages 409 conflict from stderr', async () => {
        const execFn = async () => {
            const err: Record<string, unknown> = new Error('Command failed');
            err.stderr = '409 Conflict - Cannot publish over existing version';
            throw err;
        };
        const fs = createFakeFs();
        const publisher = new NpmCliPublisher({
            execFn, readFileFn: fs.readFileFn, writeFileFn: fs.writeFileFn, unlinkFn: fs.unlinkFn,
        });

        const result = await publisher.publish(
            '/project/packages/a',
            { name: 'pkg-a', version: '1.0.0' },
            {},
        );

        expect(result).toBe(false);
    });
});
