'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardEyebrow } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { placementsApi } from '@/lib/placements-api';
import { toast, toastApiError } from '@/lib/toast';
import { cn } from '@/lib/cn';

/** Read-only star row on a 0–5 scale. */
export function StarDisplay({ value, count }: { value: number; count?: number }) {
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${value} out of 5`}>
      <span className="text-amber-500 tracking-tight" aria-hidden>
        {'★'.repeat(rounded)}
        <span className="text-ink/20">{'★'.repeat(5 - rounded)}</span>
      </span>
      <span className="text-sm text-ink-600 tabular-nums">
        {value.toFixed(1)}
        {count !== undefined ? ` · ${count} review${count === 1 ? '' : 's'}` : ''}
      </span>
    </span>
  );
}

/** Ratings + reviews card for a worker profile (employer/admin view). */
export function WorkerRatingsCard({ workerId }: { workerId: string }) {
  const q = useQuery({
    queryKey: ['workerRatings', workerId],
    queryFn: () => placementsApi.workerRatings(workerId),
  });
  const summary = q.data?.summary;
  const reviews = q.data?.reviews ?? [];

  return (
    <Card>
      <CardEyebrow>Placement ratings</CardEyebrow>
      {!summary || summary.count === 0 ? (
        <p className="text-sm text-muted mt-3">No ratings yet.</p>
      ) : (
        <>
          <div className="mt-3">
            <StarDisplay value={summary.average} count={summary.count} />
          </div>
          <ul className="mt-4 space-y-3">
            {reviews
              .filter((r) => r.review)
              .slice(0, 5)
              .map((r) => (
                <li key={r.id} className="border-l-2 border-ink/10 pl-3">
                  <StarDisplay value={r.stars} />
                  <p className="text-sm text-ink-600 mt-1">{r.review}</p>
                </li>
              ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/** Interactive rating form — the employer rates the worker for a placement. */
export function RateWorkerForm({
  placementId,
  workerId,
  onDone,
}: {
  placementId: string;
  workerId?: string;
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');

  const submit = useMutation({
    mutationFn: () => placementsApi.rateWorker(placementId, { stars, review: review.trim() || undefined }),
    onSuccess: () => {
      toast.success('Thanks — your rating has been recorded.');
      queryClient.invalidateQueries({ queryKey: ['employerPlacements'] });
      if (workerId) queryClient.invalidateQueries({ queryKey: ['workerRatings', workerId] });
      onDone?.();
    },
    onError: (e) => toastApiError(e, 'Could not save your rating.'),
  });

  return (
    <div>
      <p className="text-eyebrow text-muted">Rate this worker</p>
      <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            onClick={() => setStars(n)}
            className={cn(
              'text-2xl leading-none transition',
              n <= stars ? 'text-amber-500' : 'text-ink/20 hover:text-amber-400',
            )}
          >
            ★
          </button>
        ))}
      </div>
      <Textarea
        placeholder="Optional review"
        value={review}
        onChange={(e) => setReview(e.target.value)}
        className="mt-2 min-h-[72px]"
      />
      <Button
        size="sm"
        className="mt-2 w-full"
        disabled={stars < 1 || submit.isPending}
        onClick={() => submit.mutate()}
      >
        {submit.isPending ? 'Saving…' : 'Submit rating'}
      </Button>
    </div>
  );
}
