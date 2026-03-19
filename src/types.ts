/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IFileSystem, ILogger, IPackagePublisher, IRegistryClient, ITokenProvider,
} from './core/index.ts';

export type PublishOptions = {
    cwd?: string,
    rootPackage?: boolean,
    registry?: string,
    token?: string,
    dryRun?: boolean,

    fileSystem?: IFileSystem,
    registryClient?: IRegistryClient,
    publisher?: IPackagePublisher,
    tokenProvider?: ITokenProvider,
    logger?: ILogger,
};
