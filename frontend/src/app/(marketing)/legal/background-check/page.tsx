import { LegalPage } from '../LegalPage';

export const metadata = { title: 'Background Check Consent — Oakvale' };

export default function BackgroundCheckPage() {
  return (
    <LegalPage title="Background Check Consent">
      <p>
        As part of credentialing, Oakvale reviews background documents you upload — a police character
        certificate (certificate of good conduct), a guarantor/attestation letter, and a sworn affidavit
        of good conduct. By consenting, you confirm these documents are genuine and authorise Oakvale to
        review them to confirm your suitability for care and childcare placements.
      </p>
      <p>
        An Oakvale admin reviews the documents by hand and records the outcome (Pending, Clear, or
        Flagged) on your profile. If flagged, you will be notified and can re-upload clearer documents.
        The background result is advisory and shown to employers as a badge.
      </p>
    </LegalPage>
  );
}
