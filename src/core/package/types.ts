/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type PackageJson = {
    name: string;

    private?: boolean,

    version: string;

    publishConfig?: Record<string, any>,

    workspaces?: string[],

    dependencies?: Record<string, string>,

    peerDependencies?: Record<string, string>,

    devDependencies?: Record<string, string>,
};

export type Package = {
    path: string;
    content: PackageJson,
    published?: boolean,
    publishable?: boolean,
    modified?: boolean
};
