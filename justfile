set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

bootstrap:
	pnpm install
	lefthook install

format-check:
	pnpm run format:check

lint-biome:
	pnpm run lint:biome

lint:
	pnpm run lint

check-fast:
	pnpm run check:fast

typecheck:
	pnpm run typecheck

test:
	pnpm run test

build:
	pnpm run build

verify-web-ui:
	pnpm run verify:web-ui

ci:
	pnpm run ci
