# ADR-0007: Validation with Zod through `nestjs-zod`

- **Status:** Accepted
- **Date:** 2026-11 (Milestone 1)

## Decision
All request validation uses Zod schemas turned into DTOs with `createZodDto`. A global `ZodValidationPipe` (`APP_PIPE`) validates every input. Swagger documentation is generated from the same schemas. `class-validator` is not used.

## Consequences
One schema gives runtime validation, TypeScript types and OpenAPI. The OpenAPI document is also the frontend contract (ADR-0033).
