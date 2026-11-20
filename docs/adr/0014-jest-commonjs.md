# ADR-0014: Jest runs CommonJS; type checking is separate

- **Status:** Accepted
- **Date:** 2026-11 (Milestone 1)

## Decision
Jest uses `tsconfig.spec.json` (`module: commonjs`), because the Prisma 7 client uses dynamic `import()`. Tests are type-checked by `pnpm typecheck`, not by ts-jest.

## Consequences
ESM-only packages cannot be loaded in tests (see Decision #11 for `@nestjs/jwt`). Check this before adding any dependency.
