set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

bootstrap:
    corepack enable
    pnpm install --frozen-lockfile=false

lint:
    pnpm run lint

test:
    pnpm run test

ci:
    pnpm run ci

pipeline-run:
    pnpm run pipeline:run
