#!/usr/bin/env node

/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { cac } from 'cac';
import {
    ChainTokenProvider, ConsolaLogger, EnvTokenProvider,
    HapicRegistryClient, MemoryTokenProvider, NodeFileSystem,
    OidcTokenProvider, resolvePublisher,
} from './core/index.ts';
import type { ITokenProvider } from './core/index.ts';
import { publish } from './module.ts';
import { isObject } from './utils/index.ts';

function isValidUrl(input: string): boolean {
    try {
        const parsed = new URL(input);
        return !!parsed.protocol;
    } catch {
        return false;
    }
}

function resolveTokenProvider(token?: string): ITokenProvider {
    if (token && token.length > 0) {
        return new MemoryTokenProvider(token);
    }

    const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

    if (requestUrl && requestToken) {
        return new ChainTokenProvider([
            new OidcTokenProvider({ requestUrl, requestToken }),
            new EnvTokenProvider(),
        ]);
    }

    return new EnvTokenProvider();
}

const logger = new ConsolaLogger();

const cli = cac();

cli
    .command('', 'Publish workspace packages')
    .option('--token <token>', 'Token for registry', {
        default: process.env.NODE_AUTH_TOKEN,
    })
    .option('--registry <registry>', 'Registry url', {
        default: 'https://registry.npmjs.org/',
    })
    .option('--root <root>', 'Root directory', {
        default: process.cwd(),
    })
    .option('--rootPackage', 'Also consider the root package for publishing')
    .action(async (options: {
        token: string,
        registry: string,
        root: string,
        rootPackage?: boolean
    }) => {
        try {
            if (!isValidUrl(options.registry)) {
                logger.error(`Invalid registry URL: ${options.registry}`);
                process.exit(2);
            }

            const tokenProvider = resolveTokenProvider(options.token);

            if (options.token) {
                process.env.NODE_AUTH_TOKEN = options.token;
            }

            const publisher = await resolvePublisher();

            const packages = await publish({
                registry: options.registry,
                cwd: options.root,
                rootPackage: options.rootPackage ?? true,
                fileSystem: new NodeFileSystem(),
                registryClient: new HapicRegistryClient(),
                publisher,
                tokenProvider,
                logger,
            });

            if (packages.length === 0) {
                logger.info('No packages need to be published.');
            }

            for (const package_ of packages) {
                logger.success(`published ${package_.content.name}@${package_.content.version}`);
            }

            process.exit(0);
        } catch (e) {
            if (isObject(e)) {
                logger.warn(e?.message || 'An unknown error occurred.');
            }
            process.exit(1);
        }
    });

cli.help();

cli.parse();
