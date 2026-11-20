import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { USER_ERROR } from '@common/constants/user.constant';
import { newPasswordSchema, passwordInputSchema } from '@common/types/user-fields.schema';

/**
 * currentPassword: checked against the stored hash, so no strength rule (an old account may
 * predate the policy). newPassword: the full policy, same as register.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: passwordInputSchema,
    newPassword: newPasswordSchema,
  })
  // Compares two fields of the input only, so it is an input rule (DTO), not a service rule.
  // path: the error is reported on newPassword, the field the user has to change.
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: USER_ERROR.NEW_PASSWORD_SAME,
    path: ['newPassword'],
  });

export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
