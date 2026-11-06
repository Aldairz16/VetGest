export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ApiError' }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  const token = typeof window !== 'undefined' ? localStorage.getItem('vetgest_token') : null
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...authHeader,
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'No pudimos conectar con VetGest. Revisa tu conexión e inténtalo nuevamente.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/me') {
      if (typeof window !== 'undefined') localStorage.removeItem('vetgest_token')
      window.dispatchEvent(new Event('vetgest:session-expired'))
    }
    const msg = body?.error?.message ?? body?.message ?? 'No pudimos completar la solicitud. Inténtalo nuevamente.'
    throw new ApiError(response.status, msg)
  }
  if (response.status === 204) {
    return undefined as T
  }
  const data = await response.json()
  if (data && typeof data === 'object' && (data as { status?: string }).status === 'error') {
    throw new ApiError(400, (data as { message?: string }).message || 'Error en la solicitud')
  }
  if (data && typeof data === 'object' && typeof (data as { token?: string }).token === 'string') {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vetgest_token', (data as { token: string }).token)
    }
  }
  if (path === '/auth/logout' && typeof window !== 'undefined') {
    localStorage.removeItem('vetgest_token')
  }
  return data as T
}

export const json = (method: string, data?: unknown): RequestInit => ({ method, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) })
