'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Check,
  ChevronRight,
  Database,
  Download,
  ExternalLink,
  KeyRound,
  LogOut,
  Moon,
  Paintbrush2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  UserCheck,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, Field, PageHeader, SectionHeading, StatusBadge } from '@/components/taskpilot/ui'
import { ConfirmModal, ReminderModal } from '@/components/taskpilot/task-dialogs'
import { useTaskPilot } from '@/components/taskpilot/taskpilot-provider'
import { getDateInTimezone } from '@/lib/taskpilot/seed'
import type { Profile, ThemePreference } from '@/lib/taskpilot/types'

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India Standard Time · Kolkata (IST)' },
  { value: 'America/New_York', label: 'Eastern Time · New York (ET)' },
  { value: 'America/Chicago', label: 'Central Time · Chicago (CT)' },
  { value: 'America/Denver', label: 'Mountain Time · Denver (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time · Los Angeles (PT)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time · London (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time · Paris (CET)' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time · Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore Time · Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time · Tokyo (JST)' },
  { value: 'UTC', label: 'Coordinated Universal Time · UTC' },
]

const THEMES: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Paintbrush2 },
]

function SettingsRow({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children: ReactNode }) {
  return (
    <div className="tp-settings-row">
      <span className="tp-settings-row-icon"><Icon aria-hidden="true" /></span>
      <div className="tp-settings-row-copy"><strong>{title}</strong><p>{description}</p></div>
      <div className="tp-settings-row-control">{children}</div>
    </div>
  )
}

function formatReminderDate(value: string, timeFormat: Profile['timeFormat'], timezone: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    hour12: timeFormat === '12h', timeZone: timezone,
  }).format(date)
}

