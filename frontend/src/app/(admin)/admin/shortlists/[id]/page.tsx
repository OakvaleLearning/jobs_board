import { ShortlistOverride } from './override';

export default function AdminShortlistOverridePage({ params }: { params: { id: string } }) {
  return <ShortlistOverride id={params.id} />;
}
