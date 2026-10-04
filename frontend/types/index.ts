export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';

export interface User {
  id: string;
  googleId?: string;
  name: string;
  email: string;
  picture: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface AuthResponseData {
  user: User;
  tokens: AuthTokens;
  token?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminApplicationItem {
  id: string;
  applicantGivenName: string;
  applicantSurname: string;
  applicantFullName: string;
  passportNumber: string | null;
  status: string | null;
  createdAt: string;
  updatedAt: string;
  originalPdfFileName?: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    picture: string | null;
  };
}

export interface AdminApplicationDetail {
  id: string;
  applicantGivenName: string;
  applicantSurname: string;
  applicantFullName: string;
  passportNumber: string | null;
  status: string | null;
  originalPdfFileName: string | null;
  originalPdfMimeType: string | null;
  applicationData: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    picture: string | null;
    role: UserRole;
    isActive: boolean;
    createdAt: string;
  };
}

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  picture: string | null;
  role: UserRole;
  isActive: boolean;
  hasPassword?: boolean;
  isMotherSuperAdmin?: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    applications: number;
  };
}

export interface AdminUserDetail {
  id: string;
  googleId: string;
  name: string;
  email: string;
  picture: string | null;
  role: UserRole;
  isActive: boolean;
  hasPassword?: boolean;
  isMotherSuperAdmin?: boolean;
  createdAt: string;
  updatedAt: string;
  totalApplications: number;
  applications: Array<{
    id: string;
    applicantGivenName: string;
    applicantSurname: string;
    applicantFullName: string;
    passportNumber: string | null;
    status: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalApplications: number;
  applicationsToday: number;
  applicationsThisMonth: number;
  totalAdmins: number;
  totalManagers: number;
  totalSuperAdmins: number;
  recentApplications: Array<{
    id: string;
    applicantGivenName: string;
    applicantSurname: string;
    applicantFullName: string;
    passportNumber: string | null;
    status: string | null;
    createdAt: string;
    updatedAt: string;
    user: {
      id: string;
      name: string;
      email: string;
      picture: string | null;
    };
  }>;
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    createdAt: string;
    picture: string | null;
  }>;
}

export interface AuditLogItem {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    picture: string | null;
  } | null;
}

export interface AdminSettings {
  configuredSuperAdminEmails: string[];
  roleCounts: {
    superAdmins: number;
    admins: number;
    managers: number;
    users: number;
  };
  environment: string;
  serverTime: string;
}
