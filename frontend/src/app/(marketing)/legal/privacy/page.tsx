import { LegalPage } from '../LegalPage';

export const metadata = { title: 'Privacy Policy | Oakvale' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy (NDPA 2023)">
      <p>
        Oakvale processes your personal data in accordance with the Nigeria Data Protection Act 2023
        (and, for UK-facing diaspora interactions, applicable UK GDPR principles). We collect the
        information you provide during registration and profile creation to verify your credentials and
        facilitate placements.
      </p>
      <p>
        Your personal contact details are never shown to employers until a contract is signed with your
        explicit consent. You may request access to, correction of, or erasure of your data at any time.
        Consent given at registration is recorded with a timestamp for audit purposes.
      </p>
    </LegalPage>
  );
}
