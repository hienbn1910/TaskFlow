import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { USER_ERROR } from '@common/constants/user.constant';
import { fullNameSchema } from '@common/types/user-fields.schema';

/**
 * Only the fields listed here can be changed. Anything else in the body (email, isActive,
 * password...) is stripped by z.object, so it never reaches the service (mass assignment).
 * New updatable fields (avatarUrl in Milestone 3) are added here, same endpoint.
 */
export const updateProfileSchema = z
  .object({
    fullName: fullNameSchema.optional(),
  })
  // Runs on the STRIPPED object: a body with only unknown fields counts as empty too.
  // Values typed `unknown`: TS types them `string`, but an optional key can hold undefined.
  .refine((data) => Object.values<unknown>(data).some((value) => value !== undefined), {
    message: USER_ERROR.NO_FIELDS,
  });

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
