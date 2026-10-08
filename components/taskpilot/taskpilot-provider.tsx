'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { addDays, createId, getDateInTimezone, timeFromMinutes, minutesFromTime } from '@/lib/taskpilot/seed'
import { createPlannerPlan, findNextAvailableTime, type PlannerResult } from '@/lib/taskpilot/planner'
import {
  authenticateStoredUser,
  clearActiveSession,
  clearUserData,
  createEmptyData,
  getActiveSession,
  getUserData,
  registerStoredUser,
  saveUserData,
  setActiveSession,
} from '@/lib/taskpilot/storage'
import {
  deleteReminderFromSupabase,
  deleteScheduleItemFromSupabase,
  deleteTaskFromSupabase,
  getSupabaseClient,
  isSupabaseConfigured,
  loadUserDataFromSupabase,
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
  syncFocusSessionToSupabase,
  syncProfileToSupabase,
  syncReminderToSupabase,
  syncRoutineToSupabase,
  syncScheduleItemToSupabase,
  syncTaskToSupabase,
} from '@/lib/taskpilot/supabase'
import type {
  AppData,
  AuthUser,
  Category,
  FocusSession,
  NewReminder,
  NewScheduleItem,
  NewTask,
  Priority,
  Profile,
  Reminder,
  Routine,
  ScheduleItem,
  Task,
  TimePeriod,
  ToastMessage,
  ToastTone,
} from '@/lib/taskpilot/types'
import { DEFAULT_PROFILE, DEFAULT_ROUTINE } from '@/lib/taskpilot/types'
import type { AssistantResponse } from '@/lib/taskpilot/gemini'

interface TaskPilotContextValue {
  data: AppData
  ready: boolean
  currentUser: AuthUser | null
  authLoading: boolean
  isSupabaseConnected: boolean
  toasts: ToastMessage[]
  toast: (message: string, tone?: ToastTone) => void
  dismissToast: (id: string) => void
  addTask: (task: NewTask) => Task
  updateTask: (id: string, changes: Partial<Task>) => void
  deleteTask: (id: string) => void
  completeTask: (id: string) => void
  toggleTaskStatus: (id: string) => void
  addSchedule: (item: NewScheduleItem) => ScheduleItem
  updateSchedule: (id: string, changes: Partial<ScheduleItem>) => void
  deleteSchedule: (id: string) => void
  scheduleTaskAt: (taskId: string, date: string, startTime: string) => ScheduleItem | null
  markScheduleMissed: (id: string) => void
  recoverMissedSchedule: (id: string, choice: 'next' | 'tomorrow' | 'keep') => ScheduleItem | null
  addReminder: (reminder: NewReminder) => Reminder
  deleteReminder: (id: string) => void
  addFocusSession: (session: Omit<FocusSession, 'id'>) => void
  saveRoutine: (routine: Routine) => void
  saveProfile: (profile: Profile) => void
  completeOnboarding: (profileData: Partial<Profile>, routineData: Partial<Routine>) => void
  addChatMessage: (role: 'user' | 'assistant', content: string) => void
  requestAiAssistant: (prompt: string) => Promise<AssistantResponse>
  generateDayPlan: () => PlannerResult
  generateWeekPlan: () => PlannerResult
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string; confirmationNeeded?: boolean }>
  signOut: () => Promise<void>
  configureSupabaseCredentials: (url: string, anonKey: string) => void
  clearData: () => void
}

const TaskPilotContext = createContext<TaskPilotContextValue | null>(null)

