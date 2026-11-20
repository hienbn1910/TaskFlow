/**
 * Error messages of the users module (profile, password). See docs/specs/user-profile.md §3.
 */
export const USER_ERROR = {
  // 400, not 401: the user IS authenticated, only a form field is wrong. A 401 would make
  // the web app think the session expired and start its refresh / logout flow (spec §3.2).
  CURRENT_PASSWORD_INCORRECT: 'Current password is incorrect',
  NEW_PASSWORD_SAME: 'New password must be different from the current password',
  NO_FIELDS: 'At least one field is required',
} as const;
