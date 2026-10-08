'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Compass,
  Flame,
  ListTodo,
  Plus,
  Sparkles,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, PageHeader, SectionHeading, StatusBadge } from '@/components/taskpilot/ui'
import { useTaskPilot, getTodayForProfile } from '@/components/taskpilot/taskpilot-provider'
import { ReminderModal, TaskDetailsModal, TaskEditorModal, TaskScheduleModal, TaskStepsModal } from '@/components/taskpilot/task-dialogs'
import { addDays, formatCalendarDate, formatDuration, formatTime, getDateInTimezone, minutesFromTime } from '@/lib/taskpilot/seed'
import { findNextAvailableTime } from '@/lib/taskpilot/planner'
import type { FocusSession, ScheduleItem, Task } from '@/lib/taskpilot/types'

function CircularTimer({ progress, time }: { progress: number; time: string }) {
  const circumference = 2 * Math.PI * 46
  const offset = circumference - (progress / 100) * circumference
  return (
    <div className="tp-timer-ring" aria-label={`${Math.round(progress)} percent of focus session complete`}>
      <svg viewBox="0 0 112 112" aria-hidden="true">
        <circle className="tp-timer-track" cx="56" cy="56" r="46" />
        <circle className="tp-timer-progress" cx="56" cy="56" r="46" style={{ strokeDasharray: circumference, strokeDashoffset: offset }} />
      </svg>
      <span className="tp-timer-time">{time}</span>
      <span className="tp-timer-caption">left</span>
    </div>
  )
}

