import type { UserResponseDtoOutput } from '@/api/generated/model';

export const REFRESH_URL = '/api/v1/auth/refresh';

export const TEST_USER: UserResponseDtoOutput = {
  id: '6b1f0c2e-3a4d-4e5f-8a9b-0c1d2e3f4a5b',
  email: 'hien@example.com',
  fullName: 'Hien Bui',
  avatarUrl: null,
  createdAt: '2026-11-25T00:00:00.000Z',
};

/** The wire body of a successful `POST /auth/refresh` (success envelope + AuthResponseDto). */
export function refreshBody(accessToken: string) {
  return { success: true, data: { accessToken, user: TEST_USER } };
}

/** The API's standard error body (ADR-0001, ADR-0035). */
export function errorBody(statusCode: number, message: string, extra: object = {}) {
  return {
    success: false,
    statusCode,
    error: 'ERROR',
    message,
    timestamp: '2026-11-25T00:00:00.000Z',
    requestId: '3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e34',
    ...extra,
  };
}
