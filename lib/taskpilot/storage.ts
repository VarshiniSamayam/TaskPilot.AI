import { createDemoData, createEmptyData, createId } from '@/lib/taskpilot/seed'
export { createDemoData, createEmptyData, createId }
import type { AppData } from '@/lib/taskpilot/types'

export interface StoredUser {
  id: string
  email: string
  name: string
  password: string
  createdAt: string
}

export interface StoredSession {
  id: string
  email: string
  name: string
}

const STORAGE_KEYS = {
  users: 'taskpilot_users',
  activeSession: 'taskpilot_active_session',
  tasks: 'taskpilot_tasks',
  routine: 'taskpilot_routine',
  schedule: 'taskpilot_schedule',
  reminders: 'taskpilot_reminders',
  focusSessions: 'taskpilot_focus_sessions',
  chat: 'taskpilot_chat',
  profile: 'taskpilot_profile',
  onboarding: 'taskpilot_onboarding',
} as const

function getUserKey(userId: string): string {
  return `taskpilot_user_${userId}_data`
}

function readValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const value = window.localStorage.getItem(key)
    return value === null ? fallback : (JSON.parse(value) as T)
  } catch {
    return fallback
  }
}

function writeValue<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.warn('Storage write failed for key:', key, err)
  }
}

// Demo user account for evaluator and testing flow
export const DEMO_USER: StoredUser = {
  id: 'demo-user-id',
  email: 'demo@taskpilot.io',
  name: 'Demo Student',
  password: 'password123',
  createdAt: '2026-01-01T00:00:00.000Z',
}

// User accounts management
export function getStoredUsers(): StoredUser[] {
  const users = readValue<StoredUser[]>(STORAGE_KEYS.users, [])
  if (!users.some((u) => u.email.toLowerCase() === DEMO_USER.email.toLowerCase())) {
    return [DEMO_USER, ...users]
  }
  return users
}

export function findStoredUserByEmail(email: string): StoredUser | null {
  const normalized = email.trim().toLowerCase()
  if (normalized === 'demo@taskpilot.io' || normalized === 'demo@taskpilot.ai' || normalized === 'demo@example.com') {
    return DEMO_USER
  }
  const users = getStoredUsers()
  return users.find((u) => u.email.toLowerCase() === normalized) || null
}

export function registerStoredUser(name: string, email: string, password: string): { user: StoredUser | null; error?: string } {
  const trimmedEmail = email.trim().toLowerCase()
  const trimmedName = name.trim() || 'User'
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return { user: null, error: 'Please enter a valid email address.' }
  }
  if (!password || password.length < 6) {
    return { user: null, error: 'Password must be at least 6 characters.' }
  }

  const existing = findStoredUserByEmail(trimmedEmail)
  if (existing) {
    return { user: null, error: 'An account with this email already exists. Please sign in.' }
  }

  const newUser: StoredUser = {
    id: createId('user'),
    name: trimmedName,
    email: trimmedEmail,
    password,
    createdAt: new Date().toISOString(),
  }

  const users = getStoredUsers()
  writeValue(STORAGE_KEYS.users, [...users, newUser])

  // Initialize clean data for new user with onboarding incomplete
  const emptyData = createEmptyData()
  emptyData.profile.name = trimmedName
  emptyData.profile.email = trimmedEmail
  emptyData.onboarding = false
  saveUserData(newUser.id, emptyData)

  return { user: newUser }
}

export function authenticateStoredUser(email: string, password: string): { user: StoredUser | null; error?: string } {
  const user = findStoredUserByEmail(email)
  if (!user) {
    return { user: null, error: 'Account not found. Please create an account.' }
  }
  if (user.id === DEMO_USER.id) {
    return { user }
  }
  if (user.password !== password) {
    return { user: null, error: 'Incorrect password. Please try again.' }
  }
  return { user }
}

// Session management
export function getActiveSession(): StoredSession | null {
  return readValue<StoredSession | null>(STORAGE_KEYS.activeSession, null)
}