function FocusSessionCard({ tasks }: { tasks: Task[] }) {
  const { data, addFocusSession, toast } = useTaskPilot()
  const [selectedTaskId, setSelectedTaskId] = useState(tasks.find((task) => task.status !== 'completed')?.id ?? '')
  const [duration, setDuration] = useState(data.routine.focusDuration)
  const [secondsLeft, setSecondsLeft] = useState(data.routine.focusDuration * 60)
  const [running, setRunning] = useState(false)
  const selectedTask = tasks.find((task) => task.id === selectedTaskId)

  useEffect(() => {
    if (selectedTaskId && !tasks.some((task) => task.id === selectedTaskId)) setSelectedTaskId('')
  }, [selectedTaskId, tasks])

  useEffect(() => {
    if (!running) {
      setDuration(data.routine.focusDuration)
      setSecondsLeft(data.routine.focusDuration * 60)
    }
  }, [data.routine.focusDuration, running])

  const complete = useCallback((minutes = Math.max(1, Math.round((duration * 60 - secondsLeft) / 60))) => {
    addFocusSession({
      date: getDateInTimezone(new Date(), data.profile.timezone),
      minutes,
      taskId: selectedTask?.id,
      taskTitle: selectedTask?.title ?? 'Focus time',
    })
    setRunning(false)
    setSecondsLeft(duration * 60)
  }, [addFocusSession, data.profile.timezone, duration, secondsLeft, selectedTask])

  useEffect(() => {
    if (!running) return
    if (secondsLeft <= 0) {
      complete(duration)
      return
    }
    const timeout = window.setTimeout(() => {
      setSecondsLeft((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearTimeout(timeout)
  }, [complete, duration, running, secondsLeft])

  const progress = ((duration * 60 - secondsLeft) / Math.max(1, duration * 60)) * 100
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const time = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  const reset = () => {
    setRunning(false)
    setDuration(data.routine.focusDuration)
    setSecondsLeft(data.routine.focusDuration * 60)
  }

  return (
    <Card className="tp-focus-card">
      <div className="tp-card-topline">
        <div className="tp-mini-heading"><span className="tp-icon-tile tp-icon-sage"><Target aria-hidden="true" /></span><span><strong>Focus session</strong><small>A little time, just for this</small></span></div>
        <StatusBadge tone="quiet">{data.routine.focusDuration} min</StatusBadge>
      </div>
      <div className="tp-focus-body">
        <CircularTimer progress={progress} time={time} />
        <div className="tp-focus-copy">
          <span className="tp-eyebrow">CURRENTLY FOCUSING ON</span>
          <strong>{selectedTask?.title ?? 'A clear headspace'}</strong>
          <p>{running ? 'Stay with one thing. You are doing enough.' : 'Choose a task, then give it your full attention.'}</p>
          <label className="tp-sr-only" htmlFor="focus-task">Focus task</label>
          <select id="focus-task" className="tp-select tp-focus-select" value={selectedTaskId} onChange={(event) => setSelectedTaskId(event.target.value)} disabled={running}>
            <option value="">Choose a task</option>
            {tasks.filter((task) => task.status !== 'completed').map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
          </select>
          <div className="tp-focus-actions">
            <Button type="button" onClick={() => setRunning((value) => !value)}>{running ? 'Pause' : 'Start focus'}</Button>
            <Button type="button" variant="ghost" onClick={reset}>Reset</Button>
            <Button type="button" variant="outline" disabled={secondsLeft === duration * 60} onClick={() => complete()}>Complete session</Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function ScheduleRow({ item, task, onOpen, onComplete }: {
  item: ScheduleItem
  task?: Task
  onOpen: () => void
  onComplete: () => void
}) {
  const isBreak = item.kind === 'break'
  const isDone = item.completed || task?.status === 'completed'
  return (
    <div className="tp-timeline-row" data-kind={item.kind} data-done={isDone}>
      <div className="tp-timeline-time"><strong>{formatTime(item.startTime)}</strong><span>{formatDuration(item.minutes)}</span></div>
      <span className="tp-timeline-stem" aria-hidden="true"><i /></span>
      <button className="tp-timeline-content" type="button" onClick={onOpen}>
        <span className="tp-timeline-title-row"><strong>{item.title}</strong>{item.reason && <Sparkles aria-label="AI-planned" />}</span>
        <span className="tp-timeline-meta">
          {item.category && <span>{item.category}</span>}
          {item.priority && !isBreak && <span className={`tp-priority-dot tp-priority-${item.priority}`}><i />{item.priority}</span>}
          {isBreak && <span>Reset</span>}
        </span>
        {item.reason && <span className="tp-timeline-reason">{item.reason}</span>}
      </button>
      {!isBreak && task && !isDone && (
        <Button className="tp-timeline-check" type="button" variant="ghost" size="icon-sm" aria-label={`Mark ${task.title} complete`} onClick={onComplete}>
          <Check data-icon="inline-start" />
        </Button>
      )}
      {isDone && <span className="tp-complete-check"><Check aria-hidden="true" /></span>}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Flame; label: string; value: string | number; detail: string; tone: string }) {
  return (
    <Card className="tp-stat-card">
      <div className={`tp-stat-icon ${tone}`}><Icon aria-hidden="true" /></div>
      <div className="tp-stat-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
    </Card>
  )
}

function getAvailableWindows(items: ScheduleItem[], wakeTime: string, sleepTime: string, focusDuration: number, fromMinute: number) {
  const busy = items
    .filter((item) => !item.completed && !item.missed)
    .map((item) => ({ start: minutesFromTime(item.startTime), end: minutesFromTime(item.endTime) }))
    .sort((a, b) => a.start - b.start)
  let cursor = Math.max(minutesFromTime(wakeTime), fromMinute)
  const sleep = minutesFromTime(sleepTime)
  let windows = 0
  for (const item of busy) {
    if (item.start - cursor >= focusDuration) windows += 1
    cursor = Math.max(cursor, item.end)
  }
  if (sleep - cursor >= focusDuration) windows += 1
  return windows
}

function getGreeting(timezone: string) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

export function DashboardPage() {
  const { data, ready, generateDayPlan, addTask, completeTask, updateTask, addReminder, addFocusSession, scheduleTaskAt, toast } = useTaskPilot()
  const today = getTodayForProfile(data.profile)
  const [planning, setPlanning] = useState(false)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [stepsOpen, setStepsOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleTask, setScheduleTask] = useState<Task | null>(null)

  const todaySchedule = useMemo(() => data.schedule.filter((item) => item.date === today).sort((a, b) => a.startTime.localeCompare(b.startTime)), [data.schedule, today])
  const todayTasks = useMemo(() => data.tasks.filter((task) => task.deadline <= today && task.status !== 'completed'), [data.tasks, today])
  const priorities = useMemo(() => [...data.tasks].filter((task) => task.status !== 'completed').sort((a, b) => {
    const rank = { urgent: 4, high: 3, medium: 2, low: 1 }
    return rank[b.priority] - rank[a.priority] || a.deadline.localeCompare(b.deadline)
  }).slice(0, 3), [data.tasks])
  const plannedFocus = todaySchedule.filter((item) => item.kind === 'task' && !item.completed && !item.missed).reduce((sum, item) => sum + item.minutes, 0)
  const completedToday = data.tasks.filter((task) => task.status === 'completed' && task.completedAt && getDateInTimezone(new Date(task.completedAt), data.profile.timezone) === today).length
  const currentTime = new Intl.DateTimeFormat('en-GB', { timeZone: data.profile.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
  const windows = getAvailableWindows(todaySchedule, data.routine.wakeTime, data.routine.sleepTime, data.routine.focusDuration, minutesFromTime(currentTime))
  const upcomingReminders = data.reminders.filter((reminder) => !reminder.delivered).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 2)
  const nextCommitment = data.schedule
    .filter((item) => item.kind === 'commitment' && !item.completed && !item.missed && (item.date > today || item.date === today && item.startTime >= currentTime))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))[0]
  const nextTask = priorities[0]
  const freeStart = nextTask ? findNextAvailableTime({ date: today, minutes: Math.min(nextTask.duration, 50), routine: data.routine, schedule: data.schedule, timezone: data.profile.timezone }) : null
  const nextDeadline = [...data.tasks].filter((task) => task.status !== 'completed').sort((a, b) => a.deadline.localeCompare(b.deadline))[0]

  const handleShapeDay = () => {
    setPlanning(true)
    const openTasks = data.tasks.filter((task) => task.status !== 'completed')
    if (openTasks.length === 0) {
      toast('Add at least one task before shaping your day!', 'info')
      setPlanning(false)
      return
    }
    window.setTimeout(() => {
      generateDayPlan()
      setPlanning(false)
    }, 450)
  }
  const openDetails = (task: Task) => { setSelectedTask(task); setDetailsOpen(true) }
  const openSteps = (task: Task) => { setSelectedTask(task); setStepsOpen(true) }
  const openSchedule = (task: Task) => { setScheduleTask(task); setScheduleOpen(true) }

  if (!ready) return <DashboardSkeleton />

  return (
    <div className="tp-page tp-dashboard-page">
      <PageHeader
        eyebrow={`TODAY · ${formatCalendarDate(today, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}`}
        title={`${getGreeting(data.profile.timezone)}, ${data.profile.name}.`}
        description="Let's make today feel a little more manageable."
        action={(
          <Button type="button" className="tp-shape-button" disabled={planning} onClick={handleShapeDay}>
            <Sparkles data-icon="inline-start" />
            {planning ? 'Finding your flow…' : 'Shape my day'}
          </Button>
        )}
      />

      <section className="tp-dashboard-hero">
        <div className="tp-hero-copy">
          <span className="tp-hero-kicker"><Sparkles aria-hidden="true" /> TODAY AT A GLANCE</span>
          <h2>A thoughtful plan,<br />with room to breathe.</h2>
          <p>Your priorities are arranged around your available time, energy and commitments.</p>
          <div className="tp-hero-actions">
            <Link href="/calendar" className="tp-hero-link">View calendar <ArrowRight aria-hidden="true" /></Link>
            <span className="tp-hero-divider" aria-hidden="true" />
            <a href="#today-plan" className="tp-hero-link tp-hero-link-muted">Open today&apos;s plan</a>
          </div>
        </div>
        <div className="tp-hero-visual" aria-hidden="true">
          <div className="tp-hero-orbit tp-orbit-outer" />
          <div className="tp-hero-orbit tp-orbit-inner" />
          <div className="tp-hero-sun"><Compass /></div>
          <div className="tp-hero-note"><span>YOUR DAY</span><strong>In good hands</strong><i><Check /></i></div>
          <span className="tp-hero-sparkle tp-sparkle-one">✦</span>
          <span className="tp-hero-sparkle tp-sparkle-two">✧</span>
        </div>
      </section>

      <section className="tp-stat-grid" aria-label="Today's progress">
        <StatCard icon={ListTodo} label="Tasks in play" value={todaySchedule.filter((item) => item.kind === 'task' && !item.missed).length || todayTasks.length} detail={`${todayTasks.length} need attention`} tone="tp-stat-sage" />
        <StatCard icon={Check} label="Completed today" value={completedToday} detail={completedToday ? 'A good start' : 'Your first win is waiting'} tone="tp-stat-peach" />
        <StatCard icon={Clock3} label="Focus time" value={formatDuration(plannedFocus)} detail="Planned for today" tone="tp-stat-blue" />
        <StatCard icon={Target} label="Clear windows" value={windows} detail="Long enough to focus" tone="tp-stat-lilac" />
      </section>

      <div className="tp-dashboard-grid">
        <section className="tp-dashboard-main-column">
          <Card className="tp-plan-card" id="today-plan">
            <div className="tp-card-header-row">
              <SectionHeading title="Today's plan" description="A gentle rhythm, one block at a time." />
              <Link href="/calendar" className="tp-card-link">Full calendar <ArrowRight aria-hidden="true" /></Link>
            </div>
            {todaySchedule.length > 0 ? (
              <div className="tp-timeline">
                {todaySchedule.slice(0, 6).map((item) => {
                  const task = data.tasks.find((candidate) => candidate.id === item.taskId)
                  return (
                    <ScheduleRow
                      key={item.id}
                      item={item}
                      task={task}
                      onOpen={() => task ? openDetails(task) : toast(item.description || item.title, 'info')}
                      onComplete={() => task && completeTask(task.id)}
                    />
                  )
                })}
                {todaySchedule.length > 6 && <Link href="/calendar" className="tp-timeline-more">See {todaySchedule.length - 6} more blocks <ArrowRight aria-hidden="true" /></Link>}
              </div>
            ) : (
              <EmptyState title="Your day has room." description="Shape your day and TaskPilot will find thoughtful places for your priorities." action={<Button type="button" onClick={handleShapeDay} disabled={planning}><Sparkles data-icon="inline-start" />{planning ? 'Planning…' : 'Shape my day'}</Button>} />
            )}
          </Card>

          <FocusSessionCard tasks={data.tasks} />
        </section>

        <aside className="tp-dashboard-side-column">
          <Card className="tp-priority-card">
            <div className="tp-card-header-row">
              <SectionHeading title="Your priorities" description="The next right things." />
              <span className="tp-priority-count">{priorities.length}</span>
            </div>
            {priorities.length > 0 ? (
              <div className="tp-priority-list">
                {priorities.map((task, index) => (
                  <div className="tp-priority-row" key={task.id}>
                    <button className="tp-priority-open" type="button" onClick={() => openDetails(task)} aria-label={`View ${task.title}`}>
                      <span className="tp-priority-index">0{index + 1}</span>
                      <span className="tp-priority-info"><strong>{task.title}</strong><small>{task.category} · {formatDuration(task.duration)}</small></span>
                    </button>
                    <button className="tp-priority-check" type="button" onClick={() => completeTask(task.id)} aria-label={`Mark ${task.title} complete`}><Check aria-hidden="true" /></button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="All caught up" description="A little breathing room looks good on you." />
            )}
            <Link href="/tasks" className="tp-card-footer-link">See all tasks <ArrowRight aria-hidden="true" /></Link>
          </Card>

          <Card className="tp-nudge-card">
            <div className="tp-nudge-head"><span className="tp-icon-tile tp-icon-sage"><Sparkles aria-hidden="true" /></span><span className="tp-eyebrow">A GENTLE NUDGE</span></div>
            {freeStart && nextTask ? (
              <>
                <h3>A clear window is waiting.</h3>
                <p>{formatTime(freeStart, data.profile.timeFormat)} could be a good time for <strong>{nextTask.title}</strong>. It fits your {data.routine.preferredPeriod} rhythm.</p>
                <Button type="button" variant="outline" className="tp-nudge-action" onClick={() => openSchedule(nextTask)}>Make it happen <ArrowRight data-icon="inline-end" /></Button>
              </>
            ) : (
              <>
                <h3>Leave a little room to breathe.</h3>
                <p>Your day is full. A short reset can be just as productive as another task.</p>
                <Link href="/routine" className="tp-nudge-text-link">Review your routine <ArrowRight aria-hidden="true" /></Link>
              </>
            )}
          </Card>

          <Card className="tp-upcoming-card">
            <div className="tp-card-header-row">
              <SectionHeading title="Coming up" description="Deadlines, commitments and reminders." />
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Add reminder" onClick={() => setReminderOpen(true)}><Plus data-icon="inline-start" /></Button>
            </div>
            {nextDeadline ? (
              <div className="tp-upcoming-item">
                <span className="tp-upcoming-icon"><CalendarDays aria-hidden="true" /></span>
                <span className="tp-upcoming-copy"><strong>{nextDeadline.title}</strong><small>{nextDeadline.deadline === today ? 'Due today' : `Due ${formatCalendarDate(nextDeadline.deadline, { month: 'short', day: 'numeric' })}`}</small></span>
                <span className="tp-upcoming-priority" data-priority={nextDeadline.priority} />
              </div>
            ) : <p className="tp-muted-copy">No deadlines on the horizon.</p>}
            {nextCommitment && (
              <div className="tp-upcoming-item">
                <span className="tp-upcoming-icon tp-upcoming-icon-blue"><CalendarDays aria-hidden="true" /></span>
                <span className="tp-upcoming-copy"><strong>{nextCommitment.title}</strong><small>{nextCommitment.date === today ? `Today · ${formatTime(nextCommitment.startTime, data.profile.timeFormat)}` : `${formatCalendarDate(nextCommitment.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${formatTime(nextCommitment.startTime, data.profile.timeFormat)}`}</small></span>
              </div>
            )}
            {upcomingReminders.map((reminder) => (
              <div className="tp-upcoming-item" key={reminder.id}>
                <span className="tp-upcoming-icon tp-upcoming-icon-warm"><Clock3 aria-hidden="true" /></span>
                <span className="tp-upcoming-copy"><strong>{reminder.message}</strong><small>{new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(reminder.dueAt))}</small></span>
              </div>
            ))}
            {upcomingReminders.length === 0 && <Button type="button" variant="outline" className="tp-reminder-add" onClick={() => setReminderOpen(true)}><Plus data-icon="inline-start" />Add a reminder</Button>}
          </Card>

          <div className="tp-streak-strip"><span className="tp-streak-icon"><Flame aria-hidden="true" /></span><span><strong>{data.focusSessions.filter((session: FocusSession) => session.date >= addDays(today, -6)).length} focus sessions</strong><small>in the last 7 days</small></span><Link href="/insights" aria-label="View insights"><ArrowRight aria-hidden="true" /></Link></div>
        </aside>
      </div>

      <TaskDetailsModal task={selectedTask} open={detailsOpen} onClose={() => setDetailsOpen(false)} onEdit={(task) => { setEditingTask(task); setEditorOpen(true) }} onSchedule={openSchedule} onSteps={openSteps} onComplete={(task) => completeTask(task.id)} />
      <TaskEditorModal open={editorOpen} initialTask={editingTask ?? undefined} today={today} onClose={() => { setEditorOpen(false); setEditingTask(null) }} onSave={(task) => { if (editingTask) updateTask(editingTask.id, task); else addTask(task) }} />
      <TaskStepsModal task={selectedTask} open={stepsOpen} onClose={() => setStepsOpen(false)} onSave={(steps) => selectedTask && updateTask(selectedTask.id, { steps })} />
      <TaskScheduleModal task={scheduleTask} open={scheduleOpen} onClose={() => setScheduleOpen(false)} today={today} onSchedule={(date, time) => scheduleTask && scheduleTaskAt(scheduleTask.id, date, time)} />
      <ReminderModal open={reminderOpen} onClose={() => setReminderOpen(false)} tasks={data.tasks} onSave={(reminder) => addReminder(reminder)} />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="tp-page tp-dashboard-page" aria-label="Loading dashboard" aria-busy="true">
      <div className="tp-skeleton-header"><span /><span /></div>
      <div className="tp-skeleton-hero" />
      <div className="tp-skeleton-stats"><span /><span /><span /><span /></div>
      <div className="tp-skeleton-lower"><span /><span /></div>
    </div>
  )
}

export default DashboardPage
