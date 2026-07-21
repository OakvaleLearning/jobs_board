import { JobEditor } from './editor';

export default function CorporateJobEditorPage({ params }: { params: { id: string } }) {
  return <JobEditor id={params.id} />;
}
