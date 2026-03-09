set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

bootstrap:
	pnpm install
	lefthook install

lint:
    pnpm lint

typecheck:
    pnpm typecheck

test:
    pnpm test

build:
    pnpm build

ci: lint typecheck test # build
