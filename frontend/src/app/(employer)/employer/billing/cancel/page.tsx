import Link from 'next/link';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';

export default function BillingCancelPage() {
  return (
    <EmployerShell config={null}>
      <PageHeader eyebrow="Checkout cancelled" title="No charge made." />
      <Card>
        <CardEyebrow>Checkout cancelled</CardEyebrow>
        <CardTitle>Your card was not charged.</CardTitle>
        <p className="text-sm text-ink-600 mt-3 max-w-xl">
          You can pick this back up whenever you&rsquo;re ready. The placement record stays in
          PENDING_PAYMENT and we&rsquo;ll resume from this exact point.
        </p>
        <p className="text-sm mt-6">
          <Link
            href="/employer/placement"
            className="underline underline-offset-4 text-ink"
          >
            Back to your placement
          </Link>
        </p>
      </Card>
    </EmployerShell>
  );
}
