'use client';

import { useQuery } from '@tanstack/react-query';
import { workersApi } from '@/lib/workers-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function ProfilePhoto() {
  const hydrated = useHydratedTokens();

  const docsQuery = useQuery({
    queryKey: ['workerDocuments'],
    queryFn: workersApi.listDocuments,
    enabled: hydrated,
  });

  const selfie = docsQuery.data
    ?.filter((d) => d.category === 'SELFIE' && d.status === 'CLEAN')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

  const urlQuery = useQuery({
    queryKey: ['documentUrl', selfie?.id],
    queryFn: () => workersApi.getDocumentUrl(selfie!.id),
    enabled: hydrated && Boolean(selfie),
    // Public R2 URLs never expire — no need to refresh
    staleTime: Infinity,
  });

  const url = urlQuery.data?.downloadUrl;

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL; next/image proxying would break the signature config
      <img
        src={url}
        alt="Your profile photo"
        className="h-16 w-16 rounded-full object-cover border border-ink/10 shadow-sm"
      />
    );
  }

  return (
    <div
      aria-hidden
      className="h-16 w-16 rounded-full bg-cream-200/60 border border-ink/10 flex items-center justify-center text-muted"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 19.5c1.5-3.2 4.2-4.8 7.5-4.8s6 1.6 7.5 4.8" strokeLinecap="round" />
      </svg>
    </div>
  );
}
