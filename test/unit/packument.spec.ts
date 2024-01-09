import { getPackument } from '../../src';

describe('src/packument', () => {
    it('should get packument', async () => {
        const packument = await getPackument('workspaces-publish');

        expect(packument).toBeDefined();
        expect(packument.name).toBeDefined();
        expect(packument.versions).toBeDefined();
    });
});
