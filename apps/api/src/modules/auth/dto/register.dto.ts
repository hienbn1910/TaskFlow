import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { emailSchema, fullNameSchema, newPasswordSchema } from '@common/types/user-fields.schema';

export const registerSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  fullName: fullNameSchema,
});

export class RegisterDto extends createZodDto(registerSchema) {}
