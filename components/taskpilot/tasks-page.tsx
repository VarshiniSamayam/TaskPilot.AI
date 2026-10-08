'use client'

import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  ArrowDownWideNarrow,
  ArrowRight,
  CalendarDays,
  Check,
  Circle,
  Clock3,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  WandSparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, PageHeader, SectionHeading, StatusBadge } from '@/components/taskpilot/ui'
import { useTaskPilot, getTodayForProfile } from '@/components/taskpilot/taskpilot-provider'
import { ConfirmModal, TaskDetailsModal, TaskEditorModal, TaskScheduleModal, TaskStepsModal } from '@/components/taskpilot/task-dialogs'
import { parseNaturalTask } from '@/lib/taskpilot/assistant'
import { formatCalendarDate, formatDuration } from '@/lib/taskpilot/seed'
import { TASK_CATEGORIES, type NewTask, type Task, type TaskStatus } from '@/lib/taskpilot/types'

const statusFilters: { id: 'all' | TaskStatus; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'todo', label: 'To do' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
]

function TaskCard({
  task,
  today,
  onDetails,
  onEdit,
  onDelete,
  onSteps,
  onSchedule,
  onComplete,
  onStart,
}: {
  task: Task
  today: string
  onDetails: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onSteps: (task: Task) => void
  onSchedule: (task: Task) => void
  onComplete: (task: Task) => void
  onStart: (task: Task) => void
}) {
  const overdue = task.deadline < today && task.status !== 'completed'
  const completedSteps = task.steps?.filter((step) => step.done).length ?? 0
  return (
    <article className="tp-task-card" data-completed={task.status === 'completed'}>
      <button
        className="tp-task-check"
        type="button"
        data-checked={task.status === 'completed'}
        aria-label={task.status === 'completed' ? `Reopen ${task.title}` : `Mark ${task.title} complete`}
        aria-pressed={task.status === 'completed'}
        onClick={() => task.status === 'completed' ? onStart(task) : onComplete(task)}
      >
        {task.status === 'completed' && <Check aria-hidden="true" />}
      </button>
      <div className="tp-task-main">
        <button className="tp-task-title-button" type="button" onClick={() => onDetails(task)}>
          <h3>{task.title}</h3>
          <ArrowRight aria-hidden="true" />
        </button>
        {task.description && <p className="tp-task-description">{task.description}</p>}
        <div className="tp-task-meta">
          <StatusBadge tone={`category-${task.category.toLowerCase()}`}>{task.category}</StatusBadge>
          <StatusBadge tone={`priority-${task.priority}`}>{task.priority}</StatusBadge>
          <span className="tp-task-meta-item"><Clock3 aria-hidden="true" />{formatDuration(task.duration)}</span>
          <span className="tp-task-meta-item" data-overdue={overdue}><CalendarDays aria-hidden="true" />{overdue ? 'Overdue' : task.deadline === today ? 'Due today' : formatCalendarDate(task.deadline, { month: 'short', day: 'numeric' })}</span>
          {task.status === 'todo' && <StatusBadge tone="status-todo">To do</StatusBadge>}
          {task.status === 'in-progress' && <StatusBadge tone="status-in-progress">In progress</StatusBadge>}
          {task.status === 'completed' && <StatusBadge tone="status-completed">Completed</StatusBadge>}
        </div>
        {task.steps && task.steps.length > 0 && (
          <button className="tp-task-step-progress" type="button" onClick={() => onSteps(task)}>
            <span className="tp-step-mini-track"><i style={{ width: `${(completedSteps / task.steps.length) * 100}%` }} /></span>
            {completedSteps} of {task.steps.length} small steps
          </button>
        )}
      </div>
      <div className="tp-task-actions">
        {task.status !== 'completed' && <Button type="button" variant="ghost" size="icon-sm" aria-label={task.status === 'in-progress' ? `Move ${task.title} back to to do` : `Start ${task.title}`} title={task.status === 'in-progress' ? 'Move back to to do' : 'Start task'} onClick={() => onStart(task)}><Circle data-icon="inline-start" /></Button>}
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Schedule ${task.title}`} title="Schedule" onClick={() => onSchedule(task)}><CalendarDays data-icon="inline-start" /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Break ${task.title} into steps`} title="Break into steps" onClick={() => onSteps(task)}><Sparkles data-icon="inline-start" /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${task.title}`} title="Edit task" onClick={() => onEdit(task)}><Pencil data-icon="inline-start" /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete ${task.title}`} title="Delete task" onClick={() => onDelete(task)}><Trash2 data-icon="inline-start" /></Button>
      </div>
    </article>
  )
}

