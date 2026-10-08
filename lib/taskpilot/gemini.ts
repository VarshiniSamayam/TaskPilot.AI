import { GoogleGenAI } from '@google/genai'
import { addDays, getDateInTimezone } from './seed'
import type { Category, Priority, Routine, ScheduleItem, Task, TimePeriod } from './types'

export interface AssistantContext {
  tasks: Task[]
  routine: Routine
  schedule: ScheduleItem[]
  profile: {
    name: string
    timezone: string
    energyPeriod?: TimePeriod
    preferredPeriod?: TimePeriod
  }
}

export interface AssistantResponse {
  reply: string
  action: 'create_task' | 'create_tasks' | 'breakdown_task' | 'plan_day' | 'ask_clarification' | 'answer'
  taskData?: {
    title: string
    description?: string
    category: Category
    priority: Priority
    duration: number
    deadline: string
    preferredTime?: TimePeriod
    steps?: Array<{ title: string; minutes: number }>
  }
  tasksData?: Array<{
    title: string
    description?: string
    category: Category
    priority: Priority
    duration: number
    deadline: string
    preferredTime?: TimePeriod
  }>
  breakdownData?: {
    taskId?: string
    taskTitle: string
    category?: Category
    deadline?: string
    priority?: Priority
    steps: Array<{ title: string; minutes: number }>
  }
}

const candidateModels = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
]

