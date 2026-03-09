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

verify-web-ui:
    pnpm verify:web-ui

ci: lint typecheck test verify-web-ui
