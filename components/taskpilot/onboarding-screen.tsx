'use client'

import { useState, type FormEvent } from 'react'
import {
  Compass,
  Sun,
  Sunset,
  Moon,
  Clock,
  Sparkles,
  ArrowRight,
  Globe,
  Timer,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTaskPilot } from '@/components/taskpilot/taskpilot-provider'
import type { TimePeriod } from '@/lib/taskpilot/types'

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST · UTC+5:30)' },
  { value: 'America/New_York', label: 'America/New_York (ET · UTC-5)' },
  { value: 'America/Chicago', label: 'America/Chicago (CT · UTC-6)' },
  { value: 'America/Denver', label: 'America/Denver (MT · UTC-7)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT · UTC-8)' },
  { value: 'Europe/London', label: 'Europe/London (GMT · UTC+0)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET · UTC+1)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST · UTC+4)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT · UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST · UTC+9)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST · UTC+10)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
]

const FOCUS_DURATIONS = [
  { value: 25, label: '25 min', tag: 'Pomodoro' },
  { value: 45, label: '45 min', tag: 'Balanced' },
  { value: 50, label: '50 min', tag: 'Recommended' },
  { value: 60, label: '60 min', tag: 'Deep focus' },
  { value: 90, label: '90 min', tag: 'Ultradian' },
]

export function OnboardingScreen() {
  const { data, currentUser, completeOnboarding } = useTaskPilot()

  const detectedTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Kolkata'
  const initialTz = TIMEZONES.some((t) => t.value === detectedTz) ? detectedTz : 'Asia/Kolkata'

  const [name, setName] = useState(currentUser?.name || data.profile.name || '')
  const [email, setEmail] = useState(currentUser?.email || data.profile.email || '')
  const [timezone, setTimezone] = useState(data.profile.timezone || initialTz)
  const [wakeTime, setWakeTime] = useState(data.routine.wakeTime || '07:00')
  const [sleepTime, setSleepTime] = useState(data.routine.sleepTime || '23:00')
  const [preferredPeriod, setPreferredPeriod] = useState<TimePeriod>(data.routine.preferredPeriod || 'morning')
  const [focusDuration, setFocusDuration] = useState<number>(data.routine.focusDuration || 50)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      completeOnboarding(
        {
          name: name.trim() || 'User',
          email: email.trim(),
          timezone,
        },
        {
          wakeTime,
          sleepTime,
          preferredPeriod,
          energyPeriod: preferredPeriod,
          focusDuration,
        },
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="tp-onboarding-container">
      <div className="tp-onboarding-card">
        {/* Header */}
        <div className="tp-onboarding-header">
          <div className="tp-onboarding-mark">
            <Sparkles className="w-5 h-5 text-emerald-800 dark:text-emerald-300" aria-hidden="true" />
          </div>
          <h2>Welcome to TaskPilot, {name || 'there'}!</h2>
          <p>
            Let’s personalize your daily rhythm. TaskPilot will schedule your tasks and shape your days around when you wake, sleep, and focus best.
          </p>
        </div>

        <form className="tp-onboarding-form" onSubmit={handleSubmit}>
          {/* Identity & Location */}
          <div className="tp-onboarding-section">
            <span className="tp-onboarding-section-title">1. Your Profile</span>
            <div className="tp-onboarding-grid-2">
              <div className="tp-auth-field">
                <label htmlFor="ob-name" className="tp-auth-label">
                  Your Name
                </label>
                <input
                  id="ob-name"
                  type="text"
                  className="tp-auth-input"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>

              <div className="tp-auth-field">
                <label htmlFor="ob-email" className="tp-auth-label">
                  Email Address
                </label>
                <input
                  id="ob-email"
                  type="email"
                  className="tp-auth-input"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                />
              </div>
            </div>

            <div className="tp-auth-field mt-3">
              <label htmlFor="ob-timezone" className="tp-auth-label flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                Timezone
              </label>
              <select
                id="ob-timezone"
                className="tp-auth-select"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sleep & Wake Times */}
          <div className="tp-onboarding-section">
            <span className="tp-onboarding-section-title">2. Daily Rhythm</span>
            <div className="tp-onboarding-grid-2">
              <div className="tp-auth-field">
                <label htmlFor="ob-wake" className="tp-auth-label flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                  Wake-up Time
                </label>
                <input
                  id="ob-wake"
                  type="time"
                  className="tp-auth-input"
                  required
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                />
              </div>

              <div className="tp-auth-field">
                <label htmlFor="ob-sleep" className="tp-auth-label flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
                  Sleep Time
                </label>
                <input
                  id="ob-sleep"
                  type="time"
                  className="tp-auth-input"
                  required
                  value={sleepTime}
                  onChange={(e) => setSleepTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Preferred Focus Window */}
          <div className="tp-onboarding-section">
            <span className="tp-onboarding-section-title">3. Preferred Focus Period</span>
            <p className="tp-onboarding-hint">When does your brain feel clearest and most energetic?</p>
            <div className="tp-onboarding-periods" role="radiogroup">
              {[
                { id: 'morning', label: 'Morning', sub: 'Early start & fresh mind', icon: Sun },
                { id: 'afternoon', label: 'Afternoon', sub: 'Post-midday stride', icon: Sunset },
                { id: 'evening', label: 'Evening', sub: 'Quiet late focus hours', icon: Moon },
              ].map(({ id, label, sub, icon: Icon }) => {
                const isSelected = preferredPeriod === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`tp-period-card ${isSelected ? 'tp-period-card-selected' : ''}`}
                    onClick={() => setPreferredPeriod(id as TimePeriod)}
                  >
                    <div className="tp-period-icon">
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="tp-period-content">
                      <strong>{label}</strong>
                      <small>{sub}</small>
                    </div>
                    {isSelected && <Check className="tp-period-check w-4 h-4" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Focus Duration */}
          <div className="tp-onboarding-section">
            <span className="tp-onboarding-section-title">4. Focus Session Duration</span>
            <p className="tp-onboarding-hint">Ideal length for one uninterrupted block before taking a reset break.</p>
            <div className="tp-duration-pills">
              {FOCUS_DURATIONS.map((dur) => {
                const isSelected = focusDuration === dur.value
                return (
                  <button
                    key={dur.value}
                    type="button"
                    className={`tp-duration-btn ${isSelected ? 'tp-duration-btn-selected' : ''}`}
                    onClick={() => setFocusDuration(dur.value)}
                  >
                    <strong>{dur.label}</strong>
                    <small>{dur.tag}</small>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="tp-onboarding-submit"
            disabled={submitting}
          >
            <span>Complete setup & enter workspace</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </form>
      </div>
    </div>
  )
}
