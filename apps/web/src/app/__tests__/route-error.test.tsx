import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAuthMeQueryKey } from '@/api/generated/endpoints/auth/auth';
import { queryClient } from '@/app/query-client';
import { useAuthStore } from '@/features/auth/auth-store';
import { TEST_USER } from '@/test/auth-fixtures';
import { renderApp } from '@/test/render';

// A page of the real route table that crashes while rendering
vi.mock('@/features/home/routes/HomePage', () => ({
  HomePage: () => {
    throw new Error('secret internal detail');
  },
}));

beforeEach(() => {
  useAuthStore.setState({ status: 'authenticated', accessToken: 'token' });
  queryClient.setQueryData(getAuthMeQueryKey(), TEST_USER);
  // React and the router log the caught error: expected here, noise in the output
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('route error', () => {
  it('should show an error page with a reload button when a page crashes', () => {
    renderApp('/');

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.queryByText(/secret internal detail/)).not.toBeInTheDocument();
  });
});
