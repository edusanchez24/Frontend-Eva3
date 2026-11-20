const BASE_URL = (import.meta.env.VITE_API_URL || 'https://backend-api-ivory-two.vercel.app').replace(/\/$/, '')
const ACCESS_KEY = 'sneakctrl_access'
const REFRESH_KEY = 'sneakctrl_refresh'

export type ApiErrorPayload = Record<string, unknown> | string | null

export class ApiError extends Error {
  status: number
  fields: Record<string, string[]>

  constructor(message: string, status: number, payload: ApiErrorPayload = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = parseFieldErrors(payload)
  }
}

function parseFieldErrors(payload: ApiErrorPayload): Record<string, string[]> {
  if (!payload || typeof payload === 'string' || Array.isArray(payload)) return {}
  const fields: Record<string, string[]> = {}
  Object.entries(payload).forEach(([key, value]) => {
    if (key === 'detail' || key === 'non_field_errors') return
    if (Array.isArray(value)) fields[key] = value.map(String)
    else if (typeof value === 'string') fields[key] = [value]
  })
  return fields
}

export function formatApiError(payload: ApiErrorPayload, status = 0): string {
  if (typeof payload === 'string' && payload.trim()) return payload
  if (payload && typeof payload === 'object') {
    const entries = Object.entries(payload).flatMap(([key, value]) => {
      if (key === 'detail') return [String(value)]
      const messages = Array.isArray(value) ? value.map(String) : [String(value)]
      return messages.map((message) => `${key}: ${message}`)
    })
    if (entries.length) return entries.join(' · ')
  }
  return status ? `Error ${status}: no se pudo completar la solicitud.` : 'No se pudo completar la solicitud.'
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(access: string, refresh?: string) {
  localStorage.setItem(ACCESS_KEY, access)
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refresh = getRefreshToken()
  if (!refresh) throw new Error('No hay una sesión activa.')
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${BASE_URL}/api/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        clearTokens()
        throw new ApiError(formatApiError(payload, response.status), response.status, payload)
      }
      const access = (payload as { access: string }).access
      setTokens(access)
      return access
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, allowRefresh = true): Promise<T> {
  const access = getAccessToken()
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json')
  if (access) headers.set('Authorization', `Bearer ${access}`)

  let response = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (response.status === 401 && allowRefresh && getRefreshToken() && !path.includes('/api/token/')) {
    try {
      const refreshed = await refreshAccessToken()
      headers.set('Authorization', `Bearer ${refreshed}`)
      response = await fetch(`${BASE_URL}${path}`, { ...options, headers })
    } catch (error) {
      clearTokens()
      throw error
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ApiErrorPayload
    throw new ApiError(formatApiError(payload, response.status), response.status, payload)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

