/**
 * lib/server/adminStore.ts
 *
 * Single shared in-memory store for the admin API surface
 * (`app/api/admin/users/**` and `app/api/admin/withdrawals/**`).
 *
 * Previously every route file declared its own `mockUsers` / `mockWithdrawals`
 * module-level array, so a mutation performed through one route was invisible
 * to the list route even within a single process. All admin routes now read
 * and write through this one module.
 *
 * NOTE: This is an in-memory store. State does not survive a server restart or
 * a serverless cold start, and it is not shared across instances. Replacing it
 * with a real database-backed data layer is tracked as out of scope in the
 * issue; the deliverable here is a consistent, observable single store plus
 * the authentication guard.
 */

export type AdminUserRole = 'USER' | 'CREATOR' | 'ADMIN';
export type AdminKycStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  kycStatus: AdminKycStatus;
  createdAt: string;
  isSuspended: boolean;
}

export type AdminWithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface AdminWithdrawal {
  id: string;
  amount: number;
  currency: string;
  status: AdminWithdrawalStatus;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  projectId: string;
  projectName: string;
  requestDate: string;
  processedDate?: string;
  transactionHash?: string;
  rejectionReason?: string;
  stellarAddress?: string;
}

// ── In-memory store (single instance per server process) ────────────────────

let users: AdminUser[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'USER',
    kycStatus: 'APPROVED',
    createdAt: '2024-01-15T10:30:00Z',
    isSuspended: false,
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'CREATOR',
    kycStatus: 'PENDING',
    createdAt: '2024-01-20T14:22:00Z',
    isSuspended: false,
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    role: 'USER',
    kycStatus: 'REJECTED',
    createdAt: '2024-02-01T09:15:00Z',
    isSuspended: false,
  },
  {
    id: '4',
    name: 'Alice Brown',
    email: 'alice@example.com',
    role: 'ADMIN',
    kycStatus: 'APPROVED',
    createdAt: '2024-02-10T16:45:00Z',
    isSuspended: false,
  },
  {
    id: '5',
    name: 'Charlie Wilson',
    email: 'charlie@example.com',
    role: 'CREATOR',
    kycStatus: 'APPROVED',
    createdAt: '2024-02-15T11:30:00Z',
    isSuspended: true,
  },
];

let withdrawals: AdminWithdrawal[] = [
  {
    id: '1',
    amount: 1000,
    currency: 'USD',
    status: 'PENDING',
    creatorId: 'creator1',
    creatorName: 'Alice Creator',
    creatorEmail: 'alice@example.com',
    projectId: 'project1',
    projectName: 'Community Garden Project',
    requestDate: '2024-03-15T10:30:00Z',
    stellarAddress: 'GD5XQZJZ5KQ4N5L5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q',
  },
  {
    id: '2',
    amount: 2500,
    currency: 'USD',
    status: 'APPROVED',
    creatorId: 'creator2',
    creatorName: 'Bob Builder',
    creatorEmail: 'bob@example.com',
    projectId: 'project2',
    projectName: 'School Renovation',
    requestDate: '2024-03-14T14:22:00Z',
    processedDate: '2024-03-15T09:15:00Z',
    stellarAddress: 'GD6YQZJZ5KQ4N5L5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q',
  },
  {
    id: '3',
    amount: 500,
    currency: 'USD',
    status: 'REJECTED',
    creatorId: 'creator3',
    creatorName: 'Charlie Artist',
    creatorEmail: 'charlie@example.com',
    projectId: 'project3',
    projectName: 'Public Art Installation',
    requestDate: '2024-03-13T16:45:00Z',
    processedDate: '2024-03-14T11:30:00Z',
    rejectionReason: 'Insufficient project documentation',
    stellarAddress: 'GD7YQZJZ5KQ4N5L5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q',
  },
  {
    id: '4',
    amount: 3000,
    currency: 'USD',
    status: 'COMPLETED',
    creatorId: 'creator4',
    creatorName: 'Diana Developer',
    creatorEmail: 'diana@example.com',
    projectId: 'project4',
    projectName: 'Tech Education Platform',
    requestDate: '2024-03-12T09:15:00Z',
    processedDate: '2024-03-13T14:22:00Z',
    transactionHash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    stellarAddress: 'GD8YQZJZ5KQ4N5L5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q',
  },
  {
    id: '5',
    amount: 1500,
    currency: 'USD',
    status: 'PENDING',
    creatorId: 'creator5',
    creatorName: 'Eve Entrepreneur',
    creatorEmail: 'eve@example.com',
    projectId: 'project5',
    projectName: 'Startup Incubator',
    requestDate: '2024-03-11T11:30:00Z',
    stellarAddress: 'GD9YQZJZ5KQ4N5L5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q',
  },
];

