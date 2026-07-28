'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { offersApi } from '@/lib/offers-api';
import { toast, toastApiError } from '@/lib/toast';
import {
  OFFER_ACCOMMODATION_TYPES,
  OFFER_CURRENCIES,
  type OfferAccommodationType,
  type OfferCurrency,
} from '@oakvale/shared/enums/offer';
import type { PipelineType } from '@oakvale/shared/enums/placement';

function defaultCurrency(pipelineType: PipelineType): OfferCurrency {
  return pipelineType === 'CORPORATE' ? 'NGN' : 'GBP';
}

export function SendOfferModal({
  open,
  onClose,
  shortlistId,
  workerId,
  workerName,
  pipelineType,
}: {
  open: boolean;
  onClose: () => void;
  shortlistId: string;
  workerId: string;
  workerName: string;
  pipelineType: PipelineType;
}) {
  const queryClient = useQueryClient();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [salary, setSalary] = useState('');
  const [currency, setCurrency] = useState<OfferCurrency>(defaultCurrency(pipelineType));
  const [accommodation, setAccommodation] = useState<OfferAccommodationType | ''>('');
  const [schedule, setSchedule] = useState('');
  const [notes, setNotes] = useState('');

  const salaryMajor = Number(salary);
  const canSubmit = startDate !== '' && salary !== '' && salaryMajor > 0;

  const create = useMutation({
    mutationFn: () =>
      offersApi.create({
        shortlistId,
        workerId,
        startDate,
        salaryAmountMinor: Math.round(salaryMajor * 100),
        salaryCurrency: currency,
        ...(endDate ? { endDate } : {}),
        ...(accommodation ? { accommodationType: accommodation } : {}),
        ...(schedule.trim() ? { schedule: schedule.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success('Offer sent for review.');
      void queryClient.invalidateQueries({ queryKey: ['employerOffers', shortlistId] });
      onClose();
    },
    onError: (e) => toastApiError(e, 'Could not send the offer.'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send an offer"
      description={`Terms go to our agents for review before ${workerName} sees them.`}
      size="lg"
    >
      <div className="space-y-4 text-left">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="offer-start">Start date *</Label>
            <Input
              id="offer-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="offer-end">End date (optional)</Label>
            <Input
              id="offer-end"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="offer-salary">Salary ({currency}) *</Label>
            <Input
              id="offer-salary"
              type="number"
              min={0}
              step="any"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              placeholder="e.g. 1500"
            />
          </div>
          <div>
            <Label htmlFor="offer-currency">Currency *</Label>
            <Select
              id="offer-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as OfferCurrency)}
            >
              {OFFER_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="offer-accommodation">Accommodation (optional)</Label>
            <Select
              id="offer-accommodation"
              value={accommodation}
              onChange={(e) => setAccommodation(e.target.value as OfferAccommodationType | '')}
            >
              <option value="">Not specified</option>
              {OFFER_ACCOMMODATION_TYPES.map((a) => (
                <option key={a} value={a}>
                  {a.replace('_', '-').toLowerCase()}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="offer-schedule">Schedule (optional)</Label>
            <Input
              id="offer-schedule"
              value={schedule}
              maxLength={200}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="e.g. Mon-Fri, 8am-5pm"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="offer-notes">Notes to our agents (optional)</Label>
          <Input
            id="offer-notes"
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the agent should know before this goes to the worker"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!canSubmit || create.isPending}>
            {create.isPending ? 'Sending…' : 'Send offer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
