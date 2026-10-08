import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { AppData, FocusSession, Profile, Reminder, Routine, ScheduleItem, Task } from './types'
import { DEFAULT_PROFILE, DEFAULT_ROUTINE } from './types'

let clientInstance: SupabaseClient | null = null

export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (envUrl && envKey && !envUrl.includes('your-project') && !envKey.includes('your-supabase')) {
    return { url: envUrl.trim(), anonKey: envKey.trim() }
  }

  // Also allow client-side override stored in localStorage if entered in settings
  if (typeof window !== 'undefined') {
    try {
      const customUrl = window.localStorage.getItem('taskpilot_supabase_url')
      const customKey = window.localStorage.getItem('taskpilot_supabase_anon_key')
      if (customUrl && customKey && !customUrl.includes('your-project')) {
        return { url: customUrl.trim(), anonKey: customKey.trim() }
      }
    } catch {
      // Ignore storage read error
    }
  }

  return null
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig()
  if (!config) return null

  if (!clientInstance) {
    clientInstance = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }

  return clientInstance
}

export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseClient()
  if (!client) return null
  try {
    const { data, error } = await client.auth.getUser()
    if (error || !data.user) return null
    return data.user
  } catch {
    return null
  }
}

export async function signInWithEmail(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  const client = getSupabaseClient()
  if (!client) return { user: null, error: 'Supabase is not configured yet. Add your URL and Anon Key in Settings.' }
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) return { user: null, error: error.message }
    return { user: data.user, error: null }
  } catch (err) {
    return { user: null, error: err instanceof Error ? err.message : 'Sign in failed' }
  }
}

export async function signUpWithEmail(email: string, password: string, name?: string): Promise<{ user: User | null; error: string | null; confirmationNeeded?: boolean }> {
  const client = getSupabaseClient()
  if (!client) return { user: null, error: 'Supabase is not configured yet. Add your URL and Anon Key in Settings.' }
  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { name: name || 'User' },
      },
    })
    if (error) return { user: null, error: error.message }
    const confirmationNeeded = !data.session && Boolean(data.user)
    return { user: data.user, error: null, confirmationNeeded }
  } catch (err) {
    return { user: null, error: err instanceof Error ? err.message : 'Sign up failed' }
  }
}

export async function signOutUser(): Promise<{ error: string | null }> {
  const client = getSupabaseClient()
  if (!client) return { error: null }
  try {
    const { error } = await client.auth.signOut()
    if (error) return { error: error.message }
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Sign out failed' }
  }
}

