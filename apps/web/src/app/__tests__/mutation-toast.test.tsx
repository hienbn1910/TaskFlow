import { useMutation } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import { ApiError } from '@/api/http';

import { AppProviders } from '../AppProviders';

const REQUEST_ID = '3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e34';

/** A button whose mutation always fails with `error`. */
function FailingAction({ error, toastOn = true }: { error: Error; toastOn?: boolean }) {
  const mutation = useMutation({
    mutationFn: async () => {
      await Promise.resolve();
      throw error;
    },
    meta: toastOn ? undefined : { toast: false },
  });
  return (
    <button
      type="button"
      onClick={() => {
        mutation.mutate();
      }}
    >
      Save
    </button>
  );
}

/** Clicks Save, waits for the mutation to fail. */
async function failWith(error: Error, toastOn = true) {
  render(
    <AppProviders>
      <FailingAction error={error} toastOn={toastOn} />
    </AppProviders>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
}

afterEach(() => {
  // sonner keeps its toasts in a module store: start each test without any
  toast.dismiss();
});

describe('mutation error toast', () => {
  it('should show the message and the Error ID of a failed mutation', async () => {
    await failWith(new ApiError({ status: 409, message: 'Already exists', requestId: REQUEST_ID }));

    expect(await screen.findByText('Already exists')).toBeInTheDocument();
    expect(screen.getByText(`Error ID: ${REQUEST_ID}`)).toBeInTheDocument();
  });

  it('should show a generic message for an error that is not an ApiError', async () => {
    await failWith(new Error('internal detail'));

    expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.queryByText('internal detail')).not.toBeInTheDocument();
  });

  it('should not show a toast when the mutation opts out', async () => {
    await failWith(new ApiError({ status: 409, message: 'Already exists' }), false);

    await expectNoToast('Already exists');
  });

  it('should not show a toast for a 401', async () => {
    await failWith(new ApiError({ status: 401, message: 'Unauthorized' }));

    await expectNoToast('Unauthorized');
  });
});

/** Gives a toast the time to appear, then checks it did not. */
async function expectNoToast(text: string) {
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByText(text)).not.toBeInTheDocument();
}
