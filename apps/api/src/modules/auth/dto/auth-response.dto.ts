import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { userResponseSchema } from '@common/types/user-response.dto';

/**
 * Body of register, login and refresh. The refresh token is NOT here: it travels only
 * in the httpOnly cookie (Decision #5). If a handler returned it by mistake,
 * @ZodResponse would strip it because the field is not in this schema.
 */
export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: userResponseSchema,
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

export class AuthResponseDto extends createZodDto(authResponseSchema) {}
