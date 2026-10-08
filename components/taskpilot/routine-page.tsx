'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlarmClock,
  ArrowRight,
  Check,
  Clock3,
  Coffee,
  Moon,
  RotateCcw,
  Save,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, Field, PageHeader, SectionHeading, StatusBadge } from '@/components/taskpilot/ui'
import { useTaskPilot } from '@/components/taskpilot/taskpilot-provider'
import { DEFAULT_ROUTINE, TIME_PERIODS, type Routine, type TimePeriod } from '@/lib/taskpilot/types'
import { formatTime } from '@/lib/taskpilot/seed'

const periodCopy: Record<TimePeriod, { title: string; description: string; icon: LucideIcon }> = {
  morning: { title: 'Morning', description: 'Fresh energy for the big things.', icon: Sunrise },
  afternoon: { title: 'Afternoon', description: 'A steady pace, after a pause.', icon: Sun },
  evening: { title: 'Evening', description: 'A quieter window to wind down.', icon: Sunset },
}

function RhythmTimeline({ routine }: { routine: Routine }) {
  const periods = [
    { time: routine.wakeTime, title: 'Wake up', icon: Sunrise, note: 'Start gently' },
    { time: routine.energyPeriod === 'morning' ? '09:00' : routine.energyPeriod === 'afternoon' ? '13:00' : '18:00', title: 'Best focus window', icon: Zap, note: `Your ${routine.energyPeriod} energy` },
    { time: routine.preferredPeriod === 'morning' ? '10:00' : routine.preferredPeriod === 'afternoon' ? '14:30' : '19:00', title: 'Favorite focus time', icon: Clock3, note: `${routine.focusDuration} minute sessions` },
    { time: routine.sleepTime, title: 'Wind down', icon: Moon, note: 'Make room to rest' },
  ]
  return (
    <div className="tp-rhythm-timeline">
      {periods.map(({ time, title, icon: Icon, note }, index) => (
        <div className="tp-rhythm-item" key={`${title}-${time}`}>
          <span className="tp-rhythm-time">{formatTime(time)}</span>
          <span className="tp-rhythm-marker"><Icon aria-hidden="true" /></span>
          <div className="tp-rhythm-copy"><strong>{title}</strong><small>{note}</small></div>
          {index < periods.length - 1 && <span className="tp-rhythm-connector" aria-hidden="true" />}
        </div>
      ))}
    </div>
  )
}

