import { AdminPlacementDetail } from './detail';

export default function AdminPlacementDetailPage({ params }: { params: { id: string } }) {
  return <AdminPlacementDetail id={params.id} />;
}
