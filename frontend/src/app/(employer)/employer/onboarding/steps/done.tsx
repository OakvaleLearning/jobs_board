'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toastApiError } from '@/lib/toast';
import { employersApi, type EmployerProfile } from '@/lib/employers-api';

export function DoneStep({ profile, onFinish }: { profile: EmployerProfile; onFinish: () => void }) {
  const queryClient = useQueryClient();
  const mut = useMutation({
    mutationFn: employersApi.completeOnboarding,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['employerProfile'] });
      onFinish();
    },
    onError: (e) => toastApiError(e, 'Could not complete onboarding.'),
  });

  return (
    <Card className="space-y-5">
      <Badge tone="sage">Ready to go</Badge>
      <p className="text-sm text-ink-600">
        We have everything we need to build a shortlist. Head to your {profile.employerType === 'INDIVIDUAL_EMPLOYER' ? 'diaspora' : 'corporate'} dashboard
        to browse verified workers and (in the next slice) act on shortlists.
      </p>
      <div className="flex justify-end">
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? 'Finishing…' : 'Open my dashboard'}
        </Button>
      </div>
    </Card>
  );
}
