import { create } from 'zustand';

/** `unknown` until the first refresh settles at boot (spec §4). */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  /** Memory only: never Web Storage (ADR-0005, ADR-0034). */
  readonly accessToken: string | null;
  readonly status: SessionStatus;
}

interface AuthActions {
  signIn: (accessToken: string) => void;
  signOut: () => void;
}

export const initialAuthState: AuthState = { accessToken: null, status: 'unknown' };

/**
 * A module singleton: `request` and `refreshSession` read it outside React (plan §3.3).
 * The User is not here: it lives in the query cache under the `/auth/me` key (ADR-0034).
 */
export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  ...initialAuthState,
  signIn: (accessToken) => {
    set({ accessToken, status: 'authenticated' });
  },
  signOut: () => {
    set({ accessToken: null, status: 'anonymous' });
  },
}));
