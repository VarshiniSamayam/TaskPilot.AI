'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Brain,
  CalendarDays,
  CheckCheck,
  Clock3,
  Flame,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, PageHeader, SectionHeading, StatusBadge } from '@/components/taskpilot/ui'
import { useTaskPilot } from '@/components/taskpilot/taskpilot-provider'
import { addDays, formatCalendarDate, formatDuration, getDateInTimezone } from '@/lib/taskpilot/seed'
import type { TimePeriod } from '@/lib/taskpilot/types'

function getDayLabel(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'short' }) {
  return formatCalendarDate(date, options)
}

function StatCard({ label, value, note, icon: Icon, tone }: { label: string; value: string; note: string; icon: LucideIcon; tone: string }) {
  return (
    <Card className="tp-insight-stat-card">
      <span className={`tp-stat-icon ${tone}`}><Icon aria-hidden="true" /></span>
      <div className="tp-insight-stat-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
    </Card>
  )
}

function WeeklyFocusChart({ dates, minutes }: { dates: string[]; minutes: number[] }) {
  const peak = Math.max(30, ...minutes)
  return (
    <div className="tp-weekly-chart" role="img" aria-label={`Focus minutes over the last seven days: ${dates.map((date, index) => `${getDayLabel(date)} ${minutes[index]} minutes`).join(', ')}`}>
      {dates.map((date, index) => (
        <div className="tp-weekly-chart-column" key={date}>
          <div className="tp-weekly-chart-bar-track"><span className="tp-weekly-chart-bar" style={{ height: `${Math.max(4, Math.round((minutes[index] / peak) * 100))}%` }} /></div>
          <strong>{minutes[index] ? formatDuration(minutes[index]) : '—'}</strong>
          <span>{getDayLabel(date)}</span>
        </div>
      ))}
    </div>
  )
}

function CompletionChart({ dates, counts }: { dates: string[]; counts: number[] }) {
  const peak = Math.max(1, ...counts)
  return (
    <div className="tp-completion-chart" role="img" aria-label={`Tasks completed each day: ${dates.map((date, index) => `${getDayLabel(date)} ${counts[index]}`).join(', ')}`}>
      {dates.map((date, index) => (
        <div className="tp-completion-column" key={date}>
          <span className="tp-completion-count">{counts[index] || ''}</span>
          <div className="tp-completion-bar-track"><span className="tp-completion-bar" style={{ height: `${Math.max(counts[index] > 0 ? 14 : 4, (counts[index] / peak) * 100)}%` }} /></div>
          <span className="tp-completion-day">{getDayLabel(date)}</span>
        </div>
      ))}
    </div>
  )
}

const PERIOD_LABEL: Record<TimePeriod, string> = { morning: 'morning', afternoon: 'afternoon', evening: 'evening' }

