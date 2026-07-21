export const CONTRACT_TYPES = [
  'WORKER_PLACEMENT',
  'EMPLOYER_SERVICE',
  'ANNUAL_PARTNERSHIP',
] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_STATUSES = [
  'DRAFT',
  'AWAITING_WORKER',
  'AWAITING_EMPLOYER',
  'FULLY_EXECUTED',
  'SUPERSEDED',
  'TERMINATED',
  'DISPUTED',
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const SIGNATURE_PARTIES = ['WORKER', 'EMPLOYER', 'OAKVALE'] as const;
export type SignatureParty = (typeof SIGNATURE_PARTIES)[number];

export const SIGNATURE_METHODS = ['CHECKBOX_REAUTH', 'CHECKBOX_OTP'] as const;
export type SignatureMethod = (typeof SIGNATURE_METHODS)[number];

export function partiesForContractType(type: ContractType): SignatureParty[] {
  switch (type) {
    case 'WORKER_PLACEMENT':
      return ['WORKER', 'EMPLOYER'];
    case 'EMPLOYER_SERVICE':
      return ['EMPLOYER', 'OAKVALE'];
    case 'ANNUAL_PARTNERSHIP':
      return ['EMPLOYER', 'OAKVALE'];
  }
}