export async function processWithGemini(
  prompt: string,
  context: AssistantContext,
  customApiKey?: string,
): Promise<AssistantResponse> {
  const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY

  if (!apiKey) {
    return {
      reply: "The AI service is not configured yet. Please make sure GEMINI_API_KEY is set in your server environment.",
      action: 'answer',
    }
  }

  try {
    const ai = new GoogleGenAI({ apiKey })
    const today = getDateInTimezone(new Date(), context.profile.timezone || 'Asia/Kolkata')

    // Compute relative dates for prompt accuracy
    const [year, month, day] = today.split('-').map(Number)
    const todayDate = new Date(Date.UTC(year, month - 1, day, 12))
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const todayDayName = weekdays[todayDate.getUTCDay()]

    // Find date for this week's Friday or upcoming Friday
    const todayDayIndex = todayDate.getUTCDay()
    const daysUntilFriday = (5 - todayDayIndex + 7) % 7 || 7
    const fridayDate = addDays(today, daysUntilFriday)
    const tomorrowDate = addDays(today, 1)

    const taskSummaries = (context.tasks || [])
      .map((t) => `- [${t.id}] "${t.title}" (Category: ${t.category}, Priority: ${t.priority}, Duration: ${t.duration}m, Deadline: ${t.deadline}, Status: ${t.status}${t.steps && t.steps.length ? `, ${t.steps.length} subtasks` : ''})`)
      .join('\n')

    const scheduleSummaries = (context.schedule || [])
      .filter((s) => s.date === today)
      .map((s) => `- ${s.startTime}-${s.endTime}: "${s.title}" (${s.kind})`)
      .join('\n')

    const systemInstruction = `You are TaskPilot AI, an intelligent personal productivity and planning companion.
The current date is ${today} (${todayDayName}). The user's timezone is ${context.profile.timezone || 'Asia/Kolkata'}. User's name is ${context.profile.name || 'User'}.
Routine preferences: Wake at ${context.routine?.wakeTime || '07:00'}, Sleep at ${context.routine?.sleepTime || '23:00'}, Focus session length ${context.routine?.focusDuration || 50}m, Peak energy period is ${context.routine?.energyPeriod || 'morning'}.

RELATIVE DATES REFERENCE FOR PLANNING:
- Today: ${today} (${todayDayName})
- Tomorrow: ${tomorrowDate}
- This/Upcoming Friday: ${fridayDate}

CURRENT OPEN TASKS IN USER WORKSPACE:
${taskSummaries || 'No open tasks.'}

TODAY'S SCHEDULE:
${scheduleSummaries || 'No scheduled events today yet.'}

CRITICAL BEHAVIOR RULES:
1. 'ask_clarification':
   - When the user mentions an upcoming exam, test, or generic event but omits essential information (such as the specific subject or course, or when the exam is taking place, e.g. "I have an exam soon", "I have a test next week", "I need to prepare for my exam"), DO NOT invent details.
   - Set action to "ask_clarification" and ask a polite, direct question to obtain the missing details (e.g. "When is the exam, and which subject is it?").

2. 'breakdown_task':
   - When the user asks to break down preparation, mentions chapters to cover, or asks to break down an exam or project (e.g. "I have a Data Structures exam on Friday covering 5 chapters. I can study 2 hours tonight.", "Break my DSA exam preparation into smaller tasks", "Break down my assignment into smaller steps"):
   - Set action to "breakdown_task".
   - Extract subject, deadline (e.g. ${fridayDate} for Friday), chapters, available study time (e.g. 120 mins for 2 hours).
   - Provide concrete, meaningful subtasks in "breakdownData.steps" (e.g. for 5 chapters: distinct chapter study blocks with minutes).
   - If a matching task already exists in OPEN TASKS, provide its taskId in "breakdownData.taskId". Otherwise, set "breakdownData.taskTitle" with a clear title like "Data Structures Exam Preparation".

3. 'create_task':
   - When the user asks to add or schedule a specific task (e.g. "Add a task to finish my college assignment tomorrow for 45 minutes", "Add a task to review React hooks"), extract:
     - title: concise title (e.g. "Finish college assignment")
     - description: helpful notes
     - category: "College" | "Project" | "Personal" | "Coding" | "Exam" | "Study" | "Other"
     - priority: "urgent" | "high" | "medium" | "low"
     - duration: minutes (e.g. 45)
     - deadline: date in YYYY-MM-DD (e.g. tomorrow is ${tomorrowDate})
   - Set action to "create_task".

4. 'plan_day':
   - When the user asks to shape their day, organize their schedule, or plan today ("Shape my day", "Plan my schedule today").

5. 'answer':
   - For general questions, advice, or reflections.

RESPONSE SCHEMA (JSON ONLY, NO MARKDOWN OUTSIDE):
{
  "reply": "Clear, friendly, formatted response to the user explaining what was done or asking the clarification.",
  "action": "create_task" | "create_tasks" | "breakdown_task" | "plan_day" | "ask_clarification" | "answer",
  "taskData": {
    "title": "Task title",
    "description": "Description",
    "category": "College" | "Project" | "Personal" | "Coding" | "Exam" | "Study" | "Other",
    "priority": "urgent" | "high" | "medium" | "low",
    "duration": 45,
    "deadline": "YYYY-MM-DD",
    "preferredTime": "morning" | "afternoon" | "evening",
    "steps": [
      { "title": "Subtask title", "minutes": 25 }
    ]
  },
  "breakdownData": {
    "taskId": "ID if matches open task, or empty string",
    "taskTitle": "Clear descriptive title",
    "category": "Exam" | "College" | "Project" | "Study" | "Coding",
    "deadline": "YYYY-MM-DD",
    "priority": "high" | "urgent" | "medium",
    "steps": [
      { "title": "Concrete step title", "minutes": 30 }
    ]
  }
}`

    let text: string | undefined
    let lastError: unknown

    for (const model of candidateModels) {
      try {
        const result = await ai.models.generateContent({
          model,
          contents: [
            { role: 'user', parts: [{ text: `${systemInstruction}\n\nUser request: ${prompt}` }] },
          ],
          config: {
            responseMimeType: 'application/json',
          },
        })
        if (result.text) {
          text = result.text
          break
        }
      } catch (e) {
        lastError = e
        console.warn(`Model ${model} call failed, trying next candidate...`, e)
      }
    }

    if (!text) {
      throw lastError || new Error('No candidate model succeeded')
    }

    const cleanJson = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(cleanJson) as AssistantResponse
    if (!parsed.reply || !parsed.action) {
      throw new Error('Invalid JSON structure from Gemini')
    }

    return parsed
  } catch (err) {
    console.error('Gemini AI assistant call failed:', err)
    return {
      reply: "I couldn't reach the AI service right now. Please try again in a moment.",
      action: 'answer',
    }
  }
}
