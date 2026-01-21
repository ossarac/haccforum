export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/$/, '')

let authToken: string | null = null

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

export function setApiToken(token: string | null) {
  authToken = token
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (options.headers) {
    if (options.headers instanceof Headers) {
      for (const [key, value] of options.headers.entries()) {
        headers[key] = value
      }
    } else if (Array.isArray(options.headers)) {
      for (const [key, value] of options.headers) {
        headers[key] = value
      }
    } else {
      Object.assign(headers, options.headers)
    }
  }

  if (authToken && !options.skipAuth) {
    headers.Authorization = `Bearer ${authToken}`
  }

  const response = await fetch(url, {
    ...options,
    headers
  })

  if (response.status === 204) {
    return undefined as T
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? 'Request failed'
    throw new ApiError(message, response.status, data)
  }

  return data as T
}
