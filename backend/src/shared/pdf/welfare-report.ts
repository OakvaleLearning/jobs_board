import PDFDocument from 'pdfkit';

export type WellbeingLevel = 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN';

export interface WelfareReportData {
  placementId: string;
  caseRef: string;
  generatedAt: string;
  scheduledAt: string | null;
  completedAt: string | null;
  recipientWellbeing: WellbeingLevel | null;
  workerAttendance: WellbeingLevel | null;
  issuesFlagged: boolean;
  notes: string | null;
  careRecipientName: string | null;
  workerFirstName: string | null;
  workerRoleCategory: string | null;
  placementStartDate: string | null;
  accountManager: { name: string | null; email: string | null };
}

const WELLBEING_COLOUR: Record<WellbeingLevel, string> = {
  GOOD: '#2e7d32',
  FAIR: '#ed6c02',
  POOR: '#c62828',
  UNKNOWN: '#666666',
};

const WELLBEING_LABEL: Record<WellbeingLevel, string> = {
  GOOD: 'Green · Good',
  FAIR: 'Amber · Fair',
  POOR: 'Red · Poor',
  UNKNOWN: 'Unknown',
};

function firstName(full: string | null): string | null {
  if (!full) return null;
  return full.split(/\s+/)[0] ?? full;
}

export function normaliseWelfareReport(input: {
  placement: {
    id: string;
    placedAt: Date | string | null;
  };
  check: {
    scheduledAt: Date | string | null;
    completedAt: Date | string | null;
    recipientWellbeing: string | null;
    workerAttendance: string | null;
    issuesFlagged: boolean;
    notes: string | null;
  };
  needs: { careRecipientName: string | null } | null;
  worker: { fullName: string | null; roleCategory: string | null };
  accountManager: { name: string | null; email: string | null };
  now?: Date;
}): WelfareReportData {
  const now = input.now ?? new Date();
  const iso = (d: Date | string | null) =>
    d ? (typeof d === 'string' ? d : d.toISOString()) : null;
  return {
    placementId: input.placement.id,
    caseRef: input.placement.id.slice(0, 8).toUpperCase(),
    generatedAt: now.toISOString(),
    scheduledAt: iso(input.check.scheduledAt),
    completedAt: iso(input.check.completedAt),
    recipientWellbeing: (input.check.recipientWellbeing as WellbeingLevel | null) ?? null,
    workerAttendance: (input.check.workerAttendance as WellbeingLevel | null) ?? null,
    issuesFlagged: input.check.issuesFlagged,
    notes: input.check.notes,
    careRecipientName: input.needs?.careRecipientName ?? null,
    workerFirstName: firstName(input.worker.fullName),
    workerRoleCategory: input.worker.roleCategory,
    placementStartDate: iso(input.placement.placedAt),
    accountManager: input.accountManager,
  };
}

export async function renderWelfareReport(data: WelfareReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).fillColor('#000').text('Oakvale Learning', { align: 'left' });
    doc.fontSize(11).fillColor('#666').text('Monthly Welfare Report', { align: 'left' });
    doc.moveDown(1.2);

    doc.fontSize(11).fillColor('#000');
    doc.text(`Case reference: ${data.caseRef}`);
    if (data.placementStartDate) {
      doc.text(`Placement started: ${data.placementStartDate.slice(0, 10)}`);
    }
    doc.moveDown(0.5);

    doc.fontSize(14).fillColor('#000').text('Care recipient');
    doc.fontSize(11).fillColor('#333').text(data.careRecipientName ?? '—');
    doc.moveDown(0.5);

    doc.fontSize(14).fillColor('#000').text('Worker');
    doc
      .fontSize(11)
      .fillColor('#333')
      .text(
        `${data.workerFirstName ?? '—'}${
          data.workerRoleCategory ? ` · ${data.workerRoleCategory}` : ''
        }`,
      );
    doc.moveDown(0.5);

    doc.fontSize(14).fillColor('#000').text('Check details');
    doc.fontSize(11).fillColor('#333');
    doc.text(`Scheduled: ${data.scheduledAt ?? '—'}`);
    doc.text(`Completed: ${data.completedAt ?? '—'}`);
    doc.moveDown(0.3);

    const wellbeing = data.recipientWellbeing ?? 'UNKNOWN';
    doc.fillColor('#000').text('Recipient wellbeing: ', { continued: true });
    doc.fillColor(WELLBEING_COLOUR[wellbeing]).text(WELLBEING_LABEL[wellbeing]);

    const attendance = data.workerAttendance ?? 'UNKNOWN';
    doc.fillColor('#000').text('Worker attendance: ', { continued: true });
    doc.fillColor(WELLBEING_COLOUR[attendance]).text(WELLBEING_LABEL[attendance]);

    doc
      .fillColor('#000')
      .text(`Issues flagged: ${data.issuesFlagged ? 'Yes — see notes below' : 'None'}`);
    doc.moveDown(0.5);

    doc.fontSize(14).fillColor('#000').text('Account manager notes');
    doc
      .fontSize(11)
      .fillColor('#333')
      .text(data.notes ?? 'No additional notes recorded.', { align: 'left' });
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#000').text('Your account manager');
    doc.fontSize(11).fillColor('#333');
    doc.text(data.accountManager.name ?? 'To be assigned');
    if (data.accountManager.email) doc.text(data.accountManager.email);
    doc.moveDown(1.5);

    doc
      .fillColor('#666')
      .fontSize(9)
      .text(
        `Generated ${data.generatedAt} · Oakvale Learning Ltd · jobs.oakvalelearning.com`,
        { align: 'right' },
      );

    doc.end();
  });
}
