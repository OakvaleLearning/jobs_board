'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PLACEMENT_SETTINGS,
  PLACEMENT_SETTING_LABELS,
  CATEGORY_EMPLOYMENT_TYPES,
  CATEGORY_EMPLOYMENT_TYPE_LABELS,
  IDENTITY_FIELD_KEYS,
  IDENTITY_FIELD_LABELS,
  COMPLIANCE_FIELD_KEYS,
  COMPLIANCE_FIELD_LABELS,
  type PlacementSetting,
  type CategoryEmploymentType,
  type IdentityFieldKey,
  type ComplianceFieldKey,
} from '@oakvale/shared/enums/workforce-category';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Field, Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { toast, toastApiError } from '@/lib/toast';
import { cn } from '@/lib/cn';
import {
  workforceCategoriesApi,
  type RequiredCertification,
  type WorkforceCategoryRow,
} from '@/lib/workforce-categories-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function WorkforceCategoriesView() {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();
  const [editing, setEditing] = useState<WorkforceCategoryRow | 'new' | null>(null);

  const list = useQuery({
    queryKey: ['workforceCategories', 'admin'],
    queryFn: () => workforceCategoriesApi.adminList(),
    enabled: hydrated,
  });

  const refresh = () => {
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ['workforceCategories'] });
  };

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · workforce categories"
        title="Workforce categories"
        description="Configure the categories workers and employers choose from. Only active categories are searchable and shown in profile and needs forms."
        actions={
          <Button onClick={() => setEditing((v) => (v === 'new' ? null : 'new'))}>
            {editing === 'new' ? 'Cancel' : 'New category'}
          </Button>
        }
      />

      {editing === 'new' ? (
        <CategoryForm onSaved={refresh} onCancel={() => setEditing(null)} />
      ) : null}

      <div className="space-y-3 mt-6">
        {(list.data ?? []).map((c) =>
          editing && editing !== 'new' && editing.id === c.id ? (
            <CategoryForm
              key={c.id}
              existing={c}
              onSaved={refresh}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardEyebrow>{c.slug}</CardEyebrow>
                  <CardTitle>{c.name}</CardTitle>
                  {c.description ? (
                    <p className="text-sm text-muted mt-2">{c.description}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.applicableSettings.map((s) => (
                      <Badge key={s} tone="brand" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                    {c.requiredComplianceFields.map((s) => (
                      <Badge key={s} tone="terracotta" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge tone={c.isActive ? 'sage' : 'neutral'}>
                    {c.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button variant="ghost" onClick={() => setEditing(c)}>
                    Edit
                  </Button>
                </div>
              </div>
            </Card>
          ),
        )}
        {(list.data ?? []).length === 0 && !list.isLoading ? (
          <Card className="text-muted text-sm">
            No categories yet. Create one to start configuring the workforce taxonomy.
          </Card>
        ) : null}
      </div>
    </AdminShell>
  );
}

/* --------------------------------- chips ---------------------------------- */

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

/** Free-text list editor (comma/enter to add) for the configurable skills menus. */
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

/* ---------------------------------- form ---------------------------------- */

function toggle<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function CategoryForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing?: WorkforceCategoryRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(existing);
  const [slug, setSlug] = useState(existing?.slug ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [requiredCertifications, setRequiredCertifications] = useState<RequiredCertification[]>(
    existing?.requiredCertifications ?? [],
  );
  const [requiredIdentityFields, setRequiredIdentityFields] = useState<IdentityFieldKey[]>(
    (existing?.requiredIdentityFields as IdentityFieldKey[]) ?? [],
  );
  const [skillsMenu, setSkillsMenu] = useState<string[]>(existing?.skillsMenu ?? []);
  const [specialistTags, setSpecialistTags] = useState<string[]>(existing?.specialistTags ?? []);
  const [applicableSettings, setApplicableSettings] = useState<PlacementSetting[]>(
    (existing?.applicableSettings as PlacementSetting[]) ?? [],
  );
  const [applicableEmploymentTypes, setApplicableEmploymentTypes] = useState<
    CategoryEmploymentType[]
  >((existing?.applicableEmploymentTypes as CategoryEmploymentType[]) ?? []);
  const [requiredComplianceFields, setRequiredComplianceFields] = useState<ComplianceFieldKey[]>(
    (existing?.requiredComplianceFields as ComplianceFieldKey[]) ?? [],
  );
  const [displayOrder, setDisplayOrder] = useState(existing?.displayOrder ?? 0);
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        description: description || undefined,
        requiredCertifications,
        requiredIdentityFields,
        skillsMenu,
        specialistTags,
        applicableSettings,
        applicableEmploymentTypes,
        requiredComplianceFields,
        displayOrder,
        isActive,
      };
      return isEdit
        ? workforceCategoriesApi.update(existing!.id, payload)
        : workforceCategoriesApi.create({ slug, ...payload });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Category updated.' : 'Category created.');
      onSaved();
    },
    onError: (e) => toastApiError(e, 'Could not save category.'),
  });

  return (
    <Card className="mt-6">
      <CardEyebrow>{isEdit ? `Edit · ${existing!.slug}` : 'New category'}</CardEyebrow>
      <CardTitle>{isEdit ? existing!.name : 'Configure a workforce category'}</CardTitle>

      <div className="mt-5 grid md:grid-cols-2 gap-4">
        {!isEdit ? (
          <Field label="Slug (UPPER_SNAKE_CASE · stable key)">
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
              placeholder="CERTIFIED_CAREGIVER"
            />
          </Field>
        ) : null}
        <Field label="Category name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
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
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <Field label="Required Oakvale certification(s), checked against worker records">
          <CertificationsEditor value={requiredCertifications} onChange={setRequiredCertifications} />
        </Field>

        <Field label="Required identity verification fields">
          <ChipGroup
            options={IDENTITY_FIELD_KEYS}
            labels={IDENTITY_FIELD_LABELS}
            selected={requiredIdentityFields}
            onToggle={(v) => setRequiredIdentityFields((s) => toggle(s, v))}
          />
        </Field>

        <Field label="Sector-specific skills menu">
          <TagListField
            values={skillsMenu}
            onChange={setSkillsMenu}
            placeholder="e.g. Medication reminders"
          />
        </Field>

        <Field label="Specialist skill tags">
          <TagListField
            values={specialistTags}
            onChange={setSpecialistTags}
            placeholder="e.g. Dementia care"
          />
        </Field>

        <Field label="Applicable placement settings">
          <ChipGroup
            options={PLACEMENT_SETTINGS}
            labels={PLACEMENT_SETTING_LABELS}
            selected={applicableSettings}
            onToggle={(v) => setApplicableSettings((s) => toggle(s, v))}
          />
        </Field>

        <Field label="Applicable employment types">
          <ChipGroup
            options={CATEGORY_EMPLOYMENT_TYPES}
            labels={CATEGORY_EMPLOYMENT_TYPE_LABELS}
            selected={applicableEmploymentTypes}
            onToggle={(v) => setApplicableEmploymentTypes((s) => toggle(s, v))}
          />
        </Field>

        <Field label="Required compliance fields">
          <ChipGroup
            options={COMPLIANCE_FIELD_KEYS}
            labels={COMPLIANCE_FIELD_LABELS}
            selected={requiredComplianceFields}
            onToggle={(v) => setRequiredComplianceFields((s) => toggle(s, v))}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-ink/30"
          />
          Active &amp; searchable
        </label>
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || !name || (!isEdit && !slug)}
        >
          {mut.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create category'}
        </Button>
      </div>
    </Card>
  );
}

function CertificationsEditor({
  value,
  onChange,
}: {
  value: RequiredCertification[];
  onChange: (next: RequiredCertification[]) => void;
}) {
  const update = (i: number, patch: Partial<RequiredCertification>) =>
    onChange(value.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-2">
      {value.map((c, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={c.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="Certification name"
          />
          <Input
            value={c.lmsCourseRef ?? ''}
            onChange={(e) => update(i, { lmsCourseRef: e.target.value || undefined })}
            placeholder="LMS course ref (optional)"
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
          >
            ✕
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        onClick={() => onChange([...value, { name: '' }])}
      >
        Add certification
      </Button>
    </div>
  );
}
