'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { employersApi, type EmployerProfile } from '@/lib/employers-api';

export function NdpaStep({ profile, onNext }: { profile: EmployerProfile; onNext: () => void }) {
  const queryClient = useQueryClient();
  const [agreed, setAgreed] = useState(profile.ndpaConsentGiven);
  const mut = useMutation({
    mutationFn: employersApi.recordNdpaConsent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employerProfile'] });
      onNext();
    },
  });

  if (profile.ndpaConsentGiven) {
    return (
      <Card className="space-y-4">
        <Badge tone="sage">Consent recorded</Badge>
        <p className="text-sm text-ink-600">
          NDPA consent was recorded on {new Date(profile.ndpaConsentTimestamp ?? Date.now()).toLocaleString()}.
        </p>
        <div className="flex justify-end">
          <Button onClick={onNext}>Continue</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-5">
      <Badge tone="terracotta">Required for corporate accounts</Badge>
      <div className="space-y-3 text-sm text-ink-600 leading-relaxed">
        <p>
          Under the Nigeria Data Protection Act 2023 (NDPA), Oakvale Learning Ltd processes worker
          personal data on your behalf only with your written consent. By ticking the box below,
          you confirm that:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>You authorise Oakvale to share credentialed worker profiles with your nominated contacts.</li>
          <li>You will store and process those profiles in line with the NDPA principles of lawful purpose, minimisation, and accuracy.</li>
          <li>You will notify Oakvale of any data subject access request received from a worker placed with your organisation.</li>
          <li>You may withdraw this consent at any time, after which we will revoke access to worker data.</li>
        </ul>
      </div>
      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-ink/12 bg-cream-50 p-5 hover:border-ink/30 transition">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-4 w-4 accent-terracotta-500"
        />
        <span className="text-sm text-ink-600">
          I confirm I have authority to give NDPA 2023 data-processing consent on behalf of my organisation.
        </span>
      </label>
      <div className="flex justify-end gap-3">
        <Button onClick={() => mut.mutate()} disabled={!agreed || mut.isPending}>
          {mut.isPending ? 'Recording…' : 'Record consent'}
        </Button>
      </div>
    </Card>
  );
}
