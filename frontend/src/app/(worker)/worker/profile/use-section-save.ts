'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { WorkerSection } from '@oakvale/shared/enums/worker';
import { workersApi } from '@/lib/workers-api';
import { toastApiError } from '@/lib/toast';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved';

export function useSectionSave(section: WorkerSection) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>('idle');
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mutation = useMutation({
    mutationFn: async (body: unknown) => workersApi.patchSection(section, body),
    onMutate: () => {
      setStatus('saving');
    },
    onSuccess: (data) => {
      // Success feedback is the live "Saved" badge — a toast on every blur-save
      // would be noise. Only failures get a toast.
      setStatus('saved');
      queryClient.setQueryData(['workerCompletion'], data.profileCompletionPct);
      queryClient.invalidateQueries({ queryKey: ['workerProfile'] });
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => setStatus('idle'), 1800);
    },
    onError: (e: unknown) => {
      setStatus('dirty');
      toastApiError(e, 'Save failed.');
    },
  });

  const save = useCallback(
    (body: unknown) => {
      setStatus('dirty');
      mutation.mutate(body);
    },
    [mutation],
  );

  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  return { save, status, isSaving: mutation.isPending };
}
