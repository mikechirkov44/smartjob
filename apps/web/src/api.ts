const API_URL = import.meta.env.VITE_API_URL || '/api';

export type OrgRole = 'OWNER' | 'ADMIN' | 'HR' | 'VIEWER';
export type GlobalRole = 'SUPER_ADMIN' | 'USER';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: OrgRole;
    isActive?: boolean;
  }>;
};

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  organizationId?: string | null;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.organizationId) {
    headers['X-Organization-Id'] = options.organizationId;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method || (options.body ? 'POST' : 'GET'),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { message?: string | string[] }).message ||
      'Ошибка запроса';
    throw new ApiError(
      res.status,
      Array.isArray(message) ? message.join(', ') : String(message),
    );
  }
  return data as T;
}

type UploadOptions = {
  token?: string | null;
  organizationId?: string | null;
};

export async function uploadFile<T>(
  path: string,
  file: File,
  options: UploadOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.organizationId) {
    headers['X-Organization-Id'] = options.organizationId;
  }
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { message?: string | string[] }).message ||
      'Ошибка загрузки';
    throw new ApiError(
      res.status,
      Array.isArray(message) ? message.join(', ') : String(message),
    );
  }
  return data as T;
}
