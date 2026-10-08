import {
  DEFAULT_PROFILE,
  DEFAULT_ROUTINE,
  type AppData,
  type Category,
  type FocusSession,
  type ScheduleItem,
  type Task,
} from './types'

export function getDateInTimezone(now = new Date(), timeZone = 'Asia/Kolkata') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function addDays(date: string, amount: number) {
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + amount, 12))
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`
}

export function startOfWeek(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
  return addDays(date, -((weekday + 6) % 7))
}

export function getWeekDates(date: string) {
  const firstDay = startOfWeek(date)
  return Array.from({ length: 7 }, (_, index) => addDays(firstDay, index))
}

export function formatCalendarDate(date: string, options: Intl.DateTimeFormatOptions = {}) {
  const safeDate = new Date(`${date}T12:00:00.000Z`)
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(safeDate)
}

export function formatLongDate(date: string) {
  return formatCalendarDate(date, { weekday: 'long', month: 'long', day: 'numeric' })
}

export function minutesFromTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours || 0) * 60 + (minutes || 0)
}

export function timeFromMinutes(minutes: number) {
  const safeMinutes = Math.max(0, Math.min(1439, Math.round(minutes)))
  const hours = Math.floor(safeMinutes / 60)
  const remainder = safeMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export function addMinutesToTime(time: string, minutes: number) {
  return timeFromMinutes(minutesFromTime(time) + minutes)
}

export function formatTime(time: string, format: '12h' | '24h' = '12h') {
  const [hours, minutes] = time.split(':').map(Number)
  if (format === '24h') return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

export function createId(_prefix?: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)
  return `${s4()}${s4()}-${s4()}-4${s4().substring(0, 3)}-${s4()}-${s4()}${s4()}${s4()}`
}

function localTimestamp(date: string, hour: number, minute = 0) {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:30`).toISOString()
}

function makeTask(
  id: string,
  title: string,
  category: Category,
  priority: Task['priority'],
  duration: number,
  deadline: string,
  status: Task['status'],
  preferredTime: Task['preferredTime'],
  description: string,
  createdAt: string,
  completedAt?: string,
): Task {
  return { id, title, category, priority, duration, deadline, status, preferredTime, description, createdAt, completedAt }
}

function makeSchedule(
  id: string,
  date: string,
  startTime: string,
  minutes: number,
  title: string,
  kind: ScheduleItem['kind'],
  extra: Partial<ScheduleItem> = {},
): ScheduleItem {
  return {
    id,
    date,
    startTime,
    endTime: addMinutesToTime(startTime, minutes),
    minutes,
    title,
    kind,
    ...extra,
  }
}

