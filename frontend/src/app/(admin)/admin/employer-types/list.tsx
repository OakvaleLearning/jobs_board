'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  VERIFICATION_METHODS,
  VERIFICATION_METHOD_LABELS,
  SERVICE_MODELS,
  SERVICE_MODEL_LABELS,
  ONBOARDING_STEP_KEYS,
  ONBOARDING_STEP_LABELS,
  type VerificationMethod,
  type ServiceModel,
  type OnboardingStepKey,
} from '@oakvale/shared/enums/employer-type';
import { CONTRACT_TYPES, type ContractType } from '@oakvale/shared/enums/contracts';
import { PAYMENT_PROVIDERS, CURRENCIES } from '@oakvale/shared/enums/payment';
import type { EmployerPricing } from '@oakvale/shared/schema/employer-type';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Field, Select } from '@/app/(worker)/worker/profile/SectionFrame';
import { cn } from '@/lib/cn';
import { employerTypesApi, type EmployerTypeRow } from '@/lib/employer-types-api';
import { workforceCategoriesApi } from '@/lib/workforce-categories-api';
import { toast, toastApiError } from '@/lib/toast';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function EmployerTypesView() {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();
  const [editing, setEditing] = useState<EmployerTypeRow | 'new' | null>(null);

  const list = useQuery({
    queryKey: ['employerTypes', 'admin'],
    queryFn: () => employerTypesApi.adminList(),
    enabled: hydrated,
  });

  const refresh = () => {
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ['employerTypes'] });
  };

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · employer types"
        title="Employer types"
        description="Configure the employer types signups choose from (§5). Each type drives registration, verification, pricing/gateway, job-posting, accessible worker categories, and contracts."
        actions={
          <Button onClick={() => setEditing((v) => (v === 'new' ? null : 'new'))}>
            {editing === 'new' ? 'Cancel' : 'New employer type'}
          </Button>
        }
      />

      {editing === 'new' ? <TypeForm onSaved={refresh} onCancel={() => setEditing(null)} /> : null}

      <div className="space-y-3 mt-6">
        {(list.data ?? []).map((t) =>
          editing && editing !== 'new' && editing.id === t.id ? (
            <TypeForm key={t.id} existing={t} onSaved={refresh} onCancel={() => setEditing(null)} />
          ) : (
            <Card key={t.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardEyebrow>
                    {t.slug} · {t.roleKey}
                  </CardEyebrow>
                  <CardTitle>{t.name}</CardTitle>
                  {t.description ? <p className="text-sm text-muted mt-2">{t.description}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="brand" className="text-[10px]">
                      {SERVICE_MODEL_LABELS[t.serviceModel as ServiceModel] ?? t.serviceModel}
                    </Badge>
                    <Badge tone={t.jobPostingEnabled ? 'sage' : 'neutral'} className="text-[10px]">
                      {t.jobPostingEnabled ? 'Job posting on' : 'No job posting'}
                    </Badge>
                    {t.paymentProviders.map((p) => (
                      <Badge key={p} tone="neutral" className="text-[10px]">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge tone={t.isActive ? 'sage' : 'neutral'}>
                    {t.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button variant="ghost" onClick={() => setEditing(t)}>
                    Edit
                  </Button>
                </div>
              </div>
            </Card>
          ),
        )}
        {(list.data ?? []).length === 0 && !list.isLoading ? (
          <Card className="text-muted text-sm">
            No employer types yet. Create one to start configuring the employer taxonomy.
          </Card>
        ) : null}
      </div>
    </AdminShell>
  );
}

function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
  labels,
}: {
  options: readonly T[];
  selected: string[];
  onToggle: (value: T) => void;
  labels?: Record<T, string>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition',
              on
                ? 'border-ink/40 bg-ink text-cream-50'
                : 'border-ink/12 bg-cream-50 text-muted hover:border-ink/30',
            )}
          >
            {labels ? labels[o] : o}
          </button>
        );
      })}
    </div>
  );
}

