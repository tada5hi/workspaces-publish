import {
    describe, expect, it,
} from 'vitest';
import { NpmCliPublisher, NpmPublisher, resolvePublisher } from '../../src/core/index.ts';

describe('src/core/publisher/resolve', () => {
    it('should return NpmCliPublisher when npm version is >= 10.0.0', async () => {
        const execFn = async () => ({ stdout: '10.0.0\n', stderr: '' });
        const publisher = await resolvePublisher({ execFn });
        expect(publisher).toBeInstanceOf(NpmCliPublisher);
    });

    it('should return NpmCliPublisher for newer npm versions', async () => {
        const execFn = async () => ({ stdout: '11.5.1\n', stderr: '' });
        const publisher = await resolvePublisher({ execFn });
        expect(publisher).toBeInstanceOf(NpmCliPublisher);
    });

    it('should return NpmPublisher when npm version is below 10.0.0', async () => {
        const execFn = async () => ({ stdout: '9.9.9\n', stderr: '' });
        const publisher = await resolvePublisher({ execFn });
        expect(publisher).toBeInstanceOf(NpmPublisher);
    });

    it('should return NpmPublisher when npm is not found', async () => {
        const execFn = async () => {
            throw new Error('npm not found');
        };
        const publisher = await resolvePublisher({ execFn });
        expect(publisher).toBeInstanceOf(NpmPublisher);
    });

    it('should pass the execFn to NpmCliPublisher when selected', async () => {
        const calls: Array<{ command: string; args: string[] }> = [];
        const execFn = async (
            command: string,
            args: string[],
        ) => {
            calls.push({ command, args });
            return { stdout: '10.0.0\n', stderr: '' };
        };

        const publisher = await resolvePublisher({ execFn });
        expect(publisher).toBeInstanceOf(NpmCliPublisher);

        // The execFn should have been called once for version detection
        expect(calls.length).toEqual(1);
        expect(calls[0].command).toEqual('npm');
        expect(calls[0].args).toContain('--version');
    });
});
