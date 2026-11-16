/** Data needed to store one session (spec §2.6). `tokenHash` is sha256(refresh JWT), never the JWT. */
export interface NewRefreshToken {
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}
