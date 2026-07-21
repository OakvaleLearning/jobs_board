import { ReviewWorker } from './review';

export default function AdminWorkerReviewPage({ params }: { params: { id: string } }) {
  return <ReviewWorker workerId={params.id} />;
}
