import PDFDocument from 'pdfkit';

export interface PlacementRecordData {
  placementId: string;
  pipeline: 'INDIVIDUAL_EMPLOYER' | 'CORPORATE';
  status: string;
  employer: { orgName: string | null; contactName: string | null; email: string };
  worker: { fullName: string | null; stateOfOrigin: string | null };
  dates: {
    placedAt: string | null;
    activatedAt: string | null;
    guaranteeExpiresAt: string | null;
    endedAt: string | null;
  };
  welfareCheckCount: number;
  replacementGuaranteeStatus: 'in-window' | 'expired' | 'not-activated';
  endReason: string | null;
  generatedAt: string;
}

/**
 * Pure data normaliser used by both the route handler and the test surface.
 */
export function normalisePlacementRecord(
  placement: {
    id: string;
    pipelineType: 'INDIVIDUAL_EMPLOYER' | 'CORPORATE';
    status: string;
    placedAt: Date | string | null;
    activatedAt: Date | string | null;
    guaranteeExpiresAt: Date | string | null;
    endedAt: Date | string | null;
    endReason: string | null;
  },
  employer: { orgName: string | null; contactName: string | null; email: string },
  worker: { fullName: string | null; stateOfOrigin: string | null },
  welfareCheckCount: number,
  now: Date = new Date(),
): PlacementRecordData {
  const guarantee = placement.guaranteeExpiresAt ? new Date(placement.guaranteeExpiresAt) : null;
  let guaranteeStatus: PlacementRecordData['replacementGuaranteeStatus'];
  if (!placement.activatedAt) {
    guaranteeStatus = 'not-activated';
  } else if (guarantee && guarantee > now) {
    guaranteeStatus = 'in-window';
  } else {
    guaranteeStatus = 'expired';
  }
  const iso = (d: Date | string | null) =>
    d ? (typeof d === 'string' ? d : d.toISOString()) : null;
  return {
    placementId: placement.id,
    pipeline: placement.pipelineType,
    status: placement.status,
    employer,
    worker,
    dates: {
      placedAt: iso(placement.placedAt),
      activatedAt: iso(placement.activatedAt),
      guaranteeExpiresAt: iso(placement.guaranteeExpiresAt),
      endedAt: iso(placement.endedAt),
    },
    welfareCheckCount,
    replacementGuaranteeStatus: guaranteeStatus,
    endReason: placement.endReason,
    generatedAt: now.toISOString(),
  };
}

export async function renderPlacementRecord(data: PlacementRecordData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Oakvale Learning', { align: 'left' });
    doc.fontSize(10).fillColor('#666').text('jobs board · placement record', { align: 'left' });
    doc.moveDown(1.5);
    doc.fillColor('#000');

    doc.fontSize(12).text(`Placement ID: ${data.placementId}`);
    doc.text(`Pipeline: ${data.pipeline}`);
    doc.text(`Status: ${data.status}`);
    doc.moveDown(0.5);

    doc.fontSize(14).text('Employer');
    doc.fontSize(11).fillColor('#333');
    doc.text(data.employer.orgName ?? data.employer.contactName ?? '—');
    doc.text(data.employer.email);
    doc.moveDown(0.5);
    doc.fillColor('#000');

    doc.fontSize(14).text('Worker (public-safe view)');
    doc.fontSize(11).fillColor('#333');
    doc.text(data.worker.fullName ?? '—');
    if (data.worker.stateOfOrigin) doc.text(`State of origin: ${data.worker.stateOfOrigin}`);
    doc.moveDown(0.5);
    doc.fillColor('#000');

    doc.fontSize(14).text('Key dates');
    doc.fontSize(11).fillColor('#333');
    doc.text(`Placed at: ${data.dates.placedAt ?? '—'}`);
    doc.text(`Activated at: ${data.dates.activatedAt ?? '—'}`);
    doc.text(`Guarantee expires: ${data.dates.guaranteeExpiresAt ?? '—'}`);
    if (data.dates.endedAt) doc.text(`Ended at: ${data.dates.endedAt} (${data.endReason ?? '—'})`);
    doc.moveDown(0.5);
    doc.fillColor('#000');

    doc.fontSize(14).text('Welfare history');
    doc.fontSize(11).fillColor('#333');
    doc.text(`${data.welfareCheckCount} welfare check${data.welfareCheckCount === 1 ? '' : 's'} on file`);
    doc.moveDown(0.5);
    doc.fillColor('#000');

    doc.fontSize(14).text('Replacement guarantee');
    doc.fontSize(11).fillColor('#333');
    doc.text(
      data.replacementGuaranteeStatus === 'in-window'
        ? 'Within 90-day window — replacement at no additional fee.'
        : data.replacementGuaranteeStatus === 'expired'
          ? 'Guarantee window expired — replacement fees apply.'
          : 'Placement not yet activated.',
    );
    doc.moveDown(1.5);
    doc.fillColor('#666').fontSize(9).text(`Generated ${data.generatedAt}`, { align: 'right' });

    doc.end();
  });
}
