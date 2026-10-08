'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ListTodo,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Sparkles,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, Field, Modal, PageHeader, SectionHeading, StatusBadge } from '@/components/taskpilot/ui'
import { useTaskPilot, getTodayForProfile } from '@/components/taskpilot/taskpilot-provider'
import { addDays, formatCalendarDate, formatDuration, formatTime, minutesFromTime, timeFromMinutes } from '@/lib/taskpilot/seed'
import type { ScheduleItem, Task } from '@/lib/taskpilot/types'

function getWeekStart(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
  const mondayOffset = (weekday + 6) % 7
  return addDays(date, -mondayOffset)
}

function getWeekDays(date: string) {
  const first = getWeekStart(date)
  return Array.from({ length: 7 }, (_, index) => addDays(first, index))
}

function getWeekRange(days: string[]) {
  if (days.length < 7) return ''
  const first = new Date(`${days[0]}T12:00:00`)
  const last = new Date(`${days[6]}T12:00:00`)
  const sameMonth = first.getMonth() === last.getMonth()
  const firstMonth = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(first)
  const lastMonth = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(last)
  return sameMonth
    ? `${firstMonth} ${first.getDate()} – ${last.getDate()}, ${first.getFullYear()}`
    : `${firstMonth} ${first.getDate()} – ${lastMonth} ${last.getDate()}`
}

function EventPill({ item, onClick, compact = false }: { item: ScheduleItem; onClick: () => void; compact?: boolean }) {
  const startMinute = minutesFromTime(item.startTime)
  const endMinute = minutesFromTime(item.endTime)
  const rowStart = Math.max(1, Math.min(15, Math.floor((startMinute - 7 * 60) / 60) + 1))
  const visibleStart = Math.max(startMinute, 7 * 60)
  const visibleEnd = Math.min(22 * 60, Math.max(endMinute, visibleStart + 30))
  const rowSpan = Math.max(1, Math.min(16 - rowStart, Math.ceil((visibleEnd - visibleStart) / 60)))
  return (
    <button type="button" className="tp-calendar-event" style={compact ? { gridRow: `${rowStart} / span ${rowSpan}` } : undefined} data-kind={item.kind} data-missed={item.missed} data-completed={item.completed} onClick={onClick}>
      <span className="tp-calendar-event-time">{formatTime(item.startTime)} – {formatTime(item.endTime)}</span>
      <strong>{item.title}</strong>
      <span className="tp-calendar-event-meta">{item.kind === 'task' ? item.category || 'Task' : item.kind === 'break' ? 'Reset' : item.kind === 'routine' ? 'Routine' : 'Commitment'}</span>
    </button>
  )
}

function CalendarDayColumn({ date, today, items, onSelect, onEvent, onAdd }: {
  date: string
  today: string
  items: ScheduleItem[]
  onSelect: () => void
  onEvent: (item: ScheduleItem) => void
  onAdd: (date: string) => void
}) {
  const day = new Date(`${date}T12:00:00`)
  return (
    <div className="tp-calendar-day" data-today={date === today}>
      <button type="button" className="tp-calendar-day-head" onClick={onSelect} aria-label={`Open ${formatCalendarDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}`}>
        <span>{new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(day)}</span>
        <strong>{day.getDate()}</strong>
        <small>{items.length ? `${items.length} ${items.length === 1 ? 'block' : 'blocks'}` : 'Open day'}</small>
      </button>
      <div className="tp-calendar-day-events">
        {items.length > 0 ? items.map((item) => <EventPill key={item.id} item={item} compact onClick={() => onEvent(item)} />) : <p className="tp-calendar-empty-day">A little room to breathe.</p>}
      </div>
      <button className="tp-calendar-add-day" type="button" onClick={() => onAdd(date)}><Plus aria-hidden="true" />Add</button>
    </div>
  )
}

function AddEventModal({ open, onClose, onSave, initialDate }: {
  open: boolean
  onClose: () => void
  onSave: (event: Omit<ScheduleItem, 'id'>) => void
  initialDate: string
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(initialDate)
  const [startTime, setStartTime] = useState('10:00')
  const [minutes, setMinutes] = useState(60)
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!open) return
    setDate(initialDate)
    setTitle('')
    setStartTime('10:00')
    setMinutes(60)
    setDescription('')
  }, [initialDate, open])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const start = minutesFromTime(startTime)
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      startTime,
      endTime: timeFromMinutes(start + minutes),
      minutes,
      kind: 'commitment',
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add to your calendar" description="Add a class, appointment or other commitment so the plan can work around it." size="md">
      <form className="tp-form" onSubmit={handleSubmit}>
        <Field id="event-title" label="What is it called?">
          <input id="event-title" className="tp-input" autoFocus required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Lecture, appointment, or time with a friend" />
        </Field>
        <div className="tp-form-grid">
          <Field id="event-date" label="Day"><input id="event-date" className="tp-input" type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></Field>
          <Field id="event-time" label="Start time"><input id="event-time" className="tp-input" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} /></Field>
          <Field id="event-duration" label="How long?"><div className="tp-input-suffix"><input id="event-duration" className="tp-input" type="number" min={15} max={720} step={15} required value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /><span>minutes</span></div></Field>
          <Field id="event-description" label="A note" hint="Optional"><input id="event-description" className="tp-input" maxLength={180} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Room 204, bring a notebook…" /></Field>
        </div>
        <div className="tp-modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Add commitment</Button></div>
      </form>
    </Modal>
  )
}

