import hapic from 'hapic';
import { REGISTRY_URL } from './constants';
import type { PackagePublishOptions, Packument } from './types';

export async function getPackument(
    name: string,
    publishOptions: Partial<PackagePublishOptions> = {},
) : Promise<Packument> {
    const path = encodeURIComponent(name)
        .replace(/^%40/, '@');

    const headers : Record<string, any> = {
        ACCEPT: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
    };

    if (publishOptions.token) {
        headers.AUTHORIZATION = `Bearer ${publishOptions.token}`;
    }

    const response = await hapic.get(
        new URL(path, publishOptions.registry || REGISTRY_URL).toString(),
        {
            headers,
        },
    );

    return response.data;
}
