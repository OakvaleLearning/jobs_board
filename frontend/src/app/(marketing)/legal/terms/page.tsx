import { LegalPage } from '../LegalPage';

export const metadata = { title: 'Terms of Service — Oakvale' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms govern your use of the Oakvale Jobs Portal. By creating an account you agree to use
        the platform lawfully, to provide accurate profile information, and to abide by Oakvale&rsquo;s
        code of conduct for placements.
      </p>
      <p>
        Workers must hold or be pursuing a valid Oakvale certification. Employers agree to the service,
        payment, and replacement terms set out in their service agreement. Oakvale mediates all
        worker–employer contact until a contract is signed.
      </p>
    </LegalPage>
  );
}
