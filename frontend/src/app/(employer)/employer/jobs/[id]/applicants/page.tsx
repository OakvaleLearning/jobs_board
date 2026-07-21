import { JobApplicants } from './view';

export default function JobApplicantsPage({ params }: { params: { id: string } }) {
  return <JobApplicants jobId={params.id} />;
}
