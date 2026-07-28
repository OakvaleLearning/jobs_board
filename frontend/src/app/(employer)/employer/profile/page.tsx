'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  employerProfileUpdateSchema,
  contactCreateSchema,
  type EmployerProfileUpdate,
  type ContactCreateInput,
} from '@oakvale/shared/schema/employer';
import { SECTORS, SECTOR_LABELS } from '@oakvale/shared/enums/worker';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { AccountSettings } from '@/components/account/AccountSettings';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { toast, toastApiError, toastFormErrors } from '@/lib/toast';
import { employersApi, type EmployerContact, type EmployerProfile } from '@/lib/employers-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export default function EmployerProfilePage() {
  const hydrated = useHydratedTokens();
  const me = useQuery({ queryKey: ['employerProfile'], queryFn: employersApi.me, enabled: hydrated });
  const profile = me.data;

  return (
    <EmployerShell config={profile?.employerTypeConfig}>
      <PageHeader
        eyebrow="My profile"
        title="Organisation & account."
        description="Keep your organisation details, contacts, and login up to date."
      />
      {profile ? (
        <div className="space-y-6">
          <OrgForm profile={profile} />
          <ContactsManager profile={profile} />
          <NeedsAssessmentCard profile={profile} />
          <AccountSettings />
        </div>
      ) : (
        <Card variant="glass">
          <p className="text-sm text-ink-600">Loading your profile…</p>
        </Card>
      )}
    </EmployerShell>
  );
}

