#!/usr/bin/env node

import { cac } from 'cac';
import consola from 'consola';
import { publish } from './module';
import { isObject } from './utils';

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
            if (options.token) {
                process.env.NODE_AUTH_TOKEN = options.token;
                consola.debug('Publishing with token');
            } else {
                consola.debug('Publishing without token');
            }

            const packages = await publish({
                token: options.token,
                registry: options.registry,
                cwd: options.root,
                rootPackage: true,
            });

            if (packages.length === 0) {
                consola.info('No packages need to be published.');
            }

            for (let i = 0; i < packages.length; i++) {
                if (packages[i].published) {
                    consola.success(`published ${packages[i].content.name}@${packages[i].content.version}`);
                } else {
                    consola.success(`already published ${packages[i].content.name}@${packages[i].content.version}`);
                }
            }

            process.exit(0);
        } catch (e) {
            if (isObject(e)) {
                consola.warn(e?.message || 'An unknown error occurred.');
            }
            process.exit(1);
        }
    });

cli.help();

cli.parse();
