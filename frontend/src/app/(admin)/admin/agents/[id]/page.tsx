import { AdminAgentDetail } from './detail';

export default function AdminAgentPage({ params }: { params: { id: string } }) {
  return <AdminAgentDetail id={params.id} />;
}
