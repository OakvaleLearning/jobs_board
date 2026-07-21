import { WorkerDetail } from './detail';

export default function EmployerWorkerDetailPage({ params }: { params: { id: string } }) {
  return <WorkerDetail id={params.id} />;
}
