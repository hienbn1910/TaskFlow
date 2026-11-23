import { ServiceUnavailableException } from '@nestjs/common';

import type { ErrorDetail } from '@common/types/api-response.type';

export const SERVICE_NOT_READY_MESSAGE = 'Service not ready';

/** 503 with one `{ field, message: 'unreachable' }` per failed check (spec §7.4). */
export class ServiceNotReadyException extends ServiceUnavailableException {
  constructor(details: readonly ErrorDetail[]) {
    super({ message: SERVICE_NOT_READY_MESSAGE, details });
  }
}