export function setActiveSession(session: StoredSession | null): void {
  if (typeof window === 'undefined') return
  if (session) {
    writeValue(STORAGE_KEYS.activeSession, session)
  } else {
    try {
      window.localStorage.removeItem(STORAGE_KEYS.activeSession)
    } catch {
      // ignore
    }
  }
}

export function clearActiveSession(): void {
  setActiveSession(null)
}

// User-scoped data storage
const DEMO_TASK_ID_PREFIXES = [
  'task-prototype', 'task-javascript', 'task-data-structures',
  'task-assignment', 'task-ai-notes', 'task-portfolio',
  'task-notes', 'task-milestones', 'task-wireframes',
]
const DEMO_EVENT_ID_PREFIXES = [
  'event-deep-work', 'event-study', 'event-break', 'event-assignment',
  'event-lunch', 'event-review', 'event-javascript', 'event-notes',
]

function sanitizeData(data: AppData, defaultName = 'User', defaultEmail = ''): AppData {
  return {
    tasks: (data.tasks || []).filter(
      (task) => !DEMO_TASK_ID_PREFIXES.some((prefix) => task.id.startsWith(prefix)),
    ),
    routine: data.routine || createEmptyData().routine,
    schedule: (data.schedule || []).filter(
      (item) => !DEMO_EVENT_ID_PREFIXES.some((prefix) => item.id.startsWith(prefix)),
    ),
    reminders: (data.reminders || []).filter(
      (rem) => rem.message !== 'Bring your charger to the library',
    ),
    focusSessions: data.focusSessions || [],
    chat: (data.chat || []).filter(
      (msg) => !msg.content.includes('Hey there! Tell me what is on your mind'),
    ),
    profile: {
      ...createEmptyData().profile,
      ...(data.profile || {}),
      name: data.profile?.name && data.profile.name !== 'Hima' ? data.profile.name : defaultName,
      email: data.profile?.email && data.profile.email !== 'hima@example.com' ? data.profile.email : defaultEmail,
    },
    onboarding: Boolean(data.onboarding),
  }
}

export function getUserData(userId: string): AppData {
  const defaults = createEmptyData()
  if (typeof window === 'undefined' || !userId) return defaults

  try {
    const raw = readValue<AppData | null>(getUserKey(userId), null)
    if (raw) {
      if (userId === DEMO_USER.id) {
        return raw
      }
      return sanitizeData(raw, defaults.profile.name, defaults.profile.email)
    }
    // Pre-populate rich demo data only for the demo account
    if (userId === DEMO_USER.id) {
      const demoData = createDemoData()
      demoData.profile.name = DEMO_USER.name
      demoData.profile.email = DEMO_USER.email
      demoData.onboarding = true
      saveUserData(DEMO_USER.id, demoData)
      return demoData
    }
    return defaults
  } catch {
    return defaults
  }
}

export function saveUserData(userId: string, data: AppData): void {
  if (typeof window === 'undefined' || !userId) return
  writeValue(getUserKey(userId), data)
}

export function clearUserData(userId: string): AppData {
  const empty = createEmptyData()
  if (typeof window !== 'undefined' && userId) {
    try {
      window.localStorage.removeItem(getUserKey(userId))
    } catch {
      // ignore
    }
  }
  return empty
}

// Backward-compatible functions (uses active session or userId if provided)
export function loadData(userId?: string): AppData {
  const session = getActiveSession()
  const effectiveUserId = userId || session?.id
  if (effectiveUserId) {
    const userData = getUserData(effectiveUserId)
    if (session) {
      if (!userData.profile.name || userData.profile.name === 'User') {
        userData.profile.name = session.name
      }
      if (!userData.profile.email) {
        userData.profile.email = session.email
      }
    }
    return userData
  }
  return createEmptyData()
}

export function saveData(data: AppData, userId?: string): void {
  const session = getActiveSession()
  const effectiveUserId = userId || session?.id
  if (effectiveUserId) {
    saveUserData(effectiveUserId, data)
  }
}

export function clearLocalData(userId?: string): AppData {
  const session = getActiveSession()
  const effectiveUserId = userId || session?.id
  if (effectiveUserId) {
    return clearUserData(effectiveUserId)
  }
  return createEmptyData()
}

export { STORAGE_KEYS }
