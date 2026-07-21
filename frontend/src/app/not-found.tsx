import Link from 'next/link';

// Explicit, dependency-light 404 so the production export doesn't fall back to a
// generated page that renders client-only context during static export.
export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <p className="text-eyebrow text-muted">404</p>
        <h1 className="h-display text-3xl md:text-4xl">We couldn’t find that page.</h1>
        <p className="text-sm text-ink-600">
          The link may be broken or the page may have moved.
        </p>
        <Link
          href="/"
          className="inline-block rounded-full bg-ink px-5 py-2.5 text-sm text-cream-50 hover:bg-ink-600 transition"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
