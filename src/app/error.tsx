'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
      <div className="text-center max-w-md">
        <span className="text-5xl block mb-4">⚠️</span>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Something went wrong</h1>
        <p className="text-stone-500 mb-6">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-stone-900 text-white rounded-xl font-semibold hover:bg-stone-800 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
