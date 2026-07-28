'use client';

import { useEffect, useState } from 'react';
import { SectionFrame } from '../SectionFrame';
import { DocumentUpload } from '../DocumentUpload';
import { useSectionSave } from '../use-section-save';

export function SectionJ({ initial }: { initial: unknown }) {
  const { save, status } = useSectionSave('J');
  const seed = (initial as { videoIntroDocumentId?: string | null } | null) ?? {};
  const [docId, setDocId] = useState<string | null>(seed.videoIntroDocumentId ?? null);

  useEffect(() => {
    if (docId !== seed.videoIntroDocumentId) save({ videoIntroDocumentId: docId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  return (
    <SectionFrame
      letter="J"
      title="Video introduction"
      description="A short clip introducing yourself, 30 to 90 seconds. Optional, but it lifts shortlist rate."
      status={status}
    >
      <div className="max-w-xl">
        <DocumentUpload
          category="VIDEO_INTRO"
          label="Upload introduction video"
          description="MP4, MOV, or WebM. Max 10MB."
          onUploaded={(d) => setDocId(d.id)}
          onDeleted={() => setDocId(null)}
        />
      </div>
    </SectionFrame>
  );
}