// Convert database rows to AppData
export async function loadUserDataFromSupabase(userId: string): Promise<Partial<AppData>> {
  const client = getSupabaseClient()
  if (!client) return {}

  try {
    const [profileRes, routineRes, tasksRes, scheduleRes, remindersRes, focusRes] = await Promise.all([
      client.from('profiles').select('*').eq('id', userId).maybeSingle(),
      client.from('routines').select('*').eq('user_id', userId).maybeSingle(),
      client.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      client.from('scheduled_tasks').select('*').eq('user_id', userId).order('scheduled_date', { ascending: true }),
      client.from('reminders').select('*').eq('user_id', userId).order('reminder_time', { ascending: true }),
      client.from('focus_sessions').select('*').eq('user_id', userId).order('started_at', { ascending: false }),
    ])

    const profile: Profile = profileRes.data ? {
      name: profileRes.data.name || 'User',
      email: '',
      timezone: profileRes.data.timezone || 'Asia/Kolkata',
      timeFormat: profileRes.data.time_format || '12h',
      notifications: profileRes.data.notifications ?? true,
      theme: profileRes.data.theme || 'light',
    } : { ...DEFAULT_PROFILE }

    const routine: Routine = routineRes.data ? {
      wakeTime: (routineRes.data.wake_time || '07:00').slice(0, 5),
      sleepTime: (routineRes.data.sleep_time || '23:00').slice(0, 5),
      focusDuration: routineRes.data.focus_duration_minutes || 50,
      breakDuration: routineRes.data.break_minutes || 10,
      bufferDuration: routineRes.data.buffer_minutes || 15,
      preferredPeriod: routineRes.data.preferred_time_period || 'morning',
      energyPeriod: routineRes.data.energy_period || 'morning',
      breakEvery: routineRes.data.break_frequency || 2,
    } : { ...DEFAULT_ROUTINE }

    const tasks: Task[] = (tasksRes.data || []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description || '',
      category: row.category || 'Personal',
      priority: row.priority || 'medium',
      duration: row.duration_minutes || 50,
      deadline: row.deadline || new Date().toISOString().slice(0, 10),
      status: row.status || 'todo',
      preferredTime: row.preferred_time_period || 'morning',
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
      steps: Array.isArray(row.steps) ? row.steps : [],
    }))

    const schedule: ScheduleItem[] = (scheduleRes.data || []).map((row) => ({
      id: row.id,
      taskId: row.task_id || undefined,
      title: row.title,
      description: row.description || '',
      category: row.category || undefined,
      priority: row.priority || undefined,
      date: row.scheduled_date,
      startTime: (row.start_time || '09:00').slice(0, 5),
      endTime: (row.end_time || '09:50').slice(0, 5),
      minutes: row.minutes || 50,
      kind: row.kind || 'task',
      reason: row.reason || undefined,
      completed: Boolean(row.completed),
      missed: Boolean(row.missed),
    }))

    const reminders: Reminder[] = (remindersRes.data || []).map((row) => ({
      id: row.id,
      taskId: row.task_id || undefined,
      message: row.message,
      dueAt: row.reminder_time,
      delivered: Boolean(row.delivered_at || row.completed),
    }))

    const focusSessions: FocusSession[] = (focusRes.data || []).map((row) => ({
      id: row.id,
      date: row.date,
      minutes: row.minutes,
      taskId: row.task_id || undefined,
      taskTitle: row.task_title || 'Focus session',
    }))

    return {
      profile,
      routine,
      tasks,
      schedule,
      reminders,
      focusSessions,
      onboarding: Boolean(profileRes.data?.onboarding_complete),
    }
  } catch (error) {
    console.error('Failed to load user data from Supabase:', error)
    return {}
  }
}

// Ensure an ID is a valid UUID deterministically so updates and deletes target the same row
export function ensureUuid(id: string): string {
  if (!id) return '00000000-0000-4000-8000-000000000000'
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(id)) return id

  // Deterministic 128-bit UUID representation for non-UUID string IDs
  let h1 = 0xdeadbeef, h2 = 0x41c64e6d
  for (let i = 0; i < id.length; i++) {
    const ch = id.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0')
  const p2 = ((h2 >>> 16) & 0xffff).toString(16).padStart(4, '0')
  const p3 = '4' + ((h2 >>> 20) & 0x0fff).toString(16).padStart(3, '0')
  const p4 = '8' + ((h1 >>> 20) & 0x0fff).toString(16).padStart(3, '0')
  const p5 = ((h2 >>> 0) & 0xffffffffffff).toString(16).padStart(12, '0')
  return `${p1}-${p2}-${p3}-${p4}-${p5}`
}

// Sync single task
export async function syncTaskToSupabase(userId: string, task: Task): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return
  try {
    const validId = ensureUuid(task.id)
    await client.from('tasks').upsert({
      id: validId,
      user_id: userId,
      title: task.title,
      description: task.description || '',
      category: task.category,
      priority: task.priority,
      duration_minutes: task.duration,
      deadline: task.deadline,
      status: task.status,
      preferred_time_period: task.preferredTime,
      steps: task.steps || [],
      completed_at: task.completedAt || null,
      updated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('Failed to sync task to Supabase:', err)
  }
}

export async function deleteTaskFromSupabase(userId: string, taskId: string): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return
  try {
    const validId = ensureUuid(taskId)
    await client.from('tasks').delete().eq('user_id', userId).eq('id', validId)
  } catch (err) {
    console.warn('Failed to delete task from Supabase:', err)
  }
}

