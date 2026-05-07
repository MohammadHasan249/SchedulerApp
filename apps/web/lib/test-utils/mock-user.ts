import { vi } from 'vitest';

export type AppUser = {
  id: string;
  email: string;
  role: 'org_admin' | 'branch_manager' | 'employee';
  organizationId: string;
  branchId: string | null;
};

export const mockOrgAdmin = (): AppUser => ({
  id: 'user-org-admin',
  email: 'admin@org.com',
  role: 'org_admin',
  organizationId: 'org-123',
  branchId: null,
});

export const mockBranchManager = (branchId = 'branch-123'): AppUser => ({
  id: 'user-branch-manager',
  email: 'manager@branch.com',
  role: 'branch_manager',
  organizationId: 'org-123',
  branchId,
});

export const mockEmployee = (branchId = 'branch-123'): AppUser => ({
  id: 'user-employee',
  email: 'emp@branch.com',
  role: 'employee',
  organizationId: 'org-123',
  branchId,
});

export const mockUnauthorizedUser = (): AppUser => ({
  id: 'user-other-org',
  email: 'hacker@evil.com',
  role: 'employee',
  organizationId: 'org-999', // Different org
  branchId: 'branch-999',
});

export function setupGetUserMock(user: AppUser | null = mockOrgAdmin()) {
  const mockGetUser = vi.fn();
  if (user === null) {
    // Simulate unauthenticated redirect
    mockGetUser.mockImplementation(() => {
      const error = new Error('NEXT_REDIRECT');
      (error as any).digest = 'NEXT_REDIRECT:/login';
      throw error;
    });
  } else {
    mockGetUser.mockResolvedValue(user);
  }
  return mockGetUser;
}

export function createMockRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  url: string = 'http://localhost:3000/api/test',
  body?: Record<string, any>
): Request {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  return new Request(url, init);
}
