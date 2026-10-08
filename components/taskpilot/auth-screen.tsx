'use client'

import { useState, type FormEvent } from 'react'
import {
  Compass,
  Sparkles,
  ArrowRight,
  Lock,
  Mail,
  User,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTaskPilot } from '@/components/taskpilot/taskpilot-provider'

export function AuthScreen() {
  const { signIn, signUp } = useTaskPilot()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please fill in all fields.')
      return
    }

    if (mode === 'signup' && !name.trim()) {
      setErrorMessage('Please enter your full name.')
      return
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signin') {
        const res = await signIn(email.trim(), password)
        if (!res.success) {
          setErrorMessage(res.error || 'Failed to sign in. Please verify your credentials.')
        }
      } else {
        const res = await signUp(email.trim(), password, name.trim())
        if (!res.success) {
          setErrorMessage(res.error || 'Failed to create account. Please try again.')
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="tp-auth-container">
      <div className="tp-auth-card">
        {/* Brand Header */}
        <div className="tp-auth-brand">
          <div className="tp-auth-logo">
            <Compass className="w-6 h-6 text-emerald-800 dark:text-emerald-300" aria-hidden="true" />
          </div>
          <h1 className="tp-auth-title">
            taskpilot<span>.</span>
          </h1>
          <p className="tp-auth-tagline">your day, in hand</p>
        </div>

        {/* Mode Toggle */}
        <div className="tp-auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={`tp-auth-tab ${mode === 'signin' ? 'tp-auth-tab-active' : ''}`}
            onClick={() => {
              setMode('signin')
              setErrorMessage(null)
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`tp-auth-tab ${mode === 'signup' ? 'tp-auth-tab-active' : ''}`}
            onClick={() => {
              setMode('signup')
              setErrorMessage(null)
            }}
          >
            Create Account
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="tp-auth-error" role="alert">
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form className="tp-auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="tp-auth-field">
              <label htmlFor="auth-name" className="tp-auth-label">
                Full Name
              </label>
              <div className="tp-auth-input-wrap">
                <User className="tp-auth-input-icon" aria-hidden="true" />
                <input
                  id="auth-name"
                  type="text"
                  className="tp-auth-input"
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            </div>
          )}

          <div className="tp-auth-field">
            <label htmlFor="auth-email" className="tp-auth-label">
              Email Address
            </label>
            <div className="tp-auth-input-wrap">
              <Mail className="tp-auth-input-icon" aria-hidden="true" />
              <input
                id="auth-email"
                type="email"
                className="tp-auth-input"
                placeholder="alex@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="tp-auth-field">
            <label htmlFor="auth-password" className="tp-auth-label">
              Password
            </label>
            <div className="tp-auth-input-wrap">
              <Lock className="tp-auth-input-icon" aria-hidden="true" />
              <input
                id="auth-password"
                type="password"
                className="tp-auth-input"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="tp-auth-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="tp-auth-spinner" />
                {mode === 'signin' ? 'Signing in…' : 'Setting up workspace…'}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                {mode === 'signin' ? 'Sign in to workspace' : 'Create account & continue'}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </span>
            )}
          </Button>

          {mode === 'signin' && (
            <div className="tp-auth-demo-divider">
              <span>or explore demo</span>
            </div>
          )}

          {mode === 'signin' && (
            <Button
              type="button"
              variant="outline"
              className="tp-auth-demo-button"
              disabled={loading}
              onClick={async () => {
                setLoading(true)
                setErrorMessage(null)
                try {
                  const res = await signIn('demo@taskpilot.io', 'password123')
                  if (!res.success) {
                    setErrorMessage(res.error || 'Failed to enter demo workspace.')
                  }
                } catch (err) {
                  setErrorMessage(err instanceof Error ? err.message : 'Failed to launch demo.')
                } finally {
                  setLoading(false)
                }
              }}
            >
              <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <span>Explore Demo Workspace (1-Click)</span>
            </Button>
          )}
        </form>

        {/* Feature Highlights Footer */}
        <div className="tp-auth-footer">
          <div className="tp-auth-pill">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>Private & isolated workspace</span>
          </div>
          <div className="tp-auth-pill">
            <Sparkles className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>AI day planning</span>
          </div>
        </div>
      </div>
    </div>
  )
}