function NaturalTaskComposer({ onAdd }: { onAdd: (task: NewTask) => void }) {
  const { data } = useTaskPilot()
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<NewTask | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!text.trim()) return
    setDraft(parseNaturalTask(text, data.tasks, data.profile.timezone))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
  }

  return (
    <Card className="tp-ai-task-card">
      <div className="tp-ai-task-decoration" aria-hidden="true"><Sparkles /></div>
      <div className="tp-ai-task-intro">
        <span className="tp-ai-chip"><WandSparkles aria-hidden="true" /> QUICK ADD WITH AI</span>
        <h2>Get it out of your head.</h2>
        <p>Write it the way you think it. TaskPilot will shape it into a task you can edit.</p>
      </div>
      <form className="tp-ai-task-form" onSubmit={handleSubmit}>
        <label className="tp-sr-only" htmlFor="natural-task">Describe a task in your own words</label>
        <input id="natural-task" className="tp-input" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={handleKeyDown} placeholder="e.g. Study biology for 45 minutes before Friday" />
        <Button type="submit" disabled={!text.trim()}><Sparkles data-icon="inline-start" />Turn into a task</Button>
      </form>
      {draft ? (
        <div className="tp-ai-task-preview">
          <div className="tp-ai-preview-copy">
            <span className="tp-ai-preview-label">TASK PREVIEW</span>
            <strong>{draft.title}</strong>
            <span>{draft.category} · {formatDuration(draft.duration)} · Due {formatCalendarDate(draft.deadline, { month: 'short', day: 'numeric' })}</span>
          </div>
          <div className="tp-ai-preview-actions">
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>Try again</Button>
            <Button type="button" onClick={() => { onAdd(draft); setDraft(null); setText('') }}>Add to my tasks</Button>
          </div>
        </div>
      ) : (
        <div className="tp-ai-examples"><span>Try:</span><button type="button" onClick={() => setText('Study two chapters of biology for one hour before Friday')}>“Study biology for one hour before Friday”</button><button type="button" onClick={() => setText('Finish my React assignment tomorrow evening for 2 hours')}>“Finish my React assignment tomorrow evening”</button></div>
      )}
    </Card>
  )
}

