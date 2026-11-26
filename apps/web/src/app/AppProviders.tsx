import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

import { queryClient } from './query-client';

/** The providers around the router, shared by main.tsx and the tests (src/test/render.tsx). */
export function AppProviders({ children }: { readonly children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" closeButton />
    </QueryClientProvider>
  );
}
