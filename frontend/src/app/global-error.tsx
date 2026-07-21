'use client';

// Root error boundary (renders its own <html>/<body>, replacing the layout tree
// so the production export of /500 doesn't depend on the client Providers context).
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <p className="text-eyebrow text-muted">Something went wrong</p>
            <h1 className="h-display text-3xl md:text-4xl">An unexpected error occurred.</h1>
            <button
              type="button"
              onClick={() => reset()}
              className="inline-block rounded-full bg-ink px-5 py-2.5 text-sm text-cream-50 hover:bg-ink-600 transition"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
