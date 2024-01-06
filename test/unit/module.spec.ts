import pacote from 'pacote';
import libnpmpublish from 'libnpmpublish';
import { publish } from '../../src';

let packumentMock : jest.SpyInstance;
let manifestMock : jest.SpyInstance;
let tarballMock : jest.SpyInstance;
let publishMock : jest.SpyInstance;

describe('src/module', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        packumentMock = jest.spyOn(pacote, 'packument').mockImplementation();
        manifestMock = jest.spyOn(pacote, 'manifest').mockImplementation();
        tarballMock = jest.spyOn(pacote, 'tarball').mockImplementation();
        publishMock = jest.spyOn(libnpmpublish, 'publish').mockImplementation();
    });

    it('should publish packages', async () => {
        packumentMock.mockImplementation(() => ({
            versions: [],
        }));
        manifestMock.mockImplementation(() => ({}));
        tarballMock.mockImplementation(() => ({}));
        publishMock.mockImplementation(() => true);

        const packages = await publish({
            cwd: 'test/data',
            token: 'foo',
        });

        expect(packages.length).toEqual(2);
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