function TagListField({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft('');
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="ghost" onClick={add}>
          Add
        </Button>
      </div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="rounded-full border border-ink/20 bg-cream-50 px-3 py-1 text-xs text-ink hover:border-terracotta-500"
              title="Remove"
            >
              {v} ✕
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function toggle<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

type Money = { amountMinor: number; currency: string; provider: string };

function PriceEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Money | null;
  onChange: (next: Money | null) => void;
}) {
  const enabled = value !== null;
  const v = value ?? { amountMinor: 0, currency: 'NGN', provider: 'PAYSTACK' };
  return (
    <div className="rounded-xl border border-ink/8 bg-cream-50 p-3 space-y-2">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked ? v : null)}
          className="h-4 w-4"
        />
        {label}
      </label>
      {enabled ? (
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="number"
            min={0}
            value={String(v.amountMinor)}
            onChange={(e) => onChange({ ...v, amountMinor: Number(e.target.value) || 0 })}
            placeholder="Amount (minor)"
          />
          <Select
            value={v.currency}
            onChange={(e) => onChange({ ...v, currency: e.target.value })}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          />
          <Select
            value={v.provider}
            onChange={(e) => onChange({ ...v, provider: e.target.value })}
            options={PAYMENT_PROVIDERS.map((p) => ({ value: p, label: p }))}
          />
        </div>
      ) : null}
    </div>
  );
}

function TypeForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing?: EmployerTypeRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(existing);
  const [slug, setSlug] = useState(existing?.slug ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [roleKey, setRoleKey] = useState(existing?.roleKey ?? '');
  const [registrationFields, setRegistrationFields] = useState<string[]>(
    existing?.registrationFields ?? [],
  );
  const [verificationMethods, setVerificationMethods] = useState<VerificationMethod[]>(
    (existing?.verificationMethods as VerificationMethod[]) ?? [],
  );
  const [serviceModel, setServiceModel] = useState<ServiceModel>(
    (existing?.serviceModel as ServiceModel) ?? 'SELF_SERVICE',
  );
  const [jobPostingEnabled, setJobPostingEnabled] = useState(existing?.jobPostingEnabled ?? false);
  const [onboardingSteps, setOnboardingSteps] = useState<OnboardingStepKey[]>(
    (existing?.onboardingSteps as OnboardingStepKey[]) ?? [],
  );
  const [allCategories, setAllCategories] = useState(existing?.allowedWorkerCategoryIds == null);
  const [allowedCategoryIds, setAllowedCategoryIds] = useState<string[]>(
    existing?.allowedWorkerCategoryIds ?? [],
  );
  const [applicableContractTypes, setApplicableContractTypes] = useState<ContractType[]>(
    (existing?.applicableContractTypes as ContractType[]) ?? [],
  );
  const [subscription, setSubscription] = useState<Money | null>(
    existing?.pricing?.subscription ?? null,
  );
  const [placementFee, setPlacementFee] = useState<Money | null>(
    existing?.pricing?.placementFee ?? null,
  );
  const [paymentProviders, setPaymentProviders] = useState<string[]>(
    existing?.paymentProviders ?? [],
  );
  const [displayOrder, setDisplayOrder] = useState(existing?.displayOrder ?? 0);
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);

  const categories = useQuery({
    queryKey: ['workforceCategories', 'admin'],
    queryFn: () => workforceCategoriesApi.adminList(),
  });

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        description: description || undefined,
        roleKey,
        registrationFields,
        verificationMethods,
        serviceModel,
        jobPostingEnabled,
        onboardingSteps,
        allowedWorkerCategoryIds: allCategories ? null : allowedCategoryIds,
        applicableContractTypes,
        pricing: { subscription, placementFee } as EmployerPricing,
        paymentProviders: paymentProviders as ('STRIPE' | 'PAYSTACK')[],
        displayOrder,
        isActive,
      };
      return isEdit
        ? employerTypesApi.update(existing!.id, payload)
        : employerTypesApi.create({ slug, ...payload });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Employer type updated.' : 'Employer type created.');
      onSaved();
    },
    onError: (e) => toastApiError(e, 'Could not save employer type.'),
  });

  return (
    <Card className="mt-6">
      <CardEyebrow>{isEdit ? `Edit · ${existing!.slug}` : 'New employer type'}</CardEyebrow>
      <CardTitle>{isEdit ? existing!.name : 'Configure an employer type'}</CardTitle>

      <div className="mt-5 grid md:grid-cols-2 gap-4">
        {!isEdit ? (
          <Field label="Slug (UPPER_SNAKE_CASE · stable key)">
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
              placeholder="PRIVATE_HOUSEHOLD"
            />
          </Field>
        ) : null}
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Role key (lowercase · routing/landing key)">
          <Input
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            placeholder="private-household"
          />
        </Field>
        <Field label="Display order">
          <Input
            type="number"
            value={String(displayOrder)}
            onChange={(e) => setDisplayOrder(Number(e.target.value) || 0)}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Description">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <Field label="Service model">
          <Select
            value={serviceModel}
            onChange={(e) => setServiceModel(e.target.value as ServiceModel)}
            options={SERVICE_MODELS.map((s) => ({ value: s, label: SERVICE_MODEL_LABELS[s] }))}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={jobPostingEnabled}
            onChange={(e) => setJobPostingEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          Self-service job posting enabled
        </label>

        <Field label="Verification methods">
          <ChipGroup
            options={VERIFICATION_METHODS}
            labels={VERIFICATION_METHOD_LABELS}
            selected={verificationMethods}
            onToggle={(v) => setVerificationMethods((s) => toggle(s, v))}
          />
        </Field>

        <Field label="Onboarding steps (in order)">
          <ChipGroup
            options={ONBOARDING_STEP_KEYS}
            labels={ONBOARDING_STEP_LABELS}
            selected={onboardingSteps}
            onToggle={(v) => setOnboardingSteps((s) => toggle(s, v))}
          />
        </Field>

        <Field label="Registration fields">
          <TagListField
            values={registrationFields}
            onChange={setRegistrationFields}
            placeholder="e.g. orgName, regNumber"
          />
        </Field>

        <Field label="Applicable contract types">
          <ChipGroup
            options={CONTRACT_TYPES}
            selected={applicableContractTypes}
            onToggle={(v) => setApplicableContractTypes((s) => toggle(s, v))}
          />
        </Field>

        <Field label="Payment providers">
          <ChipGroup
            options={PAYMENT_PROVIDERS}
            selected={paymentProviders}
            onToggle={(v) => setPaymentProviders((s) => toggle(s, v))}
          />
        </Field>

        <div className="grid md:grid-cols-2 gap-3">
          <PriceEditor label="Subscription price" value={subscription} onChange={setSubscription} />
          <PriceEditor label="Placement fee" value={placementFee} onChange={setPlacementFee} />
        </div>

        <Field label="Accessible worker categories">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={allCategories}
                onChange={(e) => setAllCategories(e.target.checked)}
                className="h-4 w-4"
              />
              All categories
            </label>
            {!allCategories ? (
              <div className="flex flex-wrap gap-2">
                {(categories.data ?? []).map((c) => {
                  const on = allowedCategoryIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setAllowedCategoryIds((s) => toggle(s, c.id))}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs transition',
                        on
                          ? 'border-ink/40 bg-ink text-cream-50'
                          : 'border-ink/12 bg-cream-50 text-muted hover:border-ink/30',
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </Field>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4"
          />
          Active &amp; selectable at signup
        </label>
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || !name || !roleKey || (!isEdit && !slug)}
        >
          {mut.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create employer type'}
        </Button>
      </div>
    </Card>
  );
}
