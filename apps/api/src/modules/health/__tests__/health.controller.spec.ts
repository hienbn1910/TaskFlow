import { Test } from '@nestjs/testing';

import { HealthController } from '../health.controller';
import { HealthService } from '../health.service';

describe('HealthController', () => {
  it('should delegate to HealthService.check', async () => {
    const check = jest
      .fn()
      .mockReturnValue({ status: 'ok', timestamp: '2026-01-01T00:00:00.000Z' });
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: { check } }],
    }).compile();

    const result = moduleRef.get(HealthController).check();

    expect(check).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ok');
  });
});
