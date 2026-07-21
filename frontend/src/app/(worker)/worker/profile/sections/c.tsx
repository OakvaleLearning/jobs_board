'use client';

import { useState } from 'react';
import { sectionCSchema } from '@oakvale/shared/schema/worker';
import { SectionFrame } from '../SectionFrame';
import { Button } from '@/components/ui/Button';
import { DocumentUpload } from '../DocumentUpload';
import { useSectionSave } from '../use-section-save';
import { toast } from '@/lib/toast';

interface SeedC {
  consentGiven?: boolean;
  policeCertificateDocumentId?: string | null;
  guarantorLetterDocumentId?: string | null;
  affidavitDocumentId?: string | null;
}

export function SectionC({ initial }: { initial: unknown }) {
  const { save, status } = useSectionSave('C');
  const seed = (initial ?? {}) as SeedC;
  const [checked, setChecked] = useState(Boolean(seed.consentGiven));
  const [police, setPolice] = useState<string | null>(seed.policeCertificateDocumentId ?? null);
  const [guarantor, setGuarantor] = useState<string | null>(seed.guarantorLetterDocumentId ?? null);
  const [affidavit, setAffidavit] = useState<string | null>(seed.affidavitDocumentId ?? null);

  function persist(next?: {
    consent?: boolean;
    police?: string | null;
    guarantor?: string | null;
    affidavit?: string | null;
  }) {
    const consent = next?.consent ?? checked;
    const parsed = sectionCSchema.safeParse({
      backgroundCheckConsent: consent || undefined,
      consentedAt: new Date().toISOString().slice(0, 10),
      policeCertificateDocumentId: next?.police ?? police,
      guarantorLetterDocumentId: next?.guarantor ?? guarantor,
      affidavitDocumentId: next?.affidavit ?? affidavit,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Consent required.');
      return;
    }
    save(parsed.data);
  }

  return (
    <SectionFrame
      letter="C"
      title="Background check"
      description="Consent, then upload your background documents — our team reviews them by hand."
      status={status}
    >
      <div className="space-y-6 max-w-2xl">
        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-ink/12 bg-cream-50 p-5 hover:border-ink/30 transition">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-4 w-4 accent-terracotta-500"
          />
          <span className="text-sm text-ink-600">
            I consent to Oakvale Learning Ltd reviewing the background documents I upload (criminal
            record, character references, and affidavit) as part of my verification. I confirm the
            documents are genuine and relate to me.
          </span>
        </label>

        <Button onClick={() => persist()} disabled={!checked}>Record consent</Button>

        <div className="space-y-4">
          <p className="text-eyebrow text-muted">
            Background documents · reviewed by an admin
          </p>
          <DocumentUpload
            category="POLICE_CHARACTER_CERT"
            label="Police character certificate"
            description="Certificate of Good Conduct / police character certificate. PDF, JPG, or PNG."
            documentId={police}
            onUploaded={(d) => { setPolice(d.id); persist({ police: d.id }); }}
            onDeleted={() => { setPolice(null); persist({ police: null }); }}
          />
          <DocumentUpload
            category="GUARANTOR_LETTER"
            label="Guarantor / attestation letter"
            description="A signed letter from a guarantor attesting to your character. PDF, JPG, or PNG."
            documentId={guarantor}
            onUploaded={(d) => { setGuarantor(d.id); persist({ guarantor: d.id }); }}
            onDeleted={() => { setGuarantor(null); persist({ guarantor: null }); }}
          />
          <DocumentUpload
            category="AFFIDAVIT_GOOD_CONDUCT"
            label="Sworn affidavit of good conduct"
            description="A sworn affidavit from a court or notary. PDF, JPG, or PNG."
            documentId={affidavit}
            onUploaded={(d) => { setAffidavit(d.id); persist({ affidavit: d.id }); }}
            onDeleted={() => { setAffidavit(null); persist({ affidavit: null }); }}
          />
        </div>
      </div>
    </SectionFrame>
  );
}