export function RoutinePage() {
  const { data, ready, saveRoutine, toast } = useTaskPilot()
  const [routine, setRoutine] = useState<Routine>(data.routine)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (ready) setRoutine(data.routine)
  }, [data.routine, ready])

  const setValue = <K extends keyof Routine>(key: K, value: Routine[K]) => {
    setRoutine((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (routine.sleepTime <= routine.wakeTime) {
      toast('Choose a wind-down time that comes after wake-up.', 'warning')
      return
    }
    saveRoutine(routine)
    setSaved(true)
  }

  const restoreDefaults = () => {
    setRoutine({ ...DEFAULT_ROUTINE })
    saveRoutine({ ...DEFAULT_ROUTINE })
    setSaved(true)
  }

  if (!ready) return <div className="tp-page"><div className="tp-skeleton-header" /><div className="tp-skeleton-lower" /></div>

  return (
    <div className="tp-page tp-routine-page">
      <PageHeader
        eyebrow="YOUR PERSONAL RHYTHM"
        title="Build a routine that fits you."
        description="Small preferences help TaskPilot make plans that feel like yours, not a productivity template."
        action={<StatusBadge tone="quiet"><Sparkles aria-hidden="true" /> Used by Shape my day</StatusBadge>}
      />

      <div className="tp-routine-intro">
        <div className="tp-routine-intro-mark"><AlarmClock aria-hidden="true" /></div>
        <div><span className="tp-eyebrow">THE GOOD-ENOUGH PLAN</span><h2>Your day has a natural rhythm.</h2><p>We&apos;ll protect your focus windows, leave breathing room between blocks, and keep the day within your waking hours.</p></div>
        <div className="tp-routine-intro-badge"><span>ONE SIZE FITS</span><strong>you</strong></div>
      </div>

      <div className="tp-routine-layout">
        <Card className="tp-routine-form-card">
          <div className="tp-card-header-row"><SectionHeading title="Your daily rhythm" description="Adjust any of these whenever life changes." /><span className="tp-routine-status"><i />PERSONALIZED</span></div>
          <form className="tp-form tp-routine-form" onSubmit={handleSubmit}>
            <div className="tp-routine-time-row">
              <Field id="wake-time" label="Wake-up time" hint="When you like your day to begin">
                <div className="tp-input-icon-wrap"><Sunrise aria-hidden="true" /><input id="wake-time" className="tp-input" type="time" required value={routine.wakeTime} onChange={(event) => setValue('wakeTime', event.target.value)} /></div>
              </Field>
              <span className="tp-routine-time-arrow"><ArrowRight aria-hidden="true" /></span>
              <Field id="sleep-time" label="Wind-down time" hint="When you want to wrap up">
                <div className="tp-input-icon-wrap"><Moon aria-hidden="true" /><input id="sleep-time" className="tp-input" type="time" required value={routine.sleepTime} onChange={(event) => setValue('sleepTime', event.target.value)} /></div>
              </Field>
            </div>

            <div className="tp-period-section">
              <div><h3>When is your energy strongest?</h3><p>TaskPilot will try to place deep work in this window.</p></div>
              <div className="tp-period-options" role="radiogroup" aria-label="Strongest energy period">
                {TIME_PERIODS.map((period) => {
                  const { title, description, icon: Icon } = periodCopy[period]
                  return (
                    <button key={period} className="tp-period-option" type="button" role="radio" aria-checked={routine.energyPeriod === period} data-selected={routine.energyPeriod === period} onClick={() => setValue('energyPeriod', period)}>
                      <Icon aria-hidden="true" /><span><strong>{title}</strong><small>{description}</small></span>{routine.energyPeriod === period && <Check className="tp-period-check" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="tp-routine-form-grid">
              <Field id="preferred-period" label="Favorite focus period" hint="When you prefer to work on important tasks">
                <select id="preferred-period" className="tp-select" value={routine.preferredPeriod} onChange={(event) => setValue('preferredPeriod', event.target.value as TimePeriod)}>
                  {TIME_PERIODS.map((period) => <option key={period} value={period}>{periodCopy[period].title}</option>)}
                </select>
              </Field>
              <Field id="focus-duration" label="Focus session" hint="Minutes before a reset">
                <div className="tp-input-suffix"><input id="focus-duration" className="tp-input" type="number" min={15} max={120} step={5} value={routine.focusDuration} onChange={(event) => setValue('focusDuration', Number(event.target.value))} /><span>minutes</span></div>
              </Field>
              <Field id="break-duration" label="Reset break" hint="A little pause between focus blocks">
                <div className="tp-input-suffix"><input id="break-duration" className="tp-input" type="number" min={5} max={45} step={5} value={routine.breakDuration} onChange={(event) => setValue('breakDuration', Number(event.target.value))} /><span>minutes</span></div>
              </Field>
              <Field id="buffer-duration" label="Transition buffer" hint="Time to move between plans">
                <div className="tp-input-suffix"><input id="buffer-duration" className="tp-input" type="number" min={0} max={60} step={5} value={routine.bufferDuration} onChange={(event) => setValue('bufferDuration', Number(event.target.value))} /><span>minutes</span></div>
              </Field>
              <Field id="break-every" label="Take a break after" hint="Focus sessions in a row">
                <div className="tp-input-suffix"><input id="break-every" className="tp-input" type="number" min={1} max={5} step={1} value={routine.breakEvery} onChange={(event) => setValue('breakEvery', Number(event.target.value))} /><span>sessions</span></div>
              </Field>
            </div>

            <div className="tp-routine-form-footer">
              <Button type="submit"><Save data-icon="inline-start" />{saved ? 'Routine saved' : 'Save my rhythm'}</Button>
              <Button type="button" variant="ghost" onClick={restoreDefaults}><RotateCcw data-icon="inline-start" />Restore defaults</Button>
              {saved && <span className="tp-save-confirmation"><Check aria-hidden="true" />Your plan preferences are up to date.</span>}
            </div>
          </form>
        </Card>

        <aside className="tp-routine-side-column">
          <Card className="tp-rhythm-card">
            <div className="tp-rhythm-card-head"><div><span className="tp-eyebrow">A DAY THAT FEELS LIKE YOU</span><h2>Your rhythm</h2></div><span className="tp-icon-tile tp-icon-peach"><Coffee aria-hidden="true" /></span></div>
            <RhythmTimeline routine={routine} />
          </Card>
          <Card className="tp-routine-note-card">
            <span className="tp-note-spark"><Sparkles aria-hidden="true" /></span>
            <h3>Plans are suggestions, not promises.</h3>
            <p>TaskPilot leaves room around your commitments and can always reshape the day when something changes.</p>
            <Link href="/calendar" className="tp-inline-link">See your calendar <ArrowRight aria-hidden="true" /></Link>
          </Card>
          <div className="tp-routine-timezone-note"><Clock3 aria-hidden="true" /><span>Your routine is set to <strong>{data.profile.timezone}</strong>.</span></div>
        </aside>
      </div>
    </div>
  )
}

export default RoutinePage
