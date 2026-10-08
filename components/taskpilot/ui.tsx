'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <header className="tp-page-header">
      <div>
        {eyebrow && <p className="tp-eyebrow">{eyebrow}</p>}
        <h1 className="tp-page-title">{title}</h1>
        {description && <p className="tp-page-description">{description}</p>}
      </div>
      {action && <div className="tp-page-actions">{action}</div>}
    </header>
  )
}

export function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="tp-section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="tp-section-action">{action}</div>}
    </div>
  )
}

export function Card({ className = '', children, as = 'section', ...props }: {
  className?: string
  children: ReactNode
  as?: 'section' | 'div' | 'article'
} & React.HTMLAttributes<HTMLElement>) {
  const Element = as
  return <Element className={`tp-card ${className}`.trim()} {...props}>{children}</Element>
}

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className="tp-badge" data-tone={tone}>{children}</span>
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="tp-field">
      <label className="tp-label" htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="tp-field-hint">{hint}</p>}
    </div>
  )
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  hideClose?: boolean
}

export function Modal({ open, onClose, title, description, children, size = 'md', hideClose = false }: ModalProps) {
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="tp-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section
        aria-modal="true"
        aria-labelledby="tp-modal-title"
        aria-describedby={description ? 'tp-modal-description' : undefined}
        className="tp-modal"
        data-size={size}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="tp-modal-heading">
          <div>
            <h2 id="tp-modal-title">{title}</h2>
            {description && <p id="tp-modal-description">{description}</p>}
          </div>
          {!hideClose && (
            <Button type="button" variant="ghost" size="icon" aria-label="Close dialog" onClick={onClose}>
              <X data-icon="inline-start" />
            </Button>
          )}
        </div>
        {children}
      </section>
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="tp-empty-state">
      <div className="tp-empty-mark" aria-hidden="true"><span>✦</span></div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="tp-empty-action">{action}</div>}
    </div>
  )
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, value))
  return (
    <div className="tp-progress-wrap" aria-label={label}>
      <div className="tp-progress-track" role="progressbar" aria-valuenow={safeValue} aria-valuemin={0} aria-valuemax={100}>
        <span className="tp-progress-fill" style={{ width: `${safeValue}%` }} />
      </div>
      {label && <span className="tp-progress-label">{label}</span>}
    </div>
  )
}

export function GhostButton({ children, className = '', ...props }: React.ComponentProps<typeof Button>) {
  return <Button variant="ghost" className={className} {...props}>{children}</Button>
}
