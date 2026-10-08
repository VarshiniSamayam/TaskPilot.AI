'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Check, Clock3, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createTaskSteps } from '@/lib/taskpilot/assistant'
import { addDays, formatDuration, getDateInTimezone } from '@/lib/taskpilot/seed'
import { PRIORITIES, TASK_CATEGORIES, TIME_PERIODS, type Category, type NewTask, type Priority, type Task, type TaskStep, type TimePeriod } from '@/lib/taskpilot/types'
import { Field, Modal, StatusBadge } from '@/components/taskpilot/ui'

function newTaskForm(task: Task | undefined, today: string): NewTask {
  return task ? {
    title: task.title,
    description: task.description,
    category: task.category,
    priority: task.priority,
    duration: task.duration,
    deadline: task.deadline,
    status: task.status,
    preferredTime: task.preferredTime,
    id: task.id,
    createdAt: task.createdAt,
    steps: task.steps,
  } : {
    title: '',
    description: '',
    category: 'College',
    priority: 'medium',
    duration: 50,
    deadline: addDays(today, 1),
    status: 'todo',
    preferredTime: 'morning',
  }
}

export function TaskEditorModal({
  open,
  onClose,
  onSave,
  initialTask,
  today,
}: {
  open: boolean
  onClose: () => void
  onSave: (task: NewTask) => void
  initialTask?: Task
  today: string
}) {
  const [form, setForm] = useState<NewTask>(() => newTaskForm(initialTask, today))

  useEffect(() => {
    if (open) setForm(newTaskForm(initialTask, today))
  }, [initialTask, open, today])

  const update = (key: keyof NewTask, value: string | number) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave({ ...form, title: form.title.trim(), description: form.description.trim() })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialTask ? 'Edit task' : 'Add a task'}
      description="A few details help TaskPilot make a plan that feels realistic."
      size="lg"
    >
      <form className="tp-form" onSubmit={handleSubmit}>
        <Field id="task-title" label="Task name">
          <input id="task-title" className="tp-input" autoFocus required maxLength={100} value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="What would you like to get done?" />
        </Field>
        <Field id="task-description" label="A little context" hint="Optional — add a note to make the next step clearer.">
          <textarea id="task-description" className="tp-textarea" maxLength={500} rows={3} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="What does done look like?" />
        </Field>
        <div className="tp-form-grid">
          <Field id="task-category" label="Category">
            <select id="task-category" className="tp-select" value={form.category} onChange={(event) => update('category', event.target.value as Category)}>
              {TASK_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </Field>
          <Field id="task-priority" label="Priority">
            <select id="task-priority" className="tp-select" value={form.priority} onChange={(event) => update('priority', event.target.value as Priority)}>
              {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>)}
            </select>
          </Field>
          <Field id="task-duration" label="How long?">
            <div className="tp-input-suffix">
              <input id="task-duration" className="tp-input" type="number" min={10} max={480} step={5} required value={form.duration} onChange={(event) => update('duration', Number(event.target.value))} />
              <span>minutes</span>
            </div>
          </Field>
          <Field id="task-deadline" label="Deadline">
            <input id="task-deadline" className="tp-input" type="date" required value={form.deadline} onChange={(event) => update('deadline', event.target.value)} />
          </Field>
        </div>
        <Field id="task-period" label="Best time of day">
          <select id="task-period" className="tp-select" value={form.preferredTime} onChange={(event) => update('preferredTime', event.target.value as TimePeriod)}>
            {TIME_PERIODS.map((period) => <option key={period} value={period}>{period.charAt(0).toUpperCase() + period.slice(1)}</option>)}
          </select>
        </Field>
        <div className="tp-modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="tp-primary-button">{initialTask ? 'Save changes' : 'Add task'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export function TaskScheduleModal({
  open,
  onClose,
  onSchedule,
  task,
  today,
}: {
  open: boolean
  onClose: () => void
  onSchedule: (date: string, time: string) => void
  task: Task | null
  today: string
}) {
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('09:00')

  useEffect(() => {
    if (open) {
      setDate(task?.deadline && task.deadline >= today ? task.deadline : today)
      setTime(task?.preferredTime === 'afternoon' ? '13:00' : task?.preferredTime === 'evening' ? '18:00' : '09:00')
    }
  }, [open, task, today])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSchedule(date, time)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Find a place for it" description={task ? `${task.title} · ${formatDuration(task.duration)}` : undefined} size="sm">
      <form className="tp-form" onSubmit={handleSubmit}>
        <Field id="schedule-date" label="Day">
          <input id="schedule-date" className="tp-input" type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field id="schedule-time" label="Start around">
          <input id="schedule-time" className="tp-input" type="time" required value={time} onChange={(event) => setTime(event.target.value)} />
        </Field>
        <p className="tp-form-note"><Clock3 aria-hidden="true" /> TaskPilot will use the next clear slot if this time is already full.</p>
        <div className="tp-modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Schedule task</Button>
        </div>
      </form>
    </Modal>
  )
}

