/**
 * Renews the access token with the refresh cookie (spec §5.2).
 * Stub: W4 replaces it with the single-flight version.
 */
export async function refreshSession(): Promise<void> {
  await Promise.reject(new Error('refreshSession is not implemented yet'));
}
