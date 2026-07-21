import { EmployerVerificationReview } from './review';

export default function AdminEmployerVerificationReviewPage({ params }: { params: { id: string } }) {
  return <EmployerVerificationReview employerId={params.id} />;
}
