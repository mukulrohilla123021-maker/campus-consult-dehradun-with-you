/**
 * Security rules specification & verification matrix for the Dirty Dozen adversarial payloads.
 * Intended for local @firebase/rules-unit-testing validation when Firebase Emulator is running.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  targetPath: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  expected: 'PERMISSION_DENIED';
  payloadSummary: Record<string, unknown>;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated category create',
    targetPath: 'service_categories/cat-01',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { id: 'cat-01', name: 'Accounting', status: 'active' },
  },
  {
    id: 2,
    name: 'Non-admin authenticated service create',
    targetPath: 'services/srv-01',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { id: 'srv-01', categoryId: 'cat-01', priceInr: 1500 },
  },
  {
    id: 3,
    name: 'Unverified email spoof attempt',
    targetPath: 'service_categories/cat-01',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { authTokenEmailVerified: false },
  },
  {
    id: 4,
    name: 'Self-assigned admin privilege escalation',
    targetPath: 'admins/attacker-uid',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { uid: 'attacker-uid', role: 'super_admin' },
  },
  {
    id: 5,
    name: 'Shadow field injection on category create',
    targetPath: 'service_categories/cat-01',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { id: 'cat-01', hackedFlag: true },
  },
  {
    id: 6,
    name: 'Oversized path variable poisoning',
    targetPath: `services/${'x'.repeat(300)}`,
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { idLength: 300 },
  },
  {
    id: 7,
    name: 'Orphaned service with nonexistent categoryId',
    targetPath: 'services/srv-orphan',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { id: 'srv-orphan', categoryId: 'nonexistent-cat' },
  },
  {
    id: 8,
    name: 'Immutable createdAt mutation on update',
    targetPath: 'services/srv-01',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { createdAt: '2020-01-01T00:00:00Z' },
  },
  {
    id: 9,
    name: 'Client-spoofed timestamp on create',
    targetPath: 'service_categories/cat-01',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { createdAt: '1999-01-01T00:00:00Z' },
  },
  {
    id: 10,
    name: 'Invalid status enum value',
    targetPath: 'service_categories/cat-01',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { status: 'draft_unlisted' },
  },
  {
    id: 11,
    name: 'Negative or sub-minimum INR price',
    targetPath: 'services/srv-01',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { priceInr: 10 },
  },
  {
    id: 12,
    name: 'Unfiltered list query exposing inactive catalog items',
    targetPath: 'service_categories',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { queryFilter: 'none' },
  },
];