export function InsightsPage() {
  const { data, ready } = useTaskPilot()
  const today = getDateInTimezone(new Date(), data.profile.timezone)
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(today, index - 6)), [today])
  const startDate = dates[0]

  const metrics = useMemo(() => {
    const completedTasks = data.tasks.filter((task) => task.status === 'completed')
    const activeTasks = data.tasks.filter((task) => task.status !== 'completed')
    const focusByDate = dates.map((date) => data.focusSessions.filter((session) => session.date === date).reduce((total, session) => total + session.minutes, 0))
    const completedByDate = dates.map((date) => completedTasks.filter((task) => task.completedAt && getDateInTimezone(new Date(task.completedAt), data.profile.timezone) === date).length)
    const plannedEvents = data.schedule.filter((item) => item.kind === 'task' && item.date >= startDate && item.date <= today)
    const finishedBlocks = plannedEvents.filter((item) => item.completed || item.taskId && completedTasks.some((task) => task.id === item.taskId)).length
    const followThrough = plannedEvents.length === 0 ? 0 : Math.round((finishedBlocks / plannedEvents.length) * 100)
    const minutes = data.focusSessions.reduce((total, session) => total + session.minutes, 0)
    const recentMinutes = focusByDate.reduce((total, amount) => total + amount, 0)
    const taskCategories = [...new Set(data.tasks.map((task) => task.category))].map((category) => ({
      category,
      count: data.tasks.filter((task) => task.category === category).length,
      complete: data.tasks.filter((task) => task.category === category && task.status === 'completed').length,
    })).sort((first, second) => second.count - first.count)
    const activityDates = new Set([
      ...data.focusSessions.map((session) => session.date),
      ...completedTasks.flatMap((task) => task.completedAt ? [getDateInTimezone(new Date(task.completedAt), data.profile.timezone)] : []),
    ])
    let streak = 0
    let streakDay = activityDates.has(today) ? today : addDays(today, -1)
    if (activityDates.has(streakDay)) {
      while (activityDates.has(streakDay)) {
        streak += 1
        streakDay = addDays(streakDay, -1)
      }
    }
    const peakIndex = completedByDate.indexOf(Math.max(0, ...completedByDate))
    const bestDay = Math.max(0, ...completedByDate) > 0 ? dates[peakIndex] : null
    return { completedTasks, activeTasks, focusByDate, completedByDate, followThrough, minutes, recentMinutes, taskCategories, streak, bestDay }
  }, [data.focusSessions, data.schedule, data.tasks, data.profile.timezone, dates, startDate, today])

  if (!ready) return <div className="tp-page"><div className="tp-skeleton-header" /><div className="tp-skeleton-lower" /></div>

  const completionNote = metrics.bestDay
    ? `Your strongest day this week was ${getDayLabel(metrics.bestDay, { weekday: 'long' })}.`
    : 'Finish one small task to start a new trend.'
  const hasActivity = metrics.completedTasks.length > 0 || data.focusSessions.length > 0

  return (
    <div className="tp-page tp-insights-page">
      <PageHeader
        eyebrow="SMALL WINS, MADE VISIBLE"
        title="Your week, in perspective."
        description="Notice what is working, then use it to make the next week feel a little lighter."
        action={<StatusBadge tone="quiet"><CalendarDays aria-hidden="true" /> LAST 7 DAYS</StatusBadge>}
      />

      <section className="tp-insights-stats" aria-label="Productivity summary">
        <StatCard label="Tasks completed" value={`${metrics.completedTasks.length}`} note={completionNote} icon={CheckCheck} tone="tp-stat-green" />
        <StatCard label="Focus time logged" value={formatDuration(metrics.recentMinutes)} note={`${formatDuration(metrics.minutes)} all-time`} icon={Clock3} tone="tp-stat-lilac" />
        <StatCard label="Plan follow-through" value={`${metrics.followThrough}%`} note="Scheduled task blocks completed" icon={Target} tone="tp-stat-peach" />
        <StatCard label="Current streak" value={`${metrics.streak} ${metrics.streak === 1 ? 'day' : 'days'}`} note="Based on focus or completed tasks" icon={Flame} tone="tp-stat-gold" />
      </section>

      <div className="tp-insights-grid">
        <Card className="tp-chart-card tp-focus-chart-card">
          <SectionHeading title="Focus rhythm" description="Minutes you set aside for focused work." action={<span className="tp-chart-total"><Clock3 aria-hidden="true" />{formatDuration(metrics.recentMinutes)}</span>} />
          {data.focusSessions.length === 0 ? <EmptyState title="Your first focus block is waiting" description="Log a session from the dashboard and your weekly pattern will start to take shape." /> : <WeeklyFocusChart dates={dates} minutes={metrics.focusByDate} />}
          <div className="tp-chart-footnote"><span className="tp-chart-key tp-chart-key-green" />Focus minutes · past seven days</div>
        </Card>

        <Card className="tp-chart-card tp-task-chart-card">
          <SectionHeading title="Tasks finished" description="A steady rhythm beats a perfect week." action={<span className="tp-chart-total"><CheckCheck aria-hidden="true" />{metrics.completedTasks.length}</span>} />
          {hasActivity ? <CompletionChart dates={dates} counts={metrics.completedByDate} /> : <EmptyState title="Your progress starts here" description="Complete one task to see your week take shape." />}
          <div className="tp-chart-footnote"><span className="tp-chart-key tp-chart-key-sage" />Completed tasks · past seven days</div>
        </Card>

        <Card className="tp-category-card">
          <SectionHeading title="Where your effort goes" description="Tasks by category, with completed work highlighted." />
          {metrics.taskCategories.length === 0 ? <EmptyState title="No categories yet" description="Add a task and your category mix will appear here." /> : <div className="tp-category-chart" role="img" aria-label="Task distribution by category">
            {metrics.taskCategories.map(({ category, count, complete }) => <div className="tp-category-row" key={category}>
              <div className="tp-category-label"><span>{category}</span><small>{complete}/{count} done</small></div>
              <div className="tp-category-track"><span className="tp-category-total" style={{ width: `${(count / Math.max(1, data.tasks.length)) * 100}%` }} /><span className="tp-category-complete" style={{ width: `${(complete / Math.max(1, data.tasks.length)) * 100}%` }} /></div>
            </div>)}
          </div>}
        </Card>

        <Card className="tp-insight-notes-card">
          <SectionHeading title="A few things to notice" description="Gentle patterns from your own workspace." />
          <div className="tp-insight-note"><span className="tp-insight-note-icon"><Brain aria-hidden="true" /></span><div><strong>Your energy window is {PERIOD_LABEL[data.routine.energyPeriod]}.</strong><p>Keep your most demanding work close to this time when you shape a new plan.</p></div></div>
          <div className="tp-insight-note"><span className="tp-insight-note-icon tp-note-icon-sage"><TrendingUp aria-hidden="true" /></span><div><strong>{metrics.followThrough > 0 ? `You followed through on ${metrics.followThrough}% of planned blocks.` : 'Try planning one focus block at a time.'}</strong><p>{metrics.followThrough > 70 ? 'You are making room for what matters. Keep that breathing space.' : 'A smaller plan can be easier to return to when the day changes.'}</p></div></div>
          <div className="tp-insight-note"><span className="tp-insight-note-icon tp-note-icon-peach"><Sparkles aria-hidden="true" /></span><div><strong>{metrics.activeTasks.length > 0 ? `${metrics.activeTasks.length} open ${metrics.activeTasks.length === 1 ? 'task' : 'tasks'} are ready for your next step.` : 'Your task list is clear.'}</strong><p>{metrics.activeTasks.length > 0 ? 'Pick one, make it smaller, and give it a time that suits your energy.' : 'Use the extra space to reset or plan ahead.'}</p></div></div>
          <div className="tp-insight-actions"><Button variant="outline" size="sm" onClick={() => window.print()}>Print this view <ArrowUpRight data-icon="inline-end" /></Button><Link href="/tasks" className="tp-inline-link">Review tasks <ArrowUpRight aria-hidden="true" /></Link></div>
        </Card>
      </div>

      <Card className="tp-insights-encouragement">
        <span className="tp-encouragement-mark"><Sparkles aria-hidden="true" /></span>
        <div><strong>Progress is allowed to be uneven.</strong><p>There is no score to chase. These patterns are here to help you plan with more kindness, not more pressure.</p></div>
        <div className="tp-encouragement-arrows" aria-hidden="true"><ArrowUpRight /><ArrowDownRight /></div>
      </Card>
    </div>
  )
}

export default InsightsPage