function OrgForm({ profile }: { profile: EmployerProfile }) {
  const queryClient = useQueryClient();
  const isIndividualEmployer =
    profile.employerTypeConfig?.usesIndividualEmployerNeeds ??
    profile.employerType === 'INDIVIDUAL_EMPLOYER';

  const FOCUS_SECTORS = ['ELDERLY_CARE', 'CRECHE_EARLY_YEARS'] as const satisfies readonly (typeof SECTORS)[number][];
  const sectorLabels = FOCUS_SECTORS.map((s) => SECTOR_LABELS[s]);
  const legacySector = profile.sector && !sectorLabels.includes(profile.sector) ? profile.sector : null;
  const sectorOptions = [
    { value: '', label: 'Select a sector…' },
    ...(legacySector ? [{ value: legacySector, label: legacySector }] : []),
    ...sectorLabels.map((label) => ({ value: label, label })),
  ];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmployerProfileUpdate>({
    resolver: zodResolver(employerProfileUpdateSchema),
    defaultValues: {
      orgName: profile.orgName ?? '',
      sector: profile.sector ?? (isIndividualEmployer ? 'Family' : ''),
      regNumber: profile.regNumber ?? '',
      address: profile.address ?? '',
      website: profile.website ?? '',
      about: profile.about ?? '',
    },
  });

  const mut = useMutation({
    mutationFn: employersApi.updateMe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employerProfile'] });
      toast.success('Organisation details saved.');
    },
    onError: (e) => toastApiError(e, 'Could not save your details.'),
  });

  return (
    <Card variant="glass">
      <CardEyebrow>Organisation</CardEyebrow>
      <CardTitle>
        {isIndividualEmployer ? 'Household details.' : 'How you appear to workers.'}
      </CardTitle>
      <form
        onSubmit={handleSubmit((v) => mut.mutate(v), toastFormErrors)}
        className="mt-6 grid md:grid-cols-2 gap-5"
      >
        <Field
          label={isIndividualEmployer ? 'Family / household name' : 'Organisation name'}
          required
          error={errors.orgName?.message}
        >
          <Input {...register('orgName')} />
        </Field>
        {isIndividualEmployer ? (
          <Field label="Relationship (e.g. son)" error={errors.sector?.message}>
            <Input {...register('sector')} />
          </Field>
        ) : (
          <Field label="Sector" error={errors.sector?.message}>
            <Select {...register('sector')} options={sectorOptions} />
          </Field>
        )}
        {!isIndividualEmployer ? (
          <Field label="Registration number" error={errors.regNumber?.message}>
            <Input {...register('regNumber')} />
          </Field>
        ) : null}
        <Field label="Address" error={errors.address?.message}>
          <Input {...register('address')} />
        </Field>
        {!isIndividualEmployer ? (
          <Field label="Website" error={errors.website?.message}>
            <Input type="url" {...register('website')} placeholder="https://" />
          </Field>
        ) : null}
        <div className="md:col-span-2">
          <Field label="About" error={errors.about?.message}>
            <Textarea {...register('about')} />
          </Field>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={isSubmitting || mut.isPending}>
            {mut.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ContactsManager({ profile }: { profile: EmployerProfile }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  return (
    <Card variant="glass">
      <div className="flex items-center justify-between gap-4">
        <div>
          <CardEyebrow>Contacts</CardEyebrow>
          <CardTitle>Who we reach about placements & invoices.</CardTitle>
        </div>
        {editing === null ? (
          <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Add contact
          </Button>
        ) : null}
      </div>

      <div className="mt-6 space-y-3">
        {profile.contacts.length === 0 && editing !== 'new' ? (
          <p className="text-sm text-ink-600">No contacts yet. Add someone we can reach.</p>
        ) : null}

        {profile.contacts.map((c) =>
          editing === c.id ? (
            <ContactForm key={c.id} contact={c} onDone={() => setEditing(null)} />
          ) : (
            <ContactRow key={c.id} contact={c} onEdit={() => setEditing(c.id)} />
          ),
        )}

        {editing === 'new' ? <ContactForm onDone={() => setEditing(null)} /> : null}
      </div>
    </Card>
  );
}

function ContactRow({ contact, onEdit }: { contact: EmployerContact; onEdit: () => void }) {
  const queryClient = useQueryClient();
  const del = useMutation({
    mutationFn: () => employersApi.deleteContact(contact.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employerProfile'] });
      toast.success('Contact removed.');
    },
    onError: (e) => toastApiError(e, 'Could not remove the contact.'),
  });

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-ink/8 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">
          {contact.name}
          {contact.isPrimary ? <span className="ml-2 text-eyebrow text-brand-600">Primary</span> : null}
        </p>
        <p className="truncate text-sm text-ink-600">
          {[contact.position, contact.email, contact.phone].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Edit contact">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => del.mutate()}
          disabled={del.isPending}
          aria-label="Remove contact"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ContactForm({ contact, onDone }: { contact?: EmployerContact; onDone: () => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactCreateInput>({
    resolver: zodResolver(contactCreateSchema),
    defaultValues: {
      name: contact?.name ?? '',
      position: contact?.position ?? '',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      isPrimary: contact?.isPrimary ?? false,
    },
  });

  const mut = useMutation({
    mutationFn: (v: ContactCreateInput) =>
      contact ? employersApi.updateContact(contact.id, v) : employersApi.addContact(v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employerProfile'] });
      toast.success(contact ? 'Contact updated.' : 'Contact added.');
      onDone();
    },
    onError: (e) => toastApiError(e, 'Could not save the contact.'),
  });

  return (
    <form
      onSubmit={handleSubmit((v) => mut.mutate(v), toastFormErrors)}
      className="grid gap-4 rounded-2xl border border-brand-200 bg-brand-50/40 p-4 md:grid-cols-2"
    >
      <Field label="Full name" required error={errors.name?.message}>
        <Input {...register('name')} />
      </Field>
      <Field label="Position" error={errors.position?.message}>
        <Input {...register('position')} />
      </Field>
      <Field label="Email" required error={errors.email?.message}>
        <Input type="email" {...register('email')} />
      </Field>
      <Field label="Phone" required error={errors.phone?.message}>
        <Input type="tel" {...register('phone')} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink md:col-span-2">
        <input type="checkbox" className="h-4 w-4 accent-brand-500" {...register('isPrimary')} />
        Primary contact
      </label>
      <div className="flex justify-end gap-2 md:col-span-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={mut.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={mut.isPending}>
          {mut.isPending ? 'Saving…' : 'Save contact'}
        </Button>
      </div>
    </form>
  );
}

function NeedsAssessmentCard({ profile }: { profile: EmployerProfile }) {
  const cfg = profile.employerTypeConfig;
  if (!cfg?.usesIndividualEmployerNeeds && !cfg?.usesCorporateNeeds) return null;
  const label = cfg.usesIndividualEmployerNeeds ? 'Care assessment' : 'Workforce needs';

  return (
    <Card variant="glass">
      <CardEyebrow>{label}</CardEyebrow>
      <CardTitle>Tell us what you need.</CardTitle>
      <p className="mt-3 max-w-xl text-sm text-ink-600">
        Your {label.toLowerCase()} shapes the workers we shortlist for you. Edit it any time.
      </p>
      <Link
        href="/employer/needs-assessment"
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-5 h-11 text-sm font-medium text-ink transition-all hover:border-brand-500/40 hover:bg-cream-50"
      >
        <ClipboardList className="h-4 w-4 text-brand-500" /> Open {label.toLowerCase()}
      </Link>
    </Card>
  );
}
