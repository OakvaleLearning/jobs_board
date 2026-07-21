import { CorporateJobShortlist } from './view';

export default function CorporateJobShortlistPage({ params }: { params: { id: string } }) {
  return <CorporateJobShortlist jobId={params.id} />;
}
