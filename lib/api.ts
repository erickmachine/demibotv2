const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://129.121.38.161:5001'

export function getApiBase() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('demibot_api_url') || API_BASE
  }
  return API_BASE
}

export function getToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('demibot_token') || ''
  }
  return ''
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('demibot_token', token)
  }
}

export function clearToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('demibot_token')
  }
}

export async function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiBase()
  const token = getToken()
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })
  if (res.status === 401) {
    clearToken()
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
    throw new Error('Nao autorizado')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
    throw new Error(err.error || 'Erro na requisicao')
  }
  return res.json()
}

export interface BotStatus {
  connected: boolean
  botName: string
  botNumber: string | null
  uptime: number
  stats: {
    messagesProcessed?: number
    commandsProcessed?: number
    connections?: number
  }
  totalGroups: number
}

export interface GroupRental {
  activatedAt: number
  expireAt: number
  duration: string
  activatedBy: string
  active: boolean
  remaining: string
  isExpired: boolean
}

export interface GroupConfig {
  antilink: boolean
  antifake: boolean
  antipalavra: boolean
  antisticker: boolean
  antiimg: boolean
  antivideo: boolean
  antiaudio: boolean
  antidoc: boolean
  antiflood: boolean
  anticall: boolean
  autoban: boolean
  autosticker: boolean
  autodl: boolean
  welcome: boolean
  goodbye: boolean
  x9viewonce: boolean
  x9adm: boolean
  soadm: boolean
  modoparceria: boolean
  limitexto: number
  maxWarnings: number
  welcomeMsg: string
  goodbyeMsg: string
  linkWhitelist: string[]
  prefix: string
  multiprefix: boolean
  nivel: boolean
}

export interface GroupInfo {
  id: string
  name: string
  members: number
  rental: GroupRental | null
  config: GroupConfig
}