export function TasksPage() {
  const { data, ready, addTask, updateTask, deleteTask, completeTask, scheduleTaskAt } = useTaskPilot()
  const today = getTodayForProfile(data.profile)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [stepsOpen, setStepsOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)

  const filteredTasks = useMemo(() => data.tasks
    .filter((task) => statusFilter === 'all' || task.status === statusFilter)
    .filter((task) => categoryFilter === 'all' || task.category === categoryFilter)
    .filter((task) => !query.trim() || `${task.title} ${task.description} ${task.category}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1
      if (b.status === 'completed' && a.status !== 'completed') return -1
      return a.deadline.localeCompare(b.deadline)
    }), [categoryFilter, data.tasks, query, statusFilter])

  const openEdit = (task?: Task) => { setEditingTask(task); setEditorOpen(true) }
  const openDetails = (task: Task) => { setSelectedTask(task); setDetailsOpen(true) }
  const openSteps = (task: Task) => { setSelectedTask(task); setStepsOpen(true) }
  const openSchedule = (task: Task) => { setSelectedTask(task); setScheduleOpen(true) }
  const updateTaskStatus = (task: Task, status: TaskStatus) => updateTask(task.id, { status })

  if (!ready) return <div className="tp-page"><div className="tp-skeleton-header" /><div className="tp-skeleton-hero" /><div className="tp-skeleton-lower" /></div>

  return (
    <div className="tp-page tp-tasks-page">
      <PageHeader
        eyebrow="YOUR TASK SPACE"
          title="Your tasks"
          description="Everything you need to do, organized around what matters."
        action={<Button type="button" onClick={() => openEdit()}><Plus data-icon="inline-start" />Add task</Button>}
      />

      <NaturalTaskComposer onAdd={(task) => addTask(task)} />

      <section className="tp-task-list-section">
        <div className="tp-task-list-header">
          <div>
            <SectionHeading title="Your tasks" description={`${data.tasks.filter((task) => task.status !== 'completed').length} open · ${data.tasks.filter((task) => task.status === 'completed').length} complete`} />
          </div>
          <div className="tp-task-toolbar">
            <label className="tp-search-field" htmlFor="task-search"><Search aria-hidden="true" /><input id="task-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" /></label>
            <label className="tp-sr-only" htmlFor="category-filter">Filter by category</label>
            <select id="category-filter" className="tp-select tp-category-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">All categories</option>
              {TASK_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
        </div>

        <div className="tp-task-tabs" role="tablist" aria-label="Filter tasks by status">
          {statusFilters.map((filter) => {
            const count = filter.id === 'all' ? data.tasks.length : data.tasks.filter((task) => task.status === filter.id).length
            return <button key={filter.id} className="tp-task-tab" role="tab" type="button" aria-selected={statusFilter === filter.id} data-active={statusFilter === filter.id} onClick={() => setStatusFilter(filter.id)}>{filter.label}<span>{count}</span></button>
          })}
        </div>

        {filteredTasks.length > 0 ? (
          <div className="tp-task-list">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                today={today}
                onDetails={openDetails}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onSteps={openSteps}
                onSchedule={openSchedule}
                onComplete={(item) => completeTask(item.id)}
                onStart={(item) => updateTaskStatus(item, item.status === 'todo' ? 'in-progress' : 'todo')}
              />
            ))}
          </div>
        ) : (
          <Card className="tp-task-empty-card">
            <EmptyState
              title={query || categoryFilter !== 'all' || statusFilter !== 'all' ? 'Nothing matches just yet' : 'Your task list is clear.'}
              description={query || categoryFilter !== 'all' || statusFilter !== 'all' ? 'Try a different search or filter to find what you are looking for.' : 'Add something you’re working on and TaskPilot will help you find the right time for it.'}
              action={<Button type="button" onClick={() => openEdit()}><Plus data-icon="inline-start" />Add your first task</Button>}
            />
          </Card>
        )}
      </section>

      <div className="tp-task-bottom-note"><Sparkles aria-hidden="true" /><span>Plans can change. Your progress still counts.</span><ArrowDownWideNarrow aria-hidden="true" /></div>

      <TaskEditorModal
        open={editorOpen}
        initialTask={editingTask}
        today={today}
        onClose={() => { setEditorOpen(false); setEditingTask(undefined) }}
        onSave={(task) => {
          if (editingTask) updateTask(editingTask.id, task)
          else addTask(task)
          setEditingTask(undefined)
        }}
      />
      <TaskDetailsModal
        task={selectedTask}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onEdit={(task) => openEdit(task)}
        onSchedule={openSchedule}
        onSteps={openSteps}
        onComplete={(task) => completeTask(task.id)}
      />
      <TaskStepsModal
        task={selectedTask}
        open={stepsOpen}
        onClose={() => setStepsOpen(false)}
        onSave={(steps) => selectedTask && updateTask(selectedTask.id, { steps })}
      />
      <TaskScheduleModal
        task={selectedTask}
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        today={today}
        onSchedule={(date, time) => selectedTask && scheduleTaskAt(selectedTask.id, date, time)}
      />
      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this task?"
        description={deleteTarget ? `“${deleteTarget.title}” and its attached reminders will be removed from this workspace.` : ''}
        confirmLabel="Delete task"
        destructive
        onConfirm={() => { if (deleteTarget) deleteTask(deleteTarget.id); setDeleteTarget(null) }}
      />
    </div>
  )
}

export default TasksPage
