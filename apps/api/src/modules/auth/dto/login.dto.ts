import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { emailSchema, passwordInputSchema } from '@common/types/user-fields.schema';

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordInputSchema,
});

export class LoginDto extends createZodDto(loginSchema) {}
