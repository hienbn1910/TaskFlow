import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { sanitizedString } from '@common/utils/sanitize.util';

import { emailSchema, newPasswordSchema } from './auth-fields.schema';

const MAX_FULL_NAME_LENGTH = 100; // matches users.full_name VARCHAR(100)

export const registerSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  // HTML stripped + trimmed BEFORE the length check (RULE.md §5)
  fullName: sanitizedString(z.string().min(1).max(MAX_FULL_NAME_LENGTH)),
});

export class RegisterDto extends createZodDto(registerSchema) {}