function nextId(items: { id: string }[]): string {
  const max = items.reduce((acc, item) => Math.max(acc, Number(item.id) || 0), 0);
  return String(max + 1);
}

// ── Users ───────────────────────────────────────────────────────────────────

export function listUsers(): AdminUser[] {
  return users;
}

export function getUserById(id: string): AdminUser | undefined {
  return users.find((u) => u.id === id);
}

export function createUser(data: Partial<AdminUser>): AdminUser {
  const newUser: AdminUser = {
    id: nextId(users),
    name: data.name ?? '',
    email: data.email ?? '',
    role: data.role ?? 'USER',
    kycStatus: data.kycStatus ?? 'PENDING',
    createdAt: new Date().toISOString(),
    isSuspended: false,
  };
  users.push(newUser);
  return newUser;
}

export function updateUserById(id: string, patch: Partial<AdminUser>): AdminUser | undefined {
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return undefined;
  users[index] = { ...users[index], ...patch };
  return users[index];
}

export function deleteUserById(id: string): boolean {
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return false;
  users.splice(index, 1);
  return true;
}

export function setUserRole(id: string, role: AdminUserRole): AdminUser | undefined {
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return undefined;
  users[index] = { ...users[index], role };
  return users[index];
}

export function setUserKycStatus(id: string, status: AdminKycStatus): AdminUser | undefined {
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return undefined;
  users[index] = { ...users[index], kycStatus: status };
  return users[index];
}

export function toggleUserSuspension(id: string): AdminUser | undefined {
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return undefined;
  users[index] = { ...users[index], isSuspended: !users[index].isSuspended };
  return users[index];
}

// ── Withdrawals ─────────────────────────────────────────────────────────────

export function listWithdrawals(): AdminWithdrawal[] {
  return withdrawals;
}

export function getWithdrawalById(id: string): AdminWithdrawal | undefined {
  return withdrawals.find((w) => w.id === id);
}

export function createWithdrawal(data: Partial<AdminWithdrawal>): AdminWithdrawal {
  const newWithdrawal: AdminWithdrawal = {
    id: nextId(withdrawals),
    amount: data.amount ?? 0,
    currency: data.currency ?? 'USD',
    status: 'PENDING',
    creatorId: data.creatorId ?? '',
    creatorName: data.creatorName ?? '',
    creatorEmail: data.creatorEmail ?? '',
    projectId: data.projectId ?? '',
    projectName: data.projectName ?? '',
    requestDate: new Date().toISOString(),
  };
  withdrawals.push(newWithdrawal);
  return newWithdrawal;
}

export function deleteWithdrawalById(id: string): boolean {
  const index = withdrawals.findIndex((w) => w.id === id);
  if (index === -1) return false;
  withdrawals.splice(index, 1);
  return true;
}

export function approveWithdrawal(id: string): AdminWithdrawal | undefined {
  const index = withdrawals.findIndex((w) => w.id === id);
  if (index === -1) return undefined;
  withdrawals[index] = {
    ...withdrawals[index],
    status: 'APPROVED',
    processedDate: new Date().toISOString(),
  };
  return withdrawals[index];
}

export function rejectWithdrawal(id: string, reason: string): AdminWithdrawal | undefined {
  const index = withdrawals.findIndex((w) => w.id === id);
  if (index === -1) return undefined;
  withdrawals[index] = {
    ...withdrawals[index],
    status: 'REJECTED',
    processedDate: new Date().toISOString(),
    rejectionReason: reason,
  };
  return withdrawals[index];
}

export function completeWithdrawal(id: string, transactionHash: string): AdminWithdrawal | undefined {
  const index = withdrawals.findIndex((w) => w.id === id);
  if (index === -1) return undefined;
  withdrawals[index] = {
    ...withdrawals[index],
    status: 'COMPLETED',
    processedDate: new Date().toISOString(),
    transactionHash,
  };
  return withdrawals[index];
}