function EditEventModal({ item, onClose, onSave }: { item: ScheduleItem | null; onClose: () => void; onSave: (changes: Partial<ScheduleItem>) => void }) {
  const [date, setDate] = useState(item?.date ?? '')
  const [startTime, setStartTime] = useState(item?.startTime ?? '09:00')
  const [title, setTitle] = useState(item?.title ?? '')

  useEffect(() => {
    if (item) {
      setDate(item.date)
      setStartTime(item.startTime)
      setTitle(item.title)
    }
  }, [item])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!item) return
    const start = minutesFromTime(startTime)
    onSave({ date, startTime, endTime: timeFromMinutes(start + item.minutes), title: title.trim() })
    onClose()
  }

  return (
    <Modal open={Boolean(item)} onClose={onClose} title="Move this block" description={item?.title} size="sm">
      <form className="tp-form" onSubmit={submit}>
        <Field id="edit-event-title" label="Title"><input id="edit-event-title" className="tp-input" required value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
        <Field id="edit-event-date" label="Day"><input id="edit-event-date" className="tp-input" type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></Field>
        <Field id="edit-event-time" label="Start time"><input id="edit-event-time" className="tp-input" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} /></Field>
        <div className="tp-modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save changes</Button></div>
      </form>
    </Modal>
  )
}

