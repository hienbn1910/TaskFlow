/**
 * The authenticated user, as attached to the request by JwtAuthGuard.
 * Kept minimal on purpose: handlers that need more data load it through a service.
 */
export interface AuthUser {
  readonly id: string;
  readonly email: string;
}