export function TaskPilotProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => createEmptyData())
  const [ready, setReady] = useState(false)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toastItem) => toastItem.id !== id))
  }, [])

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = createId('toast')
    setToasts((current) => [...current, { id, message, tone }].slice(-4))
    window.setTimeout(() => {
      setToasts((current) => current.filter((toastItem) => toastItem.id !== id))
    }, 4200)
  }, [])

  // Initial load: check active local session and/or Supabase session
  useEffect(() => {
    let mounted = true

    const init = async () => {
      // 1. Check local session
      const storedSession = getActiveSession()
      const client = getSupabaseClient()

      let activeUser: AuthUser | null = null

      if (storedSession) {
        activeUser = {
          id: storedSession.id,
          email: storedSession.email,
          name: storedSession.name,
        }
      } else if (client) {
        try {
          const { data: { session } } = await client.auth.getSession()
          if (session?.user) {
            activeUser = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || 'User',
            }
            setActiveSession(activeUser)
          }
        } catch (err) {
          console.warn('Supabase session check error:', err)
        }
      }

      if (!mounted) return

      if (activeUser) {
        setCurrentUser(activeUser)
        // Load isolated user data
        const userSavedData = getUserData(activeUser.id)

        // Try syncing from Supabase if connected
        let cloudData: Partial<AppData> = {}
        if (client) {
          try {
            cloudData = await loadUserDataFromSupabase(activeUser.id)
          } catch {
            // ignore
          }
        }

        const merged: AppData = {
          ...userSavedData,
          ...cloudData,
          profile: {
            ...userSavedData.profile,
            ...(cloudData.profile || {}),
            name: userSavedData.profile.name || activeUser.name,
            email: userSavedData.profile.email || activeUser.email,
          },
        }

        setData(merged)
      } else {
        setCurrentUser(null)
        setData(createEmptyData())
      }

      setReady(true)
      setAuthLoading(false)
    }

    init()

    return () => {
      mounted = false
    }
  }, [])

  // Persist user-isolated data whenever data changes
  useEffect(() => {
    if (ready && currentUser) {
      saveUserData(currentUser.id, data)
    }
  }, [data, currentUser, ready])

  // Reminder notifications check
  useEffect(() => {
    if (!ready || !currentUser || !data.profile.notifications) return
    const now = Date.now()
    const due = data.reminders.filter((reminder) => !reminder.delivered && new Date(reminder.dueAt).getTime() <= now)
    if (due.length === 0) return
    const dueIds = new Set(due.map((reminder) => reminder.id))
    setData((current) => ({
      ...current,
      reminders: current.reminders.map((reminder) => dueIds.has(reminder.id) ? { ...reminder, delivered: true } : reminder),
    }))
    due.forEach((reminder) => toast(reminder.message, 'info'))
  }, [currentUser, data.profile.notifications, data.reminders, ready, toast])

  // Theme application
  useEffect(() => {
    if (!ready) return
    const applyTheme = () => {
      const shouldUseDark = data.profile.theme === 'dark' || (
        data.profile.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches
      )
      document.documentElement.classList.toggle('dark', shouldUseDark)
    }
    applyTheme()
    if (data.profile.theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [data.profile.theme, ready])

  // Task operations
  const addTask = useCallback((input: NewTask) => {
    const task: Task = {
      ...input,
      id: input.id ?? createId('task'),
      status: input.status ?? 'todo',
      createdAt: input.createdAt ?? new Date().toISOString(),
    }
    setData((current) => {
      const nextTasks = [task, ...current.tasks]
      return { ...current, tasks: nextTasks }
    })
    toast(`Task added: "${task.title}"`)

    if (currentUser) {
      syncTaskToSupabase(currentUser.id, task)
    }
    return task
  }, [currentUser, toast])

  const updateTask = useCallback((id: string, changes: Partial<Task>) => {
    setData((current) => {
      let updatedTask: Task | undefined
      const nextTasks = current.tasks.map((task) => {
        if (task.id !== id) return task
        const next = { ...task, ...changes }
        if (changes.status === 'completed' && !next.completedAt) next.completedAt = new Date().toISOString()
        if (changes.status && changes.status !== 'completed') next.completedAt = undefined
        updatedTask = next
        return next
      })

      if (currentUser && updatedTask) {
        syncTaskToSupabase(currentUser.id, updatedTask)
      }

      return {
        ...current,
        tasks: nextTasks,
        schedule: changes.status === 'completed'
          ? current.schedule.map((item) => item.taskId === id ? { ...item, completed: true } : item)
          : current.schedule,
      }
    })
  }, [currentUser])

  const deleteTask = useCallback((id: string) => {
    setData((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== id),
      schedule: current.schedule.filter((item) => item.taskId !== id),
      reminders: current.reminders.filter((reminder) => reminder.taskId !== id),
    }))
    toast('Task deleted.', 'info')

    if (currentUser) {
      deleteTaskFromSupabase(currentUser.id, id)
    }
  }, [currentUser, toast])

  const completeTask = useCallback((id: string) => {
    const completedAt = new Date().toISOString()
    setData((current) => {
      let updatedTask: Task | undefined
      const nextTasks = current.tasks.map((task) => {
        if (task.id !== id) return task
        const next: Task = { ...task, status: 'completed', completedAt }
        updatedTask = next
        return next
      })

      if (currentUser && updatedTask) {
        syncTaskToSupabase(currentUser.id, updatedTask)
      }

      return {
        ...current,
        tasks: nextTasks,
        schedule: current.schedule.map((item) => item.taskId === id ? { ...item, completed: true } : item),
      }
    })
    toast('Task completed!')
  }, [currentUser, toast])

  const toggleTaskStatus = useCallback((id: string) => {
    setData((current) => {
      let updatedTask: Task | undefined
      const target = current.tasks.find((t) => t.id === id)
      if (!target) return current

      const nextStatus = target.status === 'completed' ? 'todo' : 'completed'
      const completedAt = nextStatus === 'completed' ? new Date().toISOString() : undefined

      const nextTasks = current.tasks.map((task) => {
        if (task.id !== id) return task
        const next: Task = { ...task, status: nextStatus, completedAt }
        updatedTask = next
        return next
      })

      if (currentUser && updatedTask) {
        syncTaskToSupabase(currentUser.id, updatedTask)
      }

      return {
        ...current,
        tasks: nextTasks,
        schedule: current.schedule.map((item) => item.taskId === id ? { ...item, completed: nextStatus === 'completed' } : item),
      }
    })
  }, [currentUser])

  // Schedule operations
  const addSchedule = useCallback((input: NewScheduleItem) => {
    const item: ScheduleItem = { ...input, id: input.id ?? createId('event') }
    setData((current) => ({ ...current, schedule: [...current.schedule, item] }))
    toast('Added to calendar.')

    if (currentUser) {
      syncScheduleItemToSupabase(currentUser.id, item)
    }
    return item
  }, [currentUser, toast])

  const updateSchedule = useCallback((id: string, changes: Partial<ScheduleItem>) => {
    setData((current) => {
      let updatedItem: ScheduleItem | undefined
      const nextSchedule = current.schedule.map((item) => {
        if (item.id !== id) return item
        const next = { ...item, ...changes }
        updatedItem = next
        return next
      })

      if (currentUser && updatedItem) {
        syncScheduleItemToSupabase(currentUser.id, updatedItem)
      }

      return { ...current, schedule: nextSchedule }
    })
  }, [currentUser])

  const deleteSchedule = useCallback((id: string) => {
    setData((current) => ({ ...current, schedule: current.schedule.filter((item) => item.id !== id) }))
    toast('Calendar item removed.', 'info')

    if (currentUser) {
      deleteScheduleItemFromSupabase(currentUser.id, id)
    }
  }, [currentUser, toast])

  const scheduleTaskAt = useCallback((taskId: string, date: string, startTime: string) => {
    const task = data.tasks.find((item) => item.id === taskId)
    if (!task) return null
    const start = findNextAvailableTime({
      date,
      minutes: task.duration,
      routine: data.routine,
      schedule: data.schedule,
      timezone: data.profile.timezone,
      fromTime: startTime,
    })
    if (!start) {
      toast('Not enough open time on that day. Try another date.', 'warning')
      return null
    }
    const startMinute = minutesFromTime(start)
    const item: ScheduleItem = {
      id: createId('event'),
      taskId: task.id,
      title: task.title,
      category: task.category,
      priority: task.priority,
      date,
      startTime: start,
      endTime: timeFromMinutes(startMinute + task.duration),
      minutes: task.duration,
      kind: 'task',
      reason: 'Scheduled from your task list.',
    }
    setData((current) => ({ ...current, schedule: [...current.schedule, item] }))
    toast(start === startTime ? 'Task scheduled.' : `Scheduled at next open slot: ${start}.`)

    if (currentUser) {
      syncScheduleItemToSupabase(currentUser.id, item)
    }
    return item
  }, [currentUser, data.profile.timezone, data.routine, data.schedule, data.tasks, toast])

  const markScheduleMissed = useCallback((id: string) => {
    setData((current) => {
      let updatedItem: ScheduleItem | undefined
      const nextSchedule = current.schedule.map((item) => {
        if (item.id !== id) return item
        const next = { ...item, missed: true }
        updatedItem = next
        return next
      })
      if (currentUser && updatedItem) {
        syncScheduleItemToSupabase(currentUser.id, updatedItem)
      }
      return { ...current, schedule: nextSchedule }
    })
  }, [currentUser])

  const recoverMissedSchedule = useCallback((id: string, choice: 'next' | 'tomorrow' | 'keep') => {
    const missedItem = data.schedule.find((item) => item.id === id)
    if (!missedItem) return null
    if (choice === 'keep') {
      markScheduleMissed(id)
      toast('Kept on your task list.', 'info')
      return null
    }
    const task = missedItem.taskId ? data.tasks.find((item) => item.id === missedItem.taskId) : undefined
    const duration = task?.duration ?? missedItem.minutes
    const firstDate = choice === 'tomorrow' ? addDays(missedItem.date, 1) : missedItem.date
    const firstTime = choice === 'tomorrow' ? data.routine.wakeTime : missedItem.endTime
    const available = data.schedule.filter((item) => item.id !== id)
    let date = firstDate
    let start = findNextAvailableTime({
      date,
      minutes: duration,
      routine: data.routine,
      schedule: available,
      timezone: data.profile.timezone,
      fromTime: firstTime,
    })
    if (!start && choice === 'next') {
      date = addDays(missedItem.date, 1)
      start = findNextAvailableTime({
        date,
        minutes: duration,
        routine: data.routine,
        schedule: available,
        timezone: data.profile.timezone,
        fromTime: data.routine.wakeTime,
      })
    }
    if (!start) {
      toast('There is no open slot yet.', 'warning')
      return null
    }
    const startMinute = minutesFromTime(start)
    const moved: ScheduleItem = {
      ...missedItem,
      id: createId('event'),
      date,
      startTime: start,
      endTime: timeFromMinutes(startMinute + duration),
      minutes: duration,
      missed: false,
      completed: false,
      reason: 'Moved to next available focus window.',
    }
    setData((current) => ({
      ...current,
      schedule: current.schedule.map((item) => item.id === id ? { ...item, missed: true } : item).concat(moved),
    }))
    toast(`Rescheduled to ${date === missedItem.date ? 'the next open slot' : 'tomorrow'}.`)

    if (currentUser) {
      syncScheduleItemToSupabase(currentUser.id, moved)
    }
    return moved
  }, [currentUser, data.profile.timezone, data.routine, data.schedule, data.tasks, markScheduleMissed, toast])

  // Reminders
  const addReminder = useCallback((input: NewReminder) => {
    const reminder: Reminder = { ...input, id: input.id ?? createId('reminder'), delivered: input.delivered ?? false }
    setData((current) => ({ ...current, reminders: [...current.reminders, reminder] }))
    toast('Reminder saved.')

    if (currentUser) {
      syncReminderToSupabase(currentUser.id, reminder)
    }
    return reminder
  }, [currentUser, toast])

  const deleteReminder = useCallback((id: string) => {
    setData((current) => ({ ...current, reminders: current.reminders.filter((reminder) => reminder.id !== id) }))
    toast('Reminder removed.', 'info')

    if (currentUser) {
      deleteReminderFromSupabase(currentUser.id, id)
    }
  }, [currentUser, toast])

  // Focus sessions
  const addFocusSession = useCallback((session: Omit<FocusSession, 'id'>) => {
    const newSession: FocusSession = { ...session, id: createId('focus') }
    setData((current) => ({ ...current, focusSessions: [...current.focusSessions, newSession] }))
    toast('Focus session recorded.')

    if (currentUser) {
      syncFocusSessionToSupabase(currentUser.id, newSession)
    }
  }, [currentUser, toast])

  // Routine & Profile
  const saveRoutine = useCallback((routine: Routine) => {
    setData((current) => ({ ...current, routine }))
    toast('Routine saved.')

    if (currentUser) {
      syncRoutineToSupabase(currentUser.id, routine)
    }
  }, [currentUser, toast])

  const saveProfile = useCallback((profile: Profile) => {
    setData((current) => ({ ...current, profile }))
    toast('Settings saved.')

    if (currentUser) {
      syncProfileToSupabase(currentUser.id, profile)
    }
  }, [currentUser, toast])

  const completeOnboarding = useCallback((profileData: Partial<Profile>, routineData: Partial<Routine>) => {
    setData((current) => {
      const updatedProfile = { ...current.profile, ...profileData }
      const updatedRoutine = { ...current.routine, ...routineData }
      const updated: AppData = {
        ...current,
        profile: updatedProfile,
        routine: updatedRoutine,
        onboarding: true,
      }
      if (currentUser) {
        saveUserData(currentUser.id, updated)
        syncProfileToSupabase(currentUser.id, updatedProfile)
        syncRoutineToSupabase(currentUser.id, updatedRoutine)
      }
      return updated
    })
    toast('Welcome to your personal workspace!')
  }, [currentUser, toast])

  const addChatMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setData((current) => ({
      ...current,
      chat: [...current.chat, { id: createId('message'), role, content, createdAt: new Date().toISOString() }],
    }))
  }, [])

  // Day & Week Planner
  const generatePlan = useCallback((days: number) => {
    const startDate = getDateInTimezone(new Date(), data.profile.timezone)
    const result = createPlannerPlan({
      tasks: data.tasks,
      routine: data.routine,
      schedule: data.schedule,
      startDate,
      timezone: data.profile.timezone,
      days,
    })
    const planDates = new Set(Array.from({ length: days }, (_, index) => addDays(startDate, index)))
    const removedItems = data.schedule.filter((item) => {
      if (!planDates.has(item.date)) return false
      if (item.kind === 'break') return true
      if (item.kind === 'task' && !item.completed && !item.missed) return true
      return false
    })

    setData((current) => {
      const nextSchedule = [
        ...current.schedule.filter((item) => {
          if (!planDates.has(item.date)) return true
          if (item.kind === 'break') return false
          if (item.kind === 'task' && !item.completed && !item.missed) return false
          return true
        }),
        ...result.items,
      ]
      return { ...current, schedule: nextSchedule }
    })

    if (currentUser) {
      removedItems.forEach((item) => deleteScheduleItemFromSupabase(currentUser.id, item.id))
      result.items.forEach((item) => syncScheduleItemToSupabase(currentUser.id, item))
    }

    toast(days > 2 ? 'Your week plan has been created.' : 'Your day has been shaped around your priorities.')
    return result
  }, [currentUser, data.profile.timezone, data.routine, data.schedule, data.tasks, toast])

  const generateDayPlan = useCallback(() => generatePlan(2), [generatePlan])
  const generateWeekPlan = useCallback(() => generatePlan(7), [generatePlan])

  // Real AI Assistant API call & immediate task dispatch
  const requestAiAssistant = useCallback(async (userPrompt: string): Promise<AssistantResponse> => {
    addChatMessage('user', userPrompt)

    try {
      const customKey = typeof window !== 'undefined' ? window.localStorage.getItem('taskpilot_gemini_key') || '' : ''
      const res = await fetch('/api/taskpilot/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customKey ? { 'x-gemini-key': customKey } : {}),
        },
        body: JSON.stringify({
          prompt: userPrompt,
          context: {
            tasks: data.tasks,
            routine: data.routine,
            schedule: data.schedule,
            profile: data.profile,
          },
        }),
      })

      if (!res.ok) {
        throw new Error('AI service error')
      }

      const json = await res.json()
      const aiResponse: AssistantResponse = json.data

      // Execute AI actions immediately
      if (aiResponse.action === 'create_task' && aiResponse.taskData) {
        const stepItems = aiResponse.taskData.steps?.map((s) => ({
          id: createId('step'),
          title: s.title,
          minutes: s.minutes,
          done: false,
        }))
        addTask({
          title: aiResponse.taskData.title,
          description: aiResponse.taskData.description || '',
          category: (aiResponse.taskData.category as Category) || 'College',
          priority: (aiResponse.taskData.priority as Priority) || 'medium',
          duration: aiResponse.taskData.duration || 50,
          deadline: aiResponse.taskData.deadline || '',
          preferredTime: (aiResponse.taskData.preferredTime as TimePeriod) || 'morning',
          steps: stepItems,
          status: 'todo',
        })
      } else if (aiResponse.action === 'create_tasks' && aiResponse.tasksData) {
        aiResponse.tasksData.forEach((item) => {
          addTask({
            title: item.title,
            description: item.description || '',
            category: (item.category as Category) || 'College',
            priority: (item.priority as Priority) || 'medium',
            duration: item.duration || 50,
            deadline: item.deadline || '',
            preferredTime: (item.preferredTime as TimePeriod) || 'morning',
            status: 'todo',
          })
        })
      } else if (aiResponse.action === 'breakdown_task' && aiResponse.breakdownData) {
        const { taskId, taskTitle, steps, category, deadline, priority } = aiResponse.breakdownData
        const stepItems = (steps || []).map((s) => ({
          id: createId('step'),
          title: s.title,
          minutes: s.minutes || 45,
          done: false,
        }))
        const target = (taskId ? data.tasks.find((t) => t.id === taskId) : null)
          || (taskTitle ? data.tasks.find((t) => t.title.toLowerCase().includes(taskTitle.toLowerCase()) || taskTitle.toLowerCase().includes(t.title.toLowerCase())) : null)
        
        if (target) {
          updateTask(target.id, { steps: stepItems })
          toast(`Updated "${target.title}" with ${stepItems.length} study steps.`)
        } else {
          const totalDuration = stepItems.reduce((sum, s) => sum + (s.minutes || 45), 0)
          addTask({
            title: taskTitle || 'Exam Preparation',
            description: `Study breakdown (${stepItems.length} subtasks)`,
            category: (category as Category) || 'Exam',
            priority: (priority as Priority) || 'high',
            duration: totalDuration || 120,
            deadline: deadline || '',
            preferredTime: 'morning',
            steps: stepItems,
            status: 'todo',
          })
        }
      } else if (aiResponse.action === 'plan_day') {
        generateDayPlan()
      }

      addChatMessage('assistant', aiResponse.reply)
      return aiResponse
    } catch (err) {
      console.warn('AI request failed, falling back:', err)
      const fallbackReply = "I couldn't reach the AI service right now. Please try again in a moment."
      addChatMessage('assistant', fallbackReply)
      return {
        reply: fallbackReply,
        action: 'answer',
      }
    }
  }, [addTask, addChatMessage, data.profile, data.routine, data.schedule, data.tasks, generateDayPlan, toast, updateTask])

  // Authentication functions
  const signIn = useCallback(async (email: string, password: string) => {
    // 1. Try Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const res = await signInWithEmail(email, password)
        if (res.user) {
          const authUser: AuthUser = {
            id: res.user.id,
            email: res.user.email || email,
            name: res.user.user_metadata?.name || 'User',
          }
          setActiveSession(authUser)
          setCurrentUser(authUser)
          const userData = getUserData(authUser.id)
          setData(userData)
          toast('Signed in successfully!')
          return { success: true }
        }
      } catch {
        // Fall through to local auth
      }
    }

    // 2. Local authentication
    const localRes = authenticateStoredUser(email, password)
    if (localRes.error || !localRes.user) {
      return { success: false, error: localRes.error || 'Invalid credentials' }
    }

    const authUser: AuthUser = {
      id: localRes.user.id,
      email: localRes.user.email,
      name: localRes.user.name,
    }
    setActiveSession(authUser)
    setCurrentUser(authUser)
    const userData = getUserData(authUser.id)
    setData(userData)
    toast('Signed in successfully!')
    return { success: true }
  }, [toast])

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    // 1. Register locally first for reliable data isolation
    const localRes = registerStoredUser(name || 'User', email, password)
    if (localRes.error || !localRes.user) {
      return { success: false, error: localRes.error || 'Failed to create account.' }
    }

    // 2. Try Supabase in background if configured
    if (isSupabaseConfigured()) {
      signUpWithEmail(email, password, name).catch(() => {
        // Supabase registration failure is gracefully handled
      })
    }

    const authUser: AuthUser = {
      id: localRes.user.id,
      email: localRes.user.email,
      name: localRes.user.name,
    }

    setActiveSession(authUser)
    setCurrentUser(authUser)
    const emptyUserData = getUserData(authUser.id)
    setData(emptyUserData)
    toast('Account created! Welcome to TaskPilot.')
    return { success: true }
  }, [toast])

  const signOut = useCallback(async () => {
    try {
      await signOutUser()
    } catch {
      // ignore
    }
    clearActiveSession()
    setCurrentUser(null)
    setData(createEmptyData())
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/')
    }
    toast('Signed out.', 'info')
  }, [toast])

  const configureSupabaseCredentials = useCallback((url: string, anonKey: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('taskpilot_supabase_url', url)
      window.localStorage.setItem('taskpilot_supabase_anon_key', anonKey)
    }
    toast('Supabase credentials saved. Reloading session…')
    window.location.reload()
  }, [toast])

  const clearData = useCallback(() => {
    if (currentUser) {
      setData(clearUserData(currentUser.id))
      toast('Your workspace is clear.', 'info')
    }
  }, [currentUser, toast])

  const isSupabaseConnected = Boolean(currentUser && isSupabaseConfigured())

  const value = useMemo<TaskPilotContextValue>(() => ({
    data,
    ready,
    currentUser,
    authLoading,
    isSupabaseConnected,
    toasts,
    toast,
    dismissToast,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    toggleTaskStatus,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    scheduleTaskAt,
    markScheduleMissed,
    recoverMissedSchedule,
    addReminder,
    deleteReminder,
    addFocusSession,
    saveRoutine,
    saveProfile,
    completeOnboarding,
    addChatMessage,
    requestAiAssistant,
    generateDayPlan,
    generateWeekPlan,
    signIn,
    signUp,
    signOut,
    configureSupabaseCredentials,
    clearData,
  }), [
    data,
    ready,
    currentUser,
    authLoading,
    isSupabaseConnected,
    toasts,
    toast,
    dismissToast,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    toggleTaskStatus,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    scheduleTaskAt,
    markScheduleMissed,
    recoverMissedSchedule,
    addReminder,
    deleteReminder,
    addFocusSession,
    saveRoutine,
    saveProfile,
    completeOnboarding,
    addChatMessage,
    requestAiAssistant,
    generateDayPlan,
    generateWeekPlan,
    signIn,
    signUp,
    signOut,
    configureSupabaseCredentials,
    clearData,
  ])

  return (
    <TaskPilotContext.Provider value={value}>
      {children}
      <div className="tp-toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((toastItem) => (
          <div className="tp-toast" data-tone={toastItem.tone} key={toastItem.id} role="status">
            <span className="tp-toast-mark" aria-hidden="true">
              {toastItem.tone === 'success' ? '✓' : toastItem.tone === 'warning' ? '!' : 'i'}
            </span>
            <span>{toastItem.message}</span>
            <button className="tp-toast-close" type="button" onClick={() => dismissToast(toastItem.id)} aria-label="Dismiss notification">
              ×
            </button>
          </div>
        ))}
      </div>
    </TaskPilotContext.Provider>
  )
}

export function useTaskPilot() {
  const context = useContext(TaskPilotContext)
  if (!context) throw new Error('useTaskPilot must be used within TaskPilotProvider')
  return context
}

export function getTodayForProfile(profile: Profile) {
  return getDateInTimezone(new Date(), profile.timezone)
}

export function findReminderTaskTitle(reminder: Reminder, tasks: Task[]) {
  return tasks.find((task) => task.id === reminder.taskId)?.title
}
