export type TaskStatus = 'todo' | 'in-progress' | 'completed'
export type Priority = 'urgent' | 'high' | 'medium' | 'low'
export type Category = 'College' | 'Project' | 'Personal' | 'Coding' | 'Exam' | 'Study' | 'Other'
export type TimePeriod = 'morning' | 'afternoon' | 'evening'
export type ScheduleKind = 'task' | 'break' | 'commitment' | 'routine'
export type ThemePreference = 'light' | 'dark' | 'system'

export interface TaskStep {
  id: string
  title: string
  minutes: number
  done?: boolean
}

export interface Task {
  id: string
  title: string
  description: string
  category: Category
  priority: Priority
  duration: number
  deadline: string
  status: TaskStatus
  preferredTime: TimePeriod
  createdAt: string
  completedAt?: string
  steps?: TaskStep[]
}

export interface ScheduleItem {
  id: string
  taskId?: string
  title: string
  description?: string
  category?: Category
  priority?: Priority
  date: string
  startTime: string
  endTime: string
  minutes: number
  kind: ScheduleKind
  reason?: string
  completed?: boolean
  missed?: boolean
}

export interface Routine {
  wakeTime: string
  sleepTime: string
  focusDuration: number
  breakDuration: number
  bufferDuration: number
  preferredPeriod: TimePeriod
  energyPeriod: TimePeriod
  breakEvery: number
}

export interface Reminder {
  id: string
  message: string
  taskId?: string
  dueAt: string
  delivered: boolean
}

export interface FocusSession {
  id: string
  date: string
  minutes: number
  taskId?: string
  taskTitle: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface Profile {
  name: string
  email: string
  timezone: string
  timeFormat: '12h' | '24h'
  notifications: boolean
  theme: ThemePreference
}

export interface AppData {
  tasks: Task[]
  routine: Routine
  schedule: ScheduleItem[]
  reminders: Reminder[]
  focusSessions: FocusSession[]
  chat: ChatMessage[]
  profile: Profile
  onboarding: boolean
}

export type NewTask = Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'steps' | 'status'> & {
  id?: string
  createdAt?: string
  status?: TaskStatus
  steps?: TaskStep[]
}

export type NewScheduleItem = Omit<ScheduleItem, 'id'> & { id?: string }
export type NewReminder = Omit<Reminder, 'id' | 'delivered'> & { id?: string; delivered?: boolean }
export type ToastTone = 'success' | 'info' | 'warning'

export interface ToastMessage {
  id: string
  message: string
  tone: ToastTone
}

export interface AuthUser {
  id: string
  email: string
  name: string
}

export const TASK_CATEGORIES: Category[] = ['College', 'Project', 'Personal', 'Coding', 'Exam', 'Study', 'Other']
export const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low']
export const TIME_PERIODS: TimePeriod[] = ['morning', 'afternoon', 'evening']

export const DEFAULT_ROUTINE: Routine = {
  wakeTime: '07:00',
  sleepTime: '23:00',
  focusDuration: 50,
  breakDuration: 10,
  bufferDuration: 15,
  preferredPeriod: 'morning',
  energyPeriod: 'morning',
  breakEvery: 2,
}

export const DEFAULT_PROFILE: Profile = {
  name: 'User',
  email: '',
  timezone: 'Asia/Kolkata',
  timeFormat: '12h',
  notifications: true,
  theme: 'light',
}

