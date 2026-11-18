import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { emailSchema, loginPasswordSchema } from './auth-fields.schema';

export const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

export class LoginDto extends createZodDto(loginSchema) {}
