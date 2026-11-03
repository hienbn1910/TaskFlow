import { HealthService } from '../health.service';

describe('HealthService', () => {
  describe('check', () => {
    it('should return status ok with an ISO timestamp', () => {
      const result = new HealthService().check();

      expect(result.status).toBe('ok');
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });
});
