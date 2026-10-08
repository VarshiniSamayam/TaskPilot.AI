import { addDays, createId, formatDuration, getDateInTimezone } from '@/lib/taskpilot/seed'
import type { NewTask, Task, TaskStep } from '@/lib/taskpilot/types'

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}

function dateForWeekday(weekdayName: string, today: string) {
  const target = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(weekdayName.toLowerCase())
  if (target < 0) return addDays(today, 1)
  const [year, month, day] = today.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
  const difference = (target - weekday + 7) % 7 || 7
  return addDays(today, difference)
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function parseNaturalTask(text: string, tasks: Task[], timezone = 'Asia/Kolkata'): NewTask {
  const today = getDateInTimezone(new Date(), timezone)
  const durationMatch = text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(hours?|hrs?|minutes?|mins?)\b/i)
  const durationAmount = durationMatch ? Number(durationMatch[1]) || NUMBER_WORDS[durationMatch[1].toLowerCase()] : 50
  const durationUnit = durationMatch?.[2].toLowerCase() ?? 'minutes'
  const duration = Math.max(10, Math.min(480, durationUnit.startsWith('h') ? durationAmount * 60 : durationAmount))
  const weekdayMatch = text.match(/\b(?:before|by|for)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)
  const deadline = /\btoday\b/i.test(text)
    ? today
    : /\btomorrow\b/i.test(text)
      ? addDays(today, 1)
      : weekdayMatch
        ? dateForWeekday(weekdayMatch[1], today)
        : addDays(today, 1)
  const lower = text.toLowerCase()
  const category = /react|javascript|coding|code|program|prototype|build|project/i.test(text)
    ? (/project|prototype|build/i.test(text) ? 'Project' : 'Coding')
    : /exam|test|data structure|quiz/i.test(text)
      ? 'Exam'
      : /assignment|biology|college|lecture|chapter|class/i.test(text)
        ? 'College'
        : /notes|read|review|study/i.test(text)
          ? 'Study'
          : /personal|home|health|walk|exercise/i.test(text)
            ? 'Personal'
            : 'Other'
  const priority = /urgent|asap|critical|important/i.test(lower)
    ? 'urgent'
    : /high priority/i.test(lower)
      ? 'high'
      : /low priority/i.test(lower)
        ? 'low'
        : 'medium'
  const preferredTime = /\bevening|tonight\b/i.test(lower)
    ? 'evening'
    : /\bafternoon\b/i.test(lower)
      ? 'afternoon'
      : 'morning'
  let title = text
    .trim()
    .replace(/^(?:please\s+)?(?:add|create|remember|schedule|i need to|i have to|can you|could you)\s+(?:a\s+task\s+(?:to\s+)?)?/i, '')
    .replace(/\b(?:for|in|within)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:hours?|hrs?|minutes?|mins?)\b/ig, '')
    .replace(/\b(?:before|by)\s+(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/ig, '')
    .replace(/\b(?:today|tomorrow|tonight|(?:this\s+)?(?:morning|afternoon|evening)|in the\s+(?:morning|afternoon|evening))\b/ig, '')
    .replace(/\b(?:urgent|asap|critical|high priority|low priority)\b/ig, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+(?:for|by|before|in)$/i, '')
    .trim()
  if (!title) title = 'New task'
  title = toTitleCase(title)

  const description = `Added from your note: “${text.trim()}”`
  return {
    title,
    description,
    category,
    priority,
    duration,
    deadline,
    status: 'todo',
    preferredTime,
  }
}

export function createTaskSteps(task: Task): TaskStep[] {
  const templates = task.category === 'Coding' || task.category === 'Project'
    ? ['Clarify the outcome', 'Gather what you need', 'Build the first pass', 'Test and refine', 'Wrap up the details']
    : task.category === 'Exam' || task.category === 'Study' || task.category === 'College'
      ? ['Choose the key topics', 'Review the core material', 'Practice from memory', 'Check gaps and questions', 'Write a short recap']
      : ['Decide what done looks like', 'Gather what you need', 'Make a focused first pass', 'Review and adjust', 'Finish and close the loop']
  const count = task.duration >= 100 ? 5 : task.duration >= 60 ? 4 : 3
  const titles = templates.slice(0, count)
  const base = Math.floor(task.duration / titles.length)
  let assigned = 0

  return titles.map((title, index) => {
    const minutes = index === titles.length - 1 ? task.duration - assigned : base
    assigned += minutes
    return { id: createId('step'), title, minutes }
  })
}

export function getTopPriorityTask(tasks: Task[], today = getDateInTimezone(new Date())) {
  return [...tasks]
    .filter((task) => task.status !== 'completed')
    .sort((first, second) => {
      const score = (task: Task) => {
        const priority = { urgent: 4, high: 3, medium: 2, low: 1 }[task.priority]
        const deadline = task.deadline < today ? 4 : task.deadline === today ? 3 : task.deadline === addDays(today, 1) ? 2 : 0
        const shortSession = task.duration <= 60 ? 0.4 : 0
        return priority * 3 + deadline * 2 + shortSession
      }
      return score(second) - score(first)
    })[0]
}

export function getTaskMentionedIn(text: string, tasks: Task[]) {
  const lower = text.toLowerCase()
  return tasks.find((task) => lower.includes(task.title.toLowerCase())) ?? getTopPriorityTask(tasks)
}

export function formatSuggestedTask(task: Task) {
  return `${task.title} (${formatDuration(task.duration)})`
}

export function assistantWelcome(name: string) {
  return `Hey ${name}. Tell me what is on your mind. I can turn it into tasks, help prioritize your day, or help you recover when plans change.`
}
