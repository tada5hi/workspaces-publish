import {
    describe, 
    expect, 
    it,
} from 'vitest';
import { isError, isObject } from '../../src/utils/index.ts';

describe('src/utils', () => {
    describe('isObject', () => {
        it('should return true for plain objects', () => {
            expect(isObject({})).toBe(true);
            expect(isObject({ a: 1 })).toBe(true);
        });

        it('should return false for arrays', () => {
            expect(isObject([])).toBe(false);
        });

        it('should return false for null', () => {
            expect(isObject(null)).toBe(false);
        });

        it('should return false for primitives', () => {
            expect(isObject(42)).toBe(false);
            expect(isObject('string')).toBe(false);
            expect(isObject(undefined)).toBe(false);
            expect(isObject(true)).toBe(false);
        });
    });

    describe('isError', () => {
        it('should return true for Error instances', () => {
            expect(isError(new Error('test'))).toBe(true);
        });

        it('should return true for error-like objects', () => {
            expect(isError({ message: 'something went wrong' })).toBe(true);
        });

        it('should return false for objects without message', () => {
            expect(isError({ code: 'ERR' })).toBe(false);
        });

        it('should return false for objects with non-string message', () => {
            expect(isError({ message: 42 })).toBe(false);
            expect(isError({ message: undefined })).toBe(false);
        });

        it('should return false for non-objects', () => {
            expect(isError(null)).toBe(false);
            expect(isError('error')).toBe(false);
            expect(isError(undefined)).toBe(false);
        });
    });
});
