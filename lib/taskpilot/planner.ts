import { addDays, createId, getDateInTimezone, minutesFromTime, timeFromMinutes } from '@/lib/taskpilot/seed'
import type { Routine, ScheduleItem, Task } from '@/lib/taskpilot/types'

export interface PlannerResult {
  items: ScheduleItem[]
  scheduledTaskIds: string[]
  overflow: Task[]
}

interface PlannerOptions {
  tasks: Task[]
  routine: Routine
  schedule: ScheduleItem[]
  startDate: string
  timezone: string
  days: number
  now?: Date
}

function currentMinutesInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

function periodStart(period: Routine['energyPeriod'], wakeTime: string) {
  const suggested = period === 'morning' ? 9 * 60 : period === 'afternoon' ? 13 * 60 : 18 * 60
  return Math.max(minutesFromTime(wakeTime), suggested)
}

function priorityScore(task: Task, today: string) {
  const priority = { urgent: 40, high: 30, medium: 20, low: 10 }[task.priority]
  const deadline = task.deadline < today ? 30 : task.deadline === today ? 25 : task.deadline === addDays(today, 1) ? 12 : 0
  const quickWin = task.duration <= 45 ? 2 : 0
  return priority + deadline + quickWin - Math.max(0, task.duration - 120) / 60
}

function orderedTasks(tasks: Task[], today: string) {
  return [...tasks]
    .filter((task) => task.status !== 'completed')
    .sort((first, second) => {
      const scoreDifference = priorityScore(second, today) - priorityScore(first, today)
      return scoreDifference || first.deadline.localeCompare(second.deadline) || first.createdAt.localeCompare(second.createdAt)
    })
}

function overlaps(item: ScheduleItem, start: number, end: number) {
  return start < minutesFromTime(item.endTime) && end > minutesFromTime(item.startTime)
}

function findOpenSlot(
  occupied: ScheduleItem[],
  earliest: number,
  duration: number,
  latest: number,
  buffer: number,
) {
  let candidate = Math.ceil(earliest / 5) * 5
  const sorted = [...occupied].sort((a, b) => a.startTime.localeCompare(b.startTime))

  while (candidate + duration <= latest) {
    const conflict = sorted.find((item) => overlaps(item, candidate, candidate + duration))
    if (!conflict) return candidate
    candidate = Math.max(candidate, minutesFromTime(conflict.endTime) + buffer)
    candidate = Math.ceil(candidate / 5) * 5
  }
  return null
}

function reasonFor(task: Task, date: string, routine: Routine) {
  if (task.deadline < date) return 'Carried into a clear window because this task is already past its deadline.'
  if (task.deadline === date) return 'Placed early because this is due today and deserves a clear finish line.'
  if (task.priority === 'urgent' || task.priority === 'high') {
    return `Given a focused block while your ${routine.energyPeriod} energy is strongest.`
  }
  if (task.preferredTime === routine.energyPeriod) {
    return `Matched to your preferred ${routine.energyPeriod} work period.`
  }
  return 'Placed ahead of its deadline with a little buffer built in.'
}

function makeEvent(task: Task, date: string, start: number, duration: number, title = task.title): ScheduleItem {
  return {
    id: createId('plan'),
    taskId: task.id,
    title,
    category: task.category,
    priority: task.priority,
    date,
    startTime: timeFromMinutes(start),
    endTime: timeFromMinutes(start + duration),
    minutes: duration,
    kind: 'task',
  }
}

