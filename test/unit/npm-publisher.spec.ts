import {
    describe, expect, it,
} from 'vitest';
import {
    NpmPublisher,
} from '../../src/index.ts';

describe('src/core/publisher version conflict checks', () => {
    const publisher = new NpmPublisher();

    describe('publisher.isNpmPkgGitHubPublishVersionConflict', () => {
        it('should return false for non-object input', () => {
            expect(publisher.isNpmPkgGitHubVersionConflict(null)).toBe(false);
            expect(publisher.isNpmPkgGitHubVersionConflict(undefined)).toBe(false);
            expect(publisher.isNpmPkgGitHubVersionConflict('string')).toBe(false);
        });

        it('should return false for error with no message property', () => {
            const err = new Error();
            err.message = undefined as unknown as string;
            expect(publisher.isNpmPkgGitHubVersionConflict(err)).toBe(false);
        });

        it('should return true for E409 code', () => {
            const err: Record<string, unknown> = new Error('some error');
            err.code = 'E409';
            expect(publisher.isNpmPkgGitHubVersionConflict(err)).toBe(true);
        });

        it('should return true for body with Cannot publish over existing version', () => {
            const err: Record<string, unknown> = new Error('some error');
            err.body = { error: 'Cannot publish over existing version' };
            expect(publisher.isNpmPkgGitHubVersionConflict(err)).toBe(true);
        });

        it('should return true for 409 Conflict message', () => {
            const err = new Error('409 Conflict - PUT https://npm.pkg.github.com/foo');
            expect(publisher.isNpmPkgGitHubVersionConflict(err)).toBe(true);
        });
    });

    describe('publisher.isNpmJsPublishVersionConflict', () => {
        it('should return false for non-object input', () => {
            expect(publisher.isNpmJsVersionConflict(null)).toBe(false);
            expect(publisher.isNpmJsVersionConflict(undefined)).toBe(false);
            expect(publisher.isNpmJsVersionConflict(42)).toBe(false);
        });

        it('should return true for EPUBLISHCONFLICT code', () => {
            const err: Record<string, unknown> = new Error('conflict');
            err.code = 'EPUBLISHCONFLICT';
            expect(publisher.isNpmJsVersionConflict(err)).toBe(true);
        });

        it('should return true for E403 with version conflict message', () => {
            const err: Record<string, unknown> = new Error(
                'You cannot publish over the previously published versions: 1.0.0.',
            );
            err.code = 'E403';
            expect(publisher.isNpmJsVersionConflict(err)).toBe(true);
        });

        it('should return false for E403 without version conflict message', () => {
            const err: Record<string, unknown> = new Error('Forbidden');
            err.code = 'E403';
            expect(publisher.isNpmJsVersionConflict(err)).toBe(false);
        });
    });
});
