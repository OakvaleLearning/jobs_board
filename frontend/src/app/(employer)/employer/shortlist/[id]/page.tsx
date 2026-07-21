import { ShortlistDetailView } from './detail';

export default function IndividualEmployerShortlistDetailPage({ params }: { params: { id: string } }) {
  return <ShortlistDetailView id={params.id} />;
}
