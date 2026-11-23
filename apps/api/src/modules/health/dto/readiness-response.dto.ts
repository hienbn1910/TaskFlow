import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Only `up` appears in a 200: any check down turns the whole answer into a 503 (spec §7.4).
 * Never error messages or hosts: readiness is public.
 */
export const readinessResponseSchema = z.object({
  status: z.literal('ok'),
  checks: z.object({ database: z.literal('up'), redis: z.literal('up') }),
});

export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;

export class ReadinessResponseDto extends createZodDto(readinessResponseSchema) {}
