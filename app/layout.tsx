import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/taskpilot/app-shell'
import { TaskPilotProvider } from '@/components/taskpilot/taskpilot-provider'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'TaskPilot AI — Your day, in hand',
    template: '%s | TaskPilot AI',
  },
  description: 'A thoughtful local-first planner for tasks, focus time, and the days in between.',
  applicationName: 'TaskPilot AI',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
  colorScheme: 'light dark',
  themeColor: '#f5f5ef',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="antialiased">
        <TaskPilotProvider>
          <AppShell>{children}</AppShell>
        </TaskPilotProvider>
      </body>
    </html>
  )
}