export function SettingsPage() {
  const router = useRouter()
  const {
    data,
    ready,
    currentUser,
    saveProfile,
    addReminder,
    deleteReminder,
    clearData,
    signOut,
    toast,
  } = useTaskPilot()

  const [profile, setProfile] = useState<Profile>(data.profile)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)

  useEffect(() => {
    setProfile(data.profile)
  }, [data.profile])

  const updateProfile = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setProfile((current) => ({ ...current, [key]: value }))
  }

  const saveSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    saveProfile(profile)
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const exportWorkspace = () => {
    const file = new Blob([JSON.stringify({ app: 'TaskPilot', exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' })
    const objectUrl = URL.createObjectURL(file)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = `taskpilot-backup-${getDateInTimezone(new Date(), data.profile.timezone)}.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    toast('Your workspace backup is ready to download.', 'info')
  }

  const reminders = [...data.reminders].sort((first, second) => first.dueAt.localeCompare(second.dueAt))

  if (!ready) return <div className="tp-page"><div className="tp-skeleton-header" /><div className="tp-skeleton-lower" /></div>

  return (
    <div className="tp-page tp-settings-page">
      <PageHeader
        eyebrow="YOUR SPACE, YOUR PACE"
        title="Settings & Preferences"
        description="Manage your account, daily routine, notifications, and workspace preferences."
        action={
          <StatusBadge tone="category-college">
            <ShieldCheck aria-hidden="true" />
            ISOLATED WORKSPACE
          </StatusBadge>
        }
      />

      {/* Account & Profile Banner */}
      <Card className="tp-settings-card">
        <SectionHeading
          title="Account Information"
          description="Your personal TaskPilot profile and session."
        />
        <div className="tp-settings-rows">
          <SettingsRow
            icon={UserCheck}
            title={currentUser?.name || profile.name || 'User'}
            description={currentUser?.email || profile.email || 'Local user session active'}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
              onClick={handleSignOut}
            >
              <LogOut data-icon="inline-start" /> Sign out
            </Button>
          </SettingsRow>
        </div>
      </Card>

      {/* AI Assistant Server Configuration */}
      <Card className="tp-settings-card">
        <SectionHeading
          title="AI Assistant Engine"
          description="TaskPilot uses Google Gemini on the server to understand requests and plan your days."
        />
        <div className="tp-settings-rows">
          <SettingsRow
            icon={Sparkles}
            title="Google Gemini AI Integration"
            description="Active & connected server-side via GEMINI_API_KEY. No client API key entry required."
          >
            <StatusBadge tone="status-completed">Connected</StatusBadge>
          </SettingsRow>
        </div>
      </Card>

      {/* Profile & Routine Preferences Form */}
      <form onSubmit={saveSettings}>
        <Card className="tp-settings-card">
          <SectionHeading
            title="Workspace Preferences"
            description="Customize how times, notifications, and themes appear in your planner."
          />
          <div className="tp-form-grid">
            <Field id="profile-name" label="Your name">
              <input
                id="profile-name"
                className="tp-input"
                maxLength={40}
                required
                value={profile.name}
                onChange={(event) => updateProfile('name', event.target.value)}
              />
            </Field>
            <Field id="profile-email" label="Your email" hint="Used for your session">
              <input
                id="profile-email"
                type="email"
                className="tp-input"
                value={profile.email}
                onChange={(event) => updateProfile('email', event.target.value)}
              />
            </Field>
            <Field id="profile-timezone" label="Timezone">
              <select
                id="profile-timezone"
                className="tp-select"
                value={profile.timezone}
                onChange={(event) => updateProfile('timezone', event.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </Field>
            <Field id="profile-timeformat" label="Clock format">
              <select
                id="profile-timeformat"
                className="tp-select"
                value={profile.timeFormat}
                onChange={(event) => updateProfile('timeFormat', event.target.value as '12h' | '24h')}
              >
                <option value="12h">12-hour (9:00 AM)</option>
                <option value="24h">24-hour (09:00)</option>
              </select>
            </Field>
          </div>

          <div className="tp-settings-rows">
            <SettingsRow icon={Bell} title="Reminders banner" description="Show in-app reminders when scheduled tasks arrive.">
              <button
                type="button"
                role="switch"
                aria-checked={profile.notifications}
                aria-label="Reminder notifications"
                className="tp-switch"
                data-checked={profile.notifications}
                onClick={() => updateProfile('notifications', !profile.notifications)}
              >
                <span />
              </button>
            </SettingsRow>
            <SettingsRow icon={Paintbrush2} title="Appearance" description="Choose a theme for your workspace.">
              <div className="tp-theme-options" role="group" aria-label="Appearance">
                {THEMES.map(({ value, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={value}
                    className="tp-theme-option"
                    data-active={profile.theme === value}
                    aria-pressed={profile.theme === value}
                    onClick={() => updateProfile('theme', value)}
                  >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </SettingsRow>
            <SettingsRow icon={UserRound} title="Planning rhythm" description="Shape my day uses your wake, sleep, and focus durations.">
              <Link href="/routine" className="tp-settings-link">Customize routine <ChevronRight aria-hidden="true" /></Link>
            </SettingsRow>
          </div>
          <div className="tp-settings-save">
            <Button type="submit"><Check data-icon="inline-start" />Save preferences</Button>
          </div>
        </Card>
      </form>

      {/* Reminders Card */}
      <Card className="tp-settings-card" id="reminders">
        <SectionHeading
          title="Reminders"
          description="Keep timely nudges close at hand."
          action={<Button type="button" size="sm" onClick={() => setReminderOpen(true)}>Add reminder <Bell data-icon="inline-start" /></Button>}
        />
        {reminders.length === 0 ? (
          <div className="tp-settings-empty">
            <Bell aria-hidden="true" />
            <div>
              <strong>No reminders yet</strong>
              <span>Add a reminder and it will appear here when it is due.</span>
            </div>
          </div>
        ) : (
          <div className="tp-reminders-list">
            {reminders.map((reminder) => {
              const attachedTask = data.tasks.find((task) => task.id === reminder.taskId)
              const isPast = new Date(reminder.dueAt).getTime() <= Date.now()
              return (
                <div className="tp-reminder-row" key={reminder.id}>
                  <span className="tp-reminder-mark" data-delivered={reminder.delivered}><Bell aria-hidden="true" /></span>
                  <div className="tp-reminder-copy">
                    <strong>{reminder.message}</strong>
                    <span>{formatReminderDate(reminder.dueAt, profile.timeFormat, profile.timezone)}{attachedTask ? ` · ${attachedTask.title}` : ''}</span>
                  </div>
                  <StatusBadge tone={reminder.delivered ? 'neutral' : isPast ? 'priority-high' : 'priority-medium'}>
                    {reminder.delivered ? 'Delivered' : isPast ? 'Due' : 'Upcoming'}
                  </StatusBadge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove reminder: ${reminder.message}`}
                    onClick={() => deleteReminder(reminder.id)}
                  >
                    <Trash2 data-icon="inline-start" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Data Management Card */}
      <Card className="tp-settings-card tp-settings-data-card">
        <SectionHeading title="Your Data" description="Export a complete JSON backup of your workspace or reset your data." />
        <div className="tp-settings-rows">
          <SettingsRow icon={Download} title="Export workspace" description="Download a JSON backup of your tasks, schedule, routine, and reminders.">
            <Button type="button" variant="outline" size="sm" onClick={exportWorkspace}>
              Download backup <Download data-icon="inline-end" />
            </Button>
          </SettingsRow>
          <SettingsRow icon={Trash2} title="Clear workspace" description="Remove all tasks, schedule items, reminders, and chat history.">
            <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmClearOpen(true)}>
              Clear workspace <Trash2 data-icon="inline-start" />
            </Button>
          </SettingsRow>
        </div>
      </Card>

      <p className="tp-settings-footer">TaskPilot AI · Intelligent personal planning companion</p>

      <ReminderModal open={reminderOpen} onClose={() => setReminderOpen(false)} onSave={(reminder) => addReminder(reminder)} tasks={data.tasks} />
      <ConfirmModal
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={() => { clearData(); setConfirmClearOpen(false) }}
        title="Clear this workspace?"
        description="All tasks, calendar blocks, reminders, focus sessions, and assistant messages will be cleared. This cannot be undone."
        confirmLabel="Clear workspace"
        destructive
      />
    </div>
  )
}

export default SettingsPage
