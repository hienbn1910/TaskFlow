# ADR-0011: Package versions

- **Status:** Accepted
- **Date:** 2026-11 (Milestone 1)

## Decision
NestJS 11, TypeScript 5.9, Prisma 7.10, Zod 4. `@nestjs/jwt` stays on 11.x.

## Reasons
- Not NestJS 12: `nestjs-zod` supports Nest ≤ 11.
- Not TypeScript 7: `ts-jest` and `typescript-eslint` do not support it yet.
- Not Prisma 8: still a release candidate.
- `@nestjs/jwt` 12.x is ESM-only and Jest runs CommonJS (Decision #14).

## Added in Milestone 2 (`chore/api-production-readiness`)
| Package | Version | Why |
|---|---|---|
| `@nestjs/throttler` | ^6.8 | Rate limiting in memory (ADR-0031); named throttlers |
| `nestjs-pino`, `pino`, `pino-http` | ^5.3, ^10.4, ^11.0 | JSON logs with request id (ADR-0035) |
| `pino-pretty` (dev) | ^13.2 | Readable logs in development only |
| `ioredis` | ^6.0 | Readiness `PING`; reused by BullMQ in M6 (ADR-0027) |
| `express` (dev) | ^5.2 | Types and a bare app for the logger unit test; already the runtime of `@nestjs/platform-express` |

All load in Jest's CommonJS (Decision #14): checked by the unit and E2E suites.

`nestjs-zod` raised to ^5.6 in `feature/web-foundation`: 5.5 exported a nullable field as an array (ADR-0033).

## Web app (`apps/web`, M2 `feature/web-foundation`)
| Package | Version | Why |
|---|---|---|
| `react`, `react-dom` | ^19.3 | UI |
| `react-router` | ^8.5 | Data router (`createBrowserRouter`); no loader fetches data (ADR-0034) |
| `@tanstack/react-query` | ^5.108 | Server state (ADR-0034) |
| `zustand` | ^5.1 | Access token and session status, memory only |
| `zod` | ^4.1 | Generated schemas, error body parsing |
| `sonner` | ^2.0 | Toasts |
| `vite`, `@vitejs/plugin-react` | ^8.3, ^6.3 | Dev server with the `/api` proxy (ADR-0020), build |
| `tailwindcss`, `@tailwindcss/vite` | ^4.3 | Styling, tokens in `@theme` |
| `orval` (dev) | ^8.49 | Client, hooks and Zod from `openapi.json` (ADR-0033) |
| `vitest`, `jsdom`, `@testing-library/*`, `msw` (dev) | ^5.1, ^31, —, ^3.0 | Tests; MSW mocks the network, the system boundary (ADR-0039) |
| `typescript` | ~5.9 | Same as the API |
| `eslint` | ^9.39 | Not 10: `eslint-plugin-jsx-a11y` does not support it yet |

The web app is ESM only: Decision #14 does not apply to it. pnpm's `minimumReleaseAge` (1 day) is kept: when a fresh version is refused, the range is lowered instead of excluding the package.

## Consequences
Re-evaluate when these blockers are lifted. Every new dependency is checked against Decision #14 (CommonJS in Jest) before it is added.