function planOneDay(
  tasks: Task[],
  date: string,
  routine: Routine,
  existing: ScheduleItem[],
  today: string,
  timezone: string,
  now: Date,
): PlannerResult {
  const sleep = minutesFromTime(routine.sleepTime)
  const wake = minutesFromTime(routine.wakeTime)
  const currentStart = date === today ? currentMinutesInTimezone(now, timezone) + 15 : wake
  let cursor = Math.max(wake, currentStart)
  const occupied = existing.filter((item) => item.date === date && !item.completed && !item.missed)
  const result: ScheduleItem[] = []
  const scheduledTaskIds: string[] = []
  const overflow: Task[] = []
  let focusSessions = 0

  for (const task of orderedTasks(tasks, today)) {
    const taskEvents: ScheduleItem[] = []
    const taskOccupied = [...occupied, ...result]
    let taskCursor = cursor
    let remaining = task.duration
    let sessionNumber = 0
    const preferredStart = task.preferredTime === routine.energyPeriod ? periodStart(routine.energyPeriod, routine.wakeTime) : wake
    if ((task.priority === 'urgent' || task.priority === 'high') && taskCursor < preferredStart && preferredStart < sleep) {
      taskCursor = preferredStart
    }
    let canFit = true

    while (remaining > 0) {
      const duration = Math.min(routine.focusDuration, remaining)
      const start = findOpenSlot(taskOccupied, taskCursor, duration, sleep, routine.bufferDuration)
      if (start === null) {
        canFit = false
        break
      }

      const title = sessionNumber > 0 ? `${task.title} · continued` : task.title
      const item = makeEvent(task, date, start, duration, title)
      item.reason = reasonFor(task, date, routine)
      taskEvents.push(item)
      taskOccupied.push(item)
      taskCursor = start + duration + routine.bufferDuration
      remaining -= duration
      sessionNumber += 1
      focusSessions += 1

      if (remaining > 0 && sessionNumber % Math.max(1, routine.breakEvery) === 0) {
        const breakStart = findOpenSlot(taskOccupied, taskCursor, routine.breakDuration, sleep, routine.bufferDuration)
        if (breakStart === null) {
          canFit = false
          break
        }
        const breakItem: ScheduleItem = {
          id: createId('break'),
          title: 'A short reset',
          date,
          startTime: timeFromMinutes(breakStart),
          endTime: timeFromMinutes(breakStart + routine.breakDuration),
          minutes: routine.breakDuration,
          kind: 'break',
          reason: 'A small break helps protect your focus for the next session.',
        }
        taskEvents.push(breakItem)
        taskOccupied.push(breakItem)
        taskCursor = breakStart + routine.breakDuration + routine.bufferDuration
      }
    }

    if (!canFit) {
      overflow.push(task)
      continue
    }
    result.push(...taskEvents)
    scheduledTaskIds.push(task.id)
    cursor = taskCursor
  }

  return { items: result, scheduledTaskIds, overflow }
}

export function createPlannerPlan({
  tasks,
  routine,
  schedule,
  startDate,
  timezone,
  days,
  now = new Date(),
}: PlannerOptions): PlannerResult {
  const today = getDateInTimezone(now, timezone)
  const planDates = Array.from({ length: days }, (_, index) => addDays(startDate, index))
  const preserved = schedule.filter((item) => {
    if (!planDates.includes(item.date)) return true
    if (item.kind === 'break') return false
    if (item.kind === 'task' && !item.completed && !item.missed) return false
    return true
  })

  let remaining = orderedTasks(tasks, today)
  const items: ScheduleItem[] = []
  const scheduledTaskIds: string[] = []

  for (const date of planDates) {
    if (remaining.length === 0) break
    const outcome = planOneDay(remaining, date, routine, [...preserved, ...items], today, timezone, now)
    items.push(...outcome.items)
    scheduledTaskIds.push(...outcome.scheduledTaskIds)
    const placed = new Set(outcome.scheduledTaskIds)
    remaining = remaining.filter((task) => !placed.has(task.id))
  }

  return { items, scheduledTaskIds, overflow: remaining }
}

export interface AvailableSlotOptions {
  date: string
  minutes: number
  routine: Routine
  schedule: ScheduleItem[]
  timezone: string
  fromTime?: string
  ignoreScheduleId?: string
  now?: Date
}

export function findNextAvailableTime({
  date,
  minutes,
  routine,
  schedule,
  timezone,
  fromTime,
  ignoreScheduleId,
  now = new Date(),
}: AvailableSlotOptions): string | null {
  const today = getDateInTimezone(now, timezone)
  const wake = minutesFromTime(routine.wakeTime)
  const sleep = minutesFromTime(routine.sleepTime)
  const current = date === today ? currentMinutesInTimezone(now, timezone) + 10 : wake
  const requested = fromTime ? minutesFromTime(fromTime) : wake
  const start = Math.max(wake, current, requested)
  const occupied = schedule.filter((item) => {
    if (item.date !== date || item.id === ignoreScheduleId || item.completed || item.missed) return false
    return true
  })
  const slot = findOpenSlot(occupied, start, minutes, sleep, routine.bufferDuration)
  return slot === null ? null : timeFromMinutes(slot)
}

export function formatPeriodLabel(period: Routine['energyPeriod']) {
  return period.charAt(0).toUpperCase() + period.slice(1)
}
