import type { UserResponse } from '@common/types/user-response.dto';

/**
 * What AuthService returns after register / login / refresh. Internal only: the controller
 * puts `refreshToken` in the httpOnly cookie and sends `{ accessToken, user }` in the body.
 */
export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: UserResponse;
}
