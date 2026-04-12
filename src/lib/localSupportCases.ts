import type { BuyerSupportCase } from '@/types/agent';

const LOCAL_SUPPORT_CASES_STORAGE_KEY = 'ondc-local-support-cases';

function readSupportCaseStore(): BuyerSupportCase[] {
  const raw = localStorage.getItem(LOCAL_SUPPORT_CASES_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as BuyerSupportCase[];
  } catch {
    return [];
  }
}

function writeSupportCaseStore(cases: BuyerSupportCase[]) {
  localStorage.setItem(LOCAL_SUPPORT_CASES_STORAGE_KEY, JSON.stringify(cases));
}

export function listSupportCases(orderId?: string): BuyerSupportCase[] {
  const cases = readSupportCaseStore()
    .slice()
    .sort((left, right) => right.created_at.localeCompare(left.created_at));

  if (!orderId) {
    return cases;
  }

  return cases.filter((entry) => entry.order_id === orderId);
}

export function upsertSupportCase(nextCase: BuyerSupportCase): BuyerSupportCase {
  const cases = readSupportCaseStore();
  const index = cases.findIndex((entry) => entry.case_id === nextCase.case_id);

  if (index >= 0) {
    cases[index] = nextCase;
  } else {
    cases.unshift(nextCase);
  }

  writeSupportCaseStore(cases);
  return nextCase;
}

export function createLocalSupportCase(
  partialCase: Omit<BuyerSupportCase, 'case_id' | 'network_case_id' | 'created_at' | 'updated_at' | 'status'>,
): BuyerSupportCase {
  const now = new Date().toISOString();
  const supportCase: BuyerSupportCase = {
    case_id: `case-${Math.random().toString(36).slice(2, 10)}`,
    network_case_id: `ondc-case-${Math.random().toString(36).slice(2, 12)}`,
    status: 'open',
    created_at: now,
    updated_at: now,
    ...partialCase,
  };

  return upsertSupportCase(supportCase);
}
