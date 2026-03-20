#!/bin/sh
set -e

args=""

args="$args --registry $INPUT_REGISTRY"

if [ "$INPUT_ROOT_PACKAGE" = "true" ]; then
    args="$args --rootPackage"
fi

if [ "$INPUT_DRY_RUN" = "true" ]; then
    args="$args --dryRun"
fi

node /app/dist/cli.mjs $args