export function createDemoData(now = new Date()): AppData {
  const today = getDateInTimezone(now)
  const tomorrow = addDays(today, 1)
  const weekday = new Date(`${today}T12:00:00.000Z`).getUTCDay()
  const friday = addDays(today, ((5 - weekday + 7) % 7) || 7)
  const saturday = addDays(today, ((6 - weekday + 7) % 7) || 7)
  const yesterday = addDays(today, -1)
  const twoDaysAgo = addDays(today, -2)
  const threeDaysAgo = addDays(today, -3)

  const tasks: Task[] = [
    makeTask('task-prototype', 'Finish TaskPilot AI prototype', 'Project', 'high', 120, today, 'todo', 'morning', 'Bring the day-planning flow and final interactions together for the demo.', localTimestamp(yesterday, 16)),
    makeTask('task-javascript', 'Practice JavaScript', 'Coding', 'medium', 60, tomorrow, 'todo', 'afternoon', 'Work through array methods and a few short coding exercises.', localTimestamp(yesterday, 18)),
    makeTask('task-data-structures', 'Review Data Structures', 'Exam', 'high', 90, friday, 'todo', 'morning', 'Revise trees, graphs, and the most important complexity patterns.', localTimestamp(twoDaysAgo, 17)),
    makeTask('task-assignment', 'Complete college assignment', 'College', 'urgent', 45, today, 'in-progress', 'morning', 'Finish the written section and submit the final document.', localTimestamp(twoDaysAgo, 14)),
    makeTask('task-ai-notes', 'Read AI Agents notes', 'Study', 'medium', 50, saturday, 'todo', 'morning', 'Review the notes and capture a few questions for class.', localTimestamp(yesterday, 12)),
    makeTask('task-portfolio', 'Outline portfolio case study', 'Personal', 'low', 40, addDays(today, 4), 'todo', 'evening', 'Collect the key decisions and outcomes from the last project.', localTimestamp(today, 7)),
    makeTask('task-notes', 'Organize semester notes', 'College', 'medium', 35, twoDaysAgo, 'completed', 'afternoon', 'Sort lecture notes into a clean folder structure.', localTimestamp(threeDaysAgo, 10), localTimestamp(twoDaysAgo, 9, 25)),
    makeTask('task-milestones', 'Plan project milestones', 'Project', 'medium', 30, yesterday, 'completed', 'morning', 'Break the project into a few clear weekly milestones.', localTimestamp(threeDaysAgo, 15), localTimestamp(yesterday, 10, 15)),
    makeTask('task-wireframes', 'Finish UI wireframes', 'Coding', 'high', 55, threeDaysAgo, 'completed', 'morning', 'Complete the first pass of the core workspace screens.', localTimestamp(addDays(today, -4), 12), localTimestamp(threeDaysAgo, 11, 5)),
  ]

  const schedule: ScheduleItem[] = [
    makeSchedule('event-deep-work', today, '08:00', 50, 'Finish TaskPilot AI prototype', 'task', { taskId: 'task-prototype', category: 'Project', priority: 'high', reason: 'Your morning is your strongest focus window, and this project is a high-priority commitment.' }),
    makeSchedule('event-study', today, '09:00', 50, 'Review Data Structures', 'task', { taskId: 'task-data-structures', category: 'Exam', priority: 'high', reason: 'A short review block keeps the Friday exam from becoming a last-minute push.' }),
    makeSchedule('event-break', today, '10:00', 10, 'A small reset', 'break'),
    makeSchedule('event-assignment', today, '10:10', 45, 'Complete college assignment', 'task', { taskId: 'task-assignment', category: 'College', priority: 'urgent', reason: 'This is due today, so a focused block gives it a clear finish line.' }),
    makeSchedule('event-lunch', today, '12:30', 45, 'Lunch and a little reset', 'commitment', { description: 'A protected pause in the middle of the day.' }),
    makeSchedule('event-review', today, '17:00', 30, 'Review and plan tomorrow', 'routine', { description: 'Close out the day and choose a gentle starting point for tomorrow.' }),
    makeSchedule('event-javascript', tomorrow, '09:30', 60, 'Practice JavaScript', 'task', { taskId: 'task-javascript', category: 'Coding', priority: 'medium', reason: 'A practical session before the deadline keeps the task comfortably on track.' }),
    makeSchedule('event-notes', saturday, '10:00', 50, 'Read AI Agents notes', 'task', { taskId: 'task-ai-notes', category: 'Study', priority: 'medium', reason: 'A calm morning block leaves room to capture questions after the reading.' }),
  ]

  const focusSessions: FocusSession[] = [
    { id: 'focus-1', date: threeDaysAgo, minutes: 50, taskId: 'task-wireframes', taskTitle: 'Finish UI wireframes' },
    { id: 'focus-2', date: twoDaysAgo, minutes: 75, taskId: 'task-notes', taskTitle: 'Organize semester notes' },
    { id: 'focus-3', date: yesterday, minutes: 50, taskId: 'task-milestones', taskTitle: 'Plan project milestones' },
    { id: 'focus-4', date: today, minutes: 25, taskId: 'task-assignment', taskTitle: 'Complete college assignment' },
  ]

  return {
    tasks,
    routine: { ...DEFAULT_ROUTINE },
    schedule,
    reminders: [
      { id: 'reminder-1', message: 'Bring your charger to the library', taskId: 'task-data-structures', dueAt: localTimestamp(today, 15, 30), delivered: false },
    ],
    focusSessions,
    chat: [
      {
        id: 'welcome-message',
        role: 'assistant',
        content: 'Hey there! Tell me what is on your mind. I can turn it into tasks, help prioritize your day, or help you recover when plans change.',
        createdAt: localTimestamp(today, 7, 15),
      },
    ],
    profile: { ...DEFAULT_PROFILE },
    onboarding: true,
  }
}

export function createEmptyData(): AppData {
  return {
    tasks: [],
    routine: { ...DEFAULT_ROUTINE },
    schedule: [],
    reminders: [],
    focusSessions: [],
    chat: [],
    profile: { ...DEFAULT_PROFILE },
    onboarding: false,
  }
}
