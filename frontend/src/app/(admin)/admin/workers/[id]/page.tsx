import { AdminWorkerDetail } from './detail';

export default function AdminWorkerDetailPage({ params }: { params: { id: string } }) {
  return <AdminWorkerDetail workerId={params.id} />;
}
