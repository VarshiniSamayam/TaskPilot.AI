'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  Clock3,
  Compass,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTaskPilot } from '@/components/taskpilot/taskpilot-provider'
import { formatCalendarDate } from '@/lib/taskpilot/seed'
import { AuthScreen } from '@/components/taskpilot/auth-screen'
import { OnboardingScreen } from '@/components/taskpilot/onboarding-screen'

const primaryLinks = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Tasks', href: '/tasks', icon: ListTodo },
  { label: 'Calendar', href: '/calendar', icon: CalendarDays },
  { label: 'AI Assistant', href: '/assistant', icon: Sparkles, ai: true },
  { label: 'Insights', href: '/insights', icon: BarChart3 },
]

const secondaryLinks = [
  { label: 'My Routine', href: '/routine', icon: Clock3 },
  { label: 'Settings', href: '/settings', icon: Settings },
]

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/tasks': 'Tasks',
  '/calendar': 'Calendar',
  '/assistant': 'AI Assistant',
  '/insights': 'Insights',
  '/routine': 'My Routine',
  '/settings': 'Settings',
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data, currentUser, authLoading, signOut } = useTaskPilot()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)

  const handleSignOut = async () => {
    setAccountMenuOpen(false)
    setMenuOpen(false)
    router.push('/')
    await signOut()
  }

  const pendingReminders = data.reminders.filter((reminder) => !reminder.delivered).length
  const today = formatCalendarDate(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: data.profile.timezone || 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
    { weekday: 'short', month: 'short', day: 'numeric' },
  )

  useEffect(() => {
    setMenuOpen(false)
    setAccountMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen && !accountMenuOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setAccountMenuOpen(false)
      }
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    window.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen, accountMenuOpen])

  // 1. Loading state
  if (authLoading) {
    return (
      <div className="tp-auth-loading-screen">
        <div className="tp-auth-loading-card">
          <div className="tp-auth-logo animate-pulse">
            <Compass className="w-8 h-8 text-emerald-800 dark:text-emerald-300" />
          </div>
          <span className="tp-auth-loading-text">Loading TaskPilot workspace…</span>
        </div>
      </div>
    )
  }

  // 2. Unauthenticated user -> Show Authentication screen
  if (!currentUser) {
    return <AuthScreen />
  }

  // 3. New user without completed onboarding -> Show Onboarding screen
  if (!data.onboarding) {
    return <OnboardingScreen />
  }

  const userInitial = (currentUser.name || data.profile.name || 'U').trim().charAt(0).toUpperCase()
  const displayName = currentUser.name || data.profile.name || 'User'
  const displayEmail = currentUser.email || data.profile.email || ''

  const renderNavigation = (links: typeof primaryLinks | typeof secondaryLinks) => (
    <nav className="tp-nav-list" aria-label={links === primaryLinks ? 'Main navigation' : 'Workspace settings'}>
      {links.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className="tp-nav-link"
            data-active={active}
            aria-current={active ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
            {'ai' in item && item.ai && <span className="tp-nav-ai">AI</span>}
            {active && <ChevronRight className="tp-nav-chevron" aria-hidden="true" />}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="tp-app-shell">
      {menuOpen && (
        <button
          className="tp-sidebar-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className="tp-sidebar" data-open={menuOpen} aria-label="TaskPilot workspace">
        <Link href="/" className="tp-brand" aria-label="TaskPilot home" onClick={() => setMenuOpen(false)}>
          <span className="tp-brand-mark"><Compass aria-hidden="true" /></span>
          <span className="tp-brand-copy">
            <span className="tp-brand-name">taskpilot<span>.</span></span>
            <span className="tp-brand-tagline">your day, in hand</span>
          </span>
        </Link>

        <div className="tp-sidebar-label">WORKSPACE</div>
        {renderNavigation(primaryLinks)}
        <div className="tp-sidebar-label tp-sidebar-label-secondary">PERSONAL</div>
        {renderNavigation(secondaryLinks)}

        <div className="tp-sidebar-spacer" />
        <div className="tp-sidebar-tip">
          <span className="tp-tip-spark"><Sparkles aria-hidden="true" /></span>
          <p>Small steps make a thoughtful day.</p>
          <span>TaskPilot note</span>
        </div>

        {/* Sidebar Profile Card with quick sign out */}
        <div className="tp-sidebar-profile-box">
          <Link href="/settings" className="tp-profile-card" onClick={() => setMenuOpen(false)}>
            <span className="tp-avatar" aria-hidden="true">{userInitial}</span>
            <span className="tp-profile-copy">
              <strong>{displayName}</strong>
              <span><i /> On track</span>
            </span>
          </Link>
          <button
            type="button"
            className="tp-sidebar-logout-btn"
            title="Sign Out"
            aria-label="Sign Out"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="tp-main-shell">
        <header className="tp-topbar">
          <div className="tp-topbar-leading">
            <Button
              className="tp-mobile-menu-button"
              type="button"
              variant="ghost"
              size="icon"
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X data-icon="inline-start" /> : <Menu data-icon="inline-start" />}
            </Button>
            <span className="tp-breadcrumb-root">Workspace</span>
            <ChevronRight className="tp-breadcrumb-chevron" aria-hidden="true" />
            <span className="tp-breadcrumb-current">{routeTitles[pathname] ?? 'Workspace'}</span>
          </div>

          <div className="tp-topbar-actions">
            <span className="tp-topbar-date">{today}</span>
            <Link
              className="tp-topbar-icon-link"
              href="/settings#reminders"
              aria-label={`Manage reminders${pendingReminders ? `, ${pendingReminders} upcoming` : ''}`}
            >
              <Bell aria-hidden="true" />
              {pendingReminders > 0 && <span className="tp-notification-dot" aria-hidden="true" />}
            </Link>

            {/* Account Menu Trigger and Dropdown */}
            <div className="tp-account-menu-container" ref={accountMenuRef}>
              <button
                type="button"
                className="tp-topbar-avatar"
                aria-label={`Account menu for ${displayName}`}
                aria-expanded={accountMenuOpen}
                onClick={() => setAccountMenuOpen((prev) => !prev)}
              >
                {userInitial}
              </button>

              {accountMenuOpen && (
                <div className="tp-account-dropdown" role="menu">
                  <div className="tp-account-dropdown-header">
                    <span className="tp-account-dropdown-name">{displayName}</span>
                    <span className="tp-account-dropdown-email">{displayEmail}</span>
                  </div>

                  <div className="tp-account-dropdown-divider" />

                  <Link
                    href="/settings"
                    className="tp-account-dropdown-item"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4" aria-hidden="true" />
                    <span>Profile & Settings</span>
                  </Link>

                  <Link
                    href="/routine"
                    className="tp-account-dropdown-item"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <Clock3 className="w-4 h-4" aria-hidden="true" />
                    <span>My Routine</span>
                  </Link>

                  <div className="tp-account-dropdown-divider" />

                  <button
                    type="button"
                    className="tp-account-dropdown-item tp-account-logout-item"
                    role="menuitem"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="tp-main-content">{children}</main>

        <footer className="tp-footer">
          <span>taskpilot.</span>
          <span>Make space for what matters.</span>
        </footer>
      </div>
    </div>
  )
}
