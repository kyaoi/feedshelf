set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

bootstrap:
	pnpm install
	lefthook install

lint:
    pnpm lint

test:
    pnpm test

build:
    pnpm build

ci: lint test # build
