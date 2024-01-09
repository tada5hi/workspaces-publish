import hapic from 'hapic';
import libnpmpublish from 'libnpmpublish';
import { publish } from '../../src';

let publishMock : jest.SpyInstance;
let hapicMock : jest.SpyInstance;

describe('src/module', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        publishMock = jest.spyOn(libnpmpublish, 'publish').mockImplementation();
        hapicMock = jest.spyOn(hapic, 'get').mockImplementation();
    });

    it('should publish packages', async () => {
        publishMock.mockImplementation(() => true);
        hapicMock.mockImplementation(() => ({
            versions: {},
        }));

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