export function TaskDetailsModal({
  task,
  open,
  onClose,
  onEdit,
  onSchedule,
  onSteps,
  onComplete,
}: {
  task: Task | null
  open: boolean
  onClose: () => void
  onEdit: (task: Task) => void
  onSchedule: (task: Task) => void
  onSteps: (task: Task) => void
  onComplete: (task: Task) => void
}) {
  if (!task) return null
  const doneSteps = task.steps?.filter((step) => step.done).length ?? 0
  return (
    <Modal open={open} onClose={onClose} title={task.title} description={task.description || 'No extra notes for this task yet.'} size="md">
      <div className="tp-task-detail-meta">
        <StatusBadge tone={`category-${task.category.toLowerCase()}`}>{task.category}</StatusBadge>
        <StatusBadge tone={`priority-${task.priority}`}>{task.priority}</StatusBadge>
        <StatusBadge tone={`status-${task.status}`}>{task.status === 'in-progress' ? 'In progress' : task.status === 'todo' ? 'To do' : 'Completed'}</StatusBadge>
      </div>
      <div className="tp-task-detail-facts">
        <div><span>Time needed</span><strong>{formatDuration(task.duration)}</strong></div>
        <div><span>Deadline</span><strong>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${task.deadline}T12:00:00`))}</strong></div>
        <div><span>Best time</span><strong>{task.preferredTime}</strong></div>
      </div>
      {task.steps && task.steps.length > 0 && (
        <div className="tp-detail-steps">
          <div className="tp-detail-steps-heading"><strong>Small steps</strong><span>{doneSteps}/{task.steps.length} done</span></div>
          {task.steps.map((step) => (
            <div className="tp-detail-step" key={step.id} data-done={step.done}>
              <span className="tp-step-check">{step.done && <Check aria-hidden="true" />}</span>
              <span>{step.title}</span>
              <small>{formatDuration(step.minutes)}</small>
            </div>
          ))}
        </div>
      )}
      <div className="tp-modal-actions tp-detail-actions">
        <Button type="button" variant="outline" onClick={() => { onSchedule(task); onClose() }}>Schedule</Button>
        <Button type="button" variant="outline" onClick={() => { onSteps(task); onClose() }}><Sparkles data-icon="inline-start" />Break into steps</Button>
        <Button type="button" variant="ghost" onClick={() => { onEdit(task); onClose() }}>Edit</Button>
        {task.status !== 'completed' && <Button type="button" onClick={() => { onComplete(task); onClose() }}>Mark complete</Button>}
      </div>
    </Modal>
  )
}

export function TaskStepsModal({
  task,
  open,
  onClose,
  onSave,
}: {
  task: Task | null
  open: boolean
  onClose: () => void
  onSave: (steps: TaskStep[]) => void
}) {
  const [steps, setSteps] = useState<TaskStep[]>([])

  useEffect(() => {
    if (open && task) setSteps(task.steps?.length ? task.steps : createTaskSteps(task))
  }, [open, task])

  if (!task) return null
  const toggle = (id: string) => setSteps((current) => current.map((step) => step.id === id ? { ...step, done: !step.done } : step))

  return (
    <Modal open={open} onClose={onClose} title="Make it feel smaller" description={`A gentle first pass for “${task.title}”. Adjust it as you go.`} size="md">
      <div className="tp-step-list">
        {steps.map((step, index) => (
          <button className="tp-step-row" key={step.id} type="button" onClick={() => toggle(step.id)} aria-pressed={Boolean(step.done)}>
            <span className="tp-step-number">{step.done ? <Check aria-hidden="true" /> : String(index + 1).padStart(2, '0')}</span>
            <span className="tp-step-copy"><strong>{step.title}</strong><small>{formatDuration(step.minutes)}</small></span>
            <span className="tp-step-done-label">{step.done ? 'Done' : 'Mark done'}</span>
          </button>
        ))}
      </div>
      <div className="tp-modal-actions">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={() => { onSave(steps); onClose() }}>Add these steps</Button>
      </div>
    </Modal>
  )
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  destructive?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm">
      <div className="tp-modal-actions">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" variant={destructive ? 'destructive' : 'default'} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

export function ReminderModal({
  open,
  onClose,
  onSave,
  tasks,
}: {
  open: boolean
  onClose: () => void
  onSave: (reminder: { message: string; dueAt: string; taskId?: string }) => void
  tasks: Task[]
}) {
  const [message, setMessage] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [taskId, setTaskId] = useState('')

  useEffect(() => {
    if (!open) return
    const later = new Date(Date.now() + 60 * 60 * 1000)
    later.setMinutes(Math.ceil(later.getMinutes() / 5) * 5, 0, 0)
    const localValue = new Date(later.getTime() - later.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
    setMessage('')
    setTaskId('')
    setDueAt(localValue)
  }, [open])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave({ message: message.trim(), dueAt: new Date(dueAt).toISOString(), taskId: taskId || undefined })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a reminder" description="A small nudge at the right moment can make a difference." size="sm">
      <form className="tp-form" onSubmit={handleSubmit}>
        <Field id="reminder-message" label="What should I remind you about?">
          <input id="reminder-message" className="tp-input" autoFocus required maxLength={140} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Bring your charger to the library" />
        </Field>
        <Field id="reminder-time" label="When">
          <input id="reminder-time" className="tp-input" type="datetime-local" required value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
        </Field>
        <Field id="reminder-task" label="Attach to a task" hint="Optional">
          <select id="reminder-task" className="tp-select" value={taskId} onChange={(event) => setTaskId(event.target.value)}>
            <option value="">No task</option>
            {tasks.filter((task) => task.status !== 'completed').map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
          </select>
        </Field>
        <div className="tp-modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save reminder</Button>
        </div>
      </form>
    </Modal>
  )
}