// Sync single schedule item
export async function syncScheduleItemToSupabase(userId: string, item: ScheduleItem): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return
  try {
    const validId = ensureUuid(item.id)
    const validTaskId = item.taskId ? ensureUuid(item.taskId) : null
    await client.from('scheduled_tasks').upsert({
      id: validId,
      user_id: userId,
      task_id: validTaskId,
      title: item.title,
      description: item.description || '',
      category: item.category || null,
      priority: item.priority || null,
      scheduled_date: item.date,
      start_time: item.startTime.length === 5 ? `${item.startTime}:00` : item.startTime,
      end_time: item.endTime.length === 5 ? `${item.endTime}:00` : item.endTime,
      minutes: item.minutes,
      kind: item.kind,
      reason: item.reason || null,
      completed: Boolean(item.completed),
      missed: Boolean(item.missed),
    })
  } catch (err) {
    console.warn('Failed to sync schedule item to Supabase:', err)
  }
}

export async function deleteScheduleItemFromSupabase(userId: string, itemId: string): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return
  try {
    const validId = ensureUuid(itemId)
    await client.from('scheduled_tasks').delete().eq('user_id', userId).eq('id', validId)
  } catch (err) {
    console.warn('Failed to delete schedule item from Supabase:', err)
  }
}

// Sync routine
export async function syncRoutineToSupabase(userId: string, routine: Routine): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return
  try {
    await client.from('routines').upsert({
      user_id: userId,
      wake_time: routine.wakeTime.length === 5 ? `${routine.wakeTime}:00` : routine.wakeTime,
      sleep_time: routine.sleepTime.length === 5 ? `${routine.sleepTime}:00` : routine.sleepTime,
      focus_duration_minutes: routine.focusDuration,
      break_minutes: routine.breakDuration,
      buffer_minutes: routine.bufferDuration,
      break_frequency: routine.breakEvery,
      preferred_time_period: routine.preferredPeriod,
      energy_period: routine.energyPeriod,
      updated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('Failed to sync routine to Supabase:', err)
  }
}

// Sync profile
export async function syncProfileToSupabase(userId: string, profile: Profile): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return
  try {
    await client.from('profiles').upsert({
      id: userId,
      name: profile.name,
      timezone: profile.timezone,
      time_format: profile.timeFormat,
      notifications: profile.notifications,
      theme: profile.theme,
      updated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('Failed to sync profile to Supabase:', err)
  }
}

// Sync reminder
export async function syncReminderToSupabase(userId: string, reminder: Reminder): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return
  try {
    const validId = ensureUuid(reminder.id)
    const validTaskId = reminder.taskId ? ensureUuid(reminder.taskId) : null
    await client.from('reminders').upsert({
      id: validId,
      user_id: userId,
      task_id: validTaskId,
      message: reminder.message,
      reminder_time: reminder.dueAt,
      completed: Boolean(reminder.delivered),
      delivered_at: reminder.delivered ? new Date().toISOString() : null,
    })
  } catch (err) {
    console.warn('Failed to sync reminder to Supabase:', err)
  }
}

export async function deleteReminderFromSupabase(userId: string, reminderId: string): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return
  try {
    const validId = ensureUuid(reminderId)
    await client.from('reminders').delete().eq('user_id', userId).eq('id', validId)
  } catch (err) {
    console.warn('Failed to delete reminder from Supabase:', err)
  }
}

// Sync focus session
export async function syncFocusSessionToSupabase(userId: string, session: FocusSession): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return
  try {
    const validId = ensureUuid(session.id)
    const validTaskId = session.taskId ? ensureUuid(session.taskId) : null
    await client.from('focus_sessions').insert({
      id: validId,
      user_id: userId,
      task_id: validTaskId,
      task_title: session.taskTitle,
      date: session.date,
      minutes: session.minutes,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('Failed to sync focus session to Supabase:', err)
  }
}
