/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IFileSystem } from './core/filesystem/types';
import type { ILogger } from './core/logger/types';
import type { IPackagePublisher } from './core/publisher/types';
import type { IRegistryClient } from './core/registry-client/types';
import type { ITokenProvider } from './core/token-provider/types';

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
