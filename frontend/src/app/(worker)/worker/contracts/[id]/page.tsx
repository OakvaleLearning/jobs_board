import { WorkerContractDetail } from './view';

export default function WorkerContractDetailPage({ params }: { params: { id: string } }) {
  return <WorkerContractDetail contractId={params.id} />;
}
