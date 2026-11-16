import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Public view of a user. Lives in common/ because the auth module (register, login, me)
 * and the users module (profile) both return it (RULE.md §1: no DTO shared between modules).
 * Only these fields reach the client: @ZodResponse strips everything else (Decision #13),
 * so `password`, `deletedAt` and `isActive` can never leak even if a mapper is wrong.
 */
export const userResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;

export class UserResponseDto extends createZodDto(userResponseSchema) {}