function ScheduleDetailModal({ item, task, onClose, onComplete, onMissed, onEdit, onDelete }: {
  item: ScheduleItem | null
  task?: Task
  onClose: () => void
  onComplete: () => void
  onMissed: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Modal open={Boolean(item)} onClose={onClose} title={item?.title ?? 'Calendar block'} description={item?.description || item?.reason} size="sm">
      {item && (
        <div className="tp-event-detail">
          <div className="tp-event-detail-row"><CalendarDays aria-hidden="true" /><span>{formatCalendarDate(item.date, { weekday: 'long', month: 'long', day: 'numeric' })}</span></div>
          <div className="tp-event-detail-row"><Clock3 aria-hidden="true" /><span>{formatTime(item.startTime)} – {formatTime(item.endTime)} · {formatDuration(item.minutes)}</span></div>
          <div className="tp-event-detail-tags"><StatusBadge tone={`event-${item.kind}`}>{item.kind === 'task' ? item.category || 'Task' : item.kind}</StatusBadge>{item.priority && <StatusBadge tone={`priority-${item.priority}`}>{item.priority}</StatusBadge>}{item.missed && <StatusBadge tone="priority-urgent">Missed</StatusBadge>}</div>
          {item.reason && <div className="tp-event-reason"><Sparkles aria-hidden="true" /><span>{item.reason}</span></div>}
          {task?.steps && task.steps.length > 0 && <p className="tp-muted-copy">{task.steps.filter((step) => step.done).length} of {task.steps.length} task steps complete.</p>}
          <div className="tp-modal-actions tp-event-actions">
            <Button type="button" variant="outline" onClick={onEdit}>Move block</Button>
            {item.kind === 'task' && task && !item.completed && !item.missed && <Button type="button" onClick={onComplete}><Check data-icon="inline-start" />Mark complete</Button>}
            {item.kind === 'task' && task && !item.completed && !item.missed && <Button type="button" variant="ghost" onClick={onMissed}>I missed this</Button>}
            <Button type="button" variant="ghost" onClick={onDelete}><X data-icon="inline-start" />Remove</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function MissedRecoveryModal({ open, item, onClose, onRecover }: {
  open: boolean
  item: ScheduleItem | null
  onClose: () => void
  onRecover: (choice: 'next' | 'tomorrow' | 'keep') => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="Looks like this didn’t happen today." description={item ? `“${item.title}” is still on your list. Where would you like it to go?` : undefined} size="md">
      <div className="tp-recovery-options">
        <button className="tp-recovery-option" type="button" onClick={() => onRecover('next')}>
          <span className="tp-recovery-icon"><Sparkles aria-hidden="true" /></span><span><strong>Next open slot</strong><small>Keep momentum without squeezing the rest of your day.</small></span><ArrowRight aria-hidden="true" />
        </button>
        <button className="tp-recovery-option" type="button" onClick={() => onRecover('tomorrow')}>
          <span className="tp-recovery-icon tp-recovery-icon-warm"><CalendarDays aria-hidden="true" /></span><span><strong>Tomorrow</strong><small>Give it a fresh place in your routine.</small></span><ArrowRight aria-hidden="true" />
        </button>
        <button className="tp-recovery-option" type="button" onClick={() => onRecover('keep')}>
          <span className="tp-recovery-icon tp-recovery-icon-muted"><ListTodo aria-hidden="true" /></span><span><strong>Keep in my task list</strong><small>Leave it unscheduled for now.</small></span><ArrowRight aria-hidden="true" />
        </button>
      </div>
      <div className="tp-modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Not now</Button></div>
    </Modal>
  )
}

function DayAgenda({ date, items, onEvent, onAdd }: { date: string; items: ScheduleItem[]; onEvent: (item: ScheduleItem) => void; onAdd: (date: string) => void }) {
  return (
    <Card className="tp-day-agenda">
      <div className="tp-agenda-heading"><div><span className="tp-eyebrow">YOUR DAY</span><h2>{formatCalendarDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</h2></div><Button type="button" variant="outline" onClick={() => onAdd(date)}><Plus data-icon="inline-start" />Add event</Button></div>
      {items.length > 0 ? <div className="tp-agenda-list">{items.map((item) => <EventPill key={item.id} item={item} onClick={() => onEvent(item)} />)}</div> : <EmptyState title="Nothing scheduled here yet" description="This day has a little breathing room. Add a commitment or let TaskPilot shape a plan." action={<Button type="button" onClick={() => onAdd(date)}><Plus data-icon="inline-start" />Add an event</Button>} />}
    </Card>
  )
}

export function CalendarPage() {
  const { data, ready, addSchedule, updateSchedule, deleteSchedule, completeTask, markScheduleMissed, recoverMissedSchedule, generateWeekPlan, toast } = useTaskPilot()
  const today = getTodayForProfile(data.profile)
  const [anchorDate, setAnchorDate] = useState(today)
  const [selectedDate, setSelectedDate] = useState(today)
  const [view, setView] = useState<'week' | 'day'>('week')
  const [planning, setPlanning] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addDate, setAddDate] = useState(today)
  const [selectedEvent, setSelectedEvent] = useState<ScheduleItem | null>(null)
  const [editEvent, setEditEvent] = useState<ScheduleItem | null>(null)
  const [missedEvent, setMissedEvent] = useState<ScheduleItem | null>(null)

  const days = useMemo(() => getWeekDays(anchorDate), [anchorDate])
  const visibleWeekItems = useMemo(() => data.schedule.filter((item) => days.includes(item.date)), [data.schedule, days])
  const dayItems = useMemo(() => data.schedule.filter((item) => item.date === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)), [data.schedule, selectedDate])
  const selectedTask = selectedEvent?.taskId ? data.tasks.find((task) => task.id === selectedEvent.taskId) : undefined

  const changeWeek = (direction: number) => {
    const next = addDays(anchorDate, 7 * direction)
    setAnchorDate(next)
    if (view === 'day') setSelectedDate(next)
  }
  const openAdd = (date: string) => { setAddDate(date); setAddOpen(true) }
  const shapeWeek = () => {
    setPlanning(true)
    window.setTimeout(() => {
      generateWeekPlan()
      setPlanning(false)
    }, 700)
  }
  const handleMissed = () => {
    if (!selectedEvent) return
    markScheduleMissed(selectedEvent.id)
    setMissedEvent(selectedEvent)
    setSelectedEvent(null)
  }
  const handleRecover = (choice: 'next' | 'tomorrow' | 'keep') => {
    if (missedEvent) recoverMissedSchedule(missedEvent.id, choice)
    setMissedEvent(null)
  }
  const handleEventComplete = () => {
    if (!selectedEvent) return
    if (selectedEvent.taskId) completeTask(selectedEvent.taskId)
    else updateSchedule(selectedEvent.id, { completed: true })
    setSelectedEvent(null)
  }
  const handleEdit = () => {
    if (!selectedEvent) return
    setEditEvent(selectedEvent)
    setSelectedEvent(null)
  }

  if (!ready) return <div className="tp-page"><div className="tp-skeleton-header" /><div className="tp-skeleton-hero" /><div className="tp-skeleton-lower" /></div>

  return (
    <div className="tp-page tp-calendar-page">
      <PageHeader
        eyebrow="A LITTLE STRUCTURE, A LOT OF ROOM"
        title="Your week, at a glance."
        description="Make space for your priorities and the things already on your calendar."
        action={<div className="tp-calendar-header-actions"><Button type="button" variant="outline" onClick={() => openAdd(selectedDate)}><Plus data-icon="inline-start" />Add event</Button><Button type="button" onClick={shapeWeek} disabled={planning}><Sparkles data-icon="inline-start" />{planning ? 'Shaping your week…' : 'Shape my week'}</Button></div>}
      />

      <Card className="tp-calendar-card">
        <div className="tp-calendar-toolbar">
          <div className="tp-calendar-period">
            <div className="tp-calendar-nav-buttons">
              <Button type="button" variant="outline" size="icon-sm" aria-label="Previous week" onClick={() => changeWeek(-1)}><ChevronLeft data-icon="inline-start" /></Button>
              <Button type="button" variant="outline" size="icon-sm" aria-label="Next week" onClick={() => changeWeek(1)}><ChevronRight data-icon="inline-start" /></Button>
            </div>
            <h2>{getWeekRange(days)}</h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setAnchorDate(today); setSelectedDate(today) }}>Today</Button>
          </div>
          <div className="tp-view-switch" role="group" aria-label="Calendar view">
            <button className="tp-view-button" type="button" data-active={view === 'week'} aria-pressed={view === 'week'} onClick={() => setView('week')}>Week</button>
            <button className="tp-view-button" type="button" data-active={view === 'day'} aria-pressed={view === 'day'} onClick={() => setView('day')}>Day</button>
          </div>
        </div>

        {view === 'week' ? (
          <div className="tp-week-grid" aria-label="Calendar week">
            <div className="tp-calendar-time-axis" aria-label="Time slots from 7 AM to 10 PM">
              <span className="tp-calendar-time-axis-spacer" aria-hidden="true" />
              {Array.from({ length: 16 }, (_, index) => {
                const hour = index + 7
                return <span key={hour}>{hour % 12 || 12} {hour < 12 ? 'AM' : 'PM'}</span>
              })}
            </div>
            {days.map((date) => (
              <CalendarDayColumn
                key={date}
                date={date}
                today={today}
                items={visibleWeekItems.filter((item) => item.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime))}
                onSelect={() => { setSelectedDate(date); setView('day') }}
                onEvent={setSelectedEvent}
                onAdd={openAdd}
              />
            ))}
          </div>
        ) : (
          <div className="tp-day-view">
            <div className="tp-day-switcher">
              <Button type="button" variant="outline" size="icon-sm" aria-label="Previous day" onClick={() => { const next = addDays(selectedDate, -1); setSelectedDate(next); setAnchorDate(next) }}><ArrowLeft data-icon="inline-start" /></Button>
              <div><span>{new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(`${selectedDate}T12:00:00`))}</span><strong>{formatCalendarDate(selectedDate, { month: 'long', day: 'numeric', year: 'numeric' })}</strong></div>
              <Button type="button" variant="outline" size="icon-sm" aria-label="Next day" onClick={() => { const next = addDays(selectedDate, 1); setSelectedDate(next); setAnchorDate(next) }}><ArrowRight data-icon="inline-start" /></Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setView('week')}>Back to week</Button>
            </div>
            <DayAgenda date={selectedDate} items={dayItems} onEvent={setSelectedEvent} onAdd={openAdd} />
          </div>
        )}
        <div className="tp-calendar-legend"><span><i data-kind="task" />Task</span><span><i data-kind="commitment" />Commitment</span><span><i data-kind="break" />Reset</span><span className="tp-calendar-legend-note">{visibleWeekItems.length} blocks this week</span></div>
      </Card>

      <div className="tp-calendar-bottom"><span><Sparkles aria-hidden="true" />TaskPilot plans around your commitments, energy and focus rhythm.</span><span>All times use {data.profile.timezone}.</span></div>

      <AddEventModal open={addOpen} onClose={() => setAddOpen(false)} initialDate={addDate} onSave={(event) => addSchedule(event)} />
      <ScheduleDetailModal item={selectedEvent} task={selectedTask} onClose={() => setSelectedEvent(null)} onComplete={handleEventComplete} onMissed={handleMissed} onEdit={handleEdit} onDelete={() => { if (selectedEvent) deleteSchedule(selectedEvent.id); setSelectedEvent(null) }} />
      <EditEventModal item={editEvent} onClose={() => setEditEvent(null)} onSave={(changes) => { if (editEvent) updateSchedule(editEvent.id, changes); toast('Calendar block moved.') }} />
      <MissedRecoveryModal open={Boolean(missedEvent)} item={missedEvent} onClose={() => setMissedEvent(null)} onRecover={handleRecover} />
    </div>
  )
}

export default CalendarPage
