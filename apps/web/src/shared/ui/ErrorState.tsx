interface ErrorStateProps {
  readonly message: string;
  readonly onRetry: () => void;
}

/** A query error shown in place of the content it failed to load, with a retry (spec §7). */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 p-6">
      <p className="text-danger">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-control border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
      >
        Try again
      </button>
    </div>
  );
}
