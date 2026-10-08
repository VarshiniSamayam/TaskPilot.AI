'use client'

import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Clock3,
  CornerDownLeft,
  ListTodo,
  Plus,
  Send,
  Sparkles,
  Target,
  WandSparkles,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import {
  Bubble,
  BubbleContent,
  BubbleGroup,
} from '@/components/ui/bubble'
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import { Marker, MarkerContent } from '@/components/ui/marker'
import { Card, EmptyState, PageHeader, SectionHeading, StatusBadge } from '@/components/taskpilot/ui'
import { useTaskPilot } from '@/components/taskpilot/taskpilot-provider'
import { assistantWelcome, getTopPriorityTask } from '@/lib/taskpilot/assistant'
import { formatCalendarDate, formatDuration } from '@/lib/taskpilot/seed'
import type { ChatMessage, ScheduleItem, Task } from '@/lib/taskpilot/types'

const QUICK_PROMPTS = [
  { label: 'Shape my day', icon: WandSparkles },
  { label: 'I have a Data Structures exam on Friday covering 5 chapters. I have 2 hours tonight.', icon: CalendarClock },
  { label: 'Add a task to finish my college assignment tomorrow for 45 minutes.', icon: ListTodo },
  { label: 'What should I do first today?', icon: Target },
]

function getMessageTime(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
  } catch {
    return 'Just now'
  }
}

function renderFormattedLine(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold tp-chat-bold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

// Renders markdown-like paragraphs and bullet lists cleanly
function FormattedMessageContent({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/)

  return (
    <div className="tp-formatted-chat-text">
      {paragraphs.map((para, i) => {
        const lines = para.split('\n')
        const isBulletList = lines.every((line) => line.trim().startsWith('- ') || line.trim().startsWith('* ') || /^\d+\.\s/.test(line.trim()))

        if (isBulletList) {
          return (
            <ul key={i} className="tp-chat-bullet-list">
              {lines.map((line, j) => {
                const cleaned = line.replace(/^[-*]\s+|\d+\.\s+/, '')
                return <li key={j}>{renderFormattedLine(cleaned)}</li>
              })}
            </ul>
          )
        }

        return (
          <p key={i} className="tp-chat-paragraph">
            {lines.map((line, lineIdx) => (
              <span key={lineIdx}>
                {renderFormattedLine(line)}
                {lineIdx < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function ChatMessageRow({ message, name, latest }: { message: ChatMessage; name: string; latest: boolean }) {
  const isUser = message.role === 'user'
  const isError = message.content.includes("couldn't reach the AI service")

  return (
    <MessageScrollerItem scrollAnchor={latest} className="tp-chat-message-item">
      <Message align={isUser ? 'end' : 'start'} className={`tp-chat-message-row ${isUser ? 'tp-chat-row-user' : 'tp-chat-row-ai'}`}>
        <MessageAvatar className="tp-chat-avatar" aria-label={isUser ? name : 'TaskPilot assistant'}>
          {isUser ? (
            <span className="tp-chat-user-avatar">{(name || 'U').charAt(0).toUpperCase()}</span>
          ) : (
            <span className="tp-chat-ai-avatar"><Sparkles aria-hidden="true" /></span>
          )}
        </MessageAvatar>
        <MessageContent className="tp-chat-message-content">
          <MessageHeader className="tp-chat-message-header">
            <strong>{isUser ? 'You' : 'TaskPilot AI'}</strong>
            <span>{getMessageTime(message.createdAt)}</span>
          </MessageHeader>
          <BubbleGroup>
            <Bubble
              variant="ghost"
              align={isUser ? 'end' : 'start'}
              className={`tp-chat-bubble-wrap ${isUser ? 'tp-bubble-user' : 'tp-bubble-ai'} ${isError ? 'tp-bubble-error' : ''}`}
            >
              <BubbleContent className="tp-chat-bubble">
                {isError && (
                  <div className="tp-chat-error-notice">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                )}
                <FormattedMessageContent text={message.content} />
              </BubbleContent>
            </Bubble>
          </BubbleGroup>
          <MessageFooter className="tp-chat-message-footer">
            {isUser ? 'Delivered' : isError ? 'Service warning' : 'TaskPilot · Gemini'}
          </MessageFooter>
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  )
}

function AssistantSidebar({ tasks, today }: { tasks: Task[]; today: string }) {
  const nextTask = getTopPriorityTask(tasks, today)
  const upcoming = [...tasks]
    .filter((task) => task.status !== 'completed' && task.deadline >= today)
    .sort((first, second) => first.deadline.localeCompare(second.deadline))
    .slice(0, 4)

  return (
    <aside className="tp-assistant-aside">
      <Card className="tp-assistant-priority-card">
        <div className="tp-assistant-aside-heading">
          <span className="tp-icon-tile tp-icon-leaf"><Target aria-hidden="true" /></span>
          <StatusBadge tone="quiet">RECOMMENDED FOCUS</StatusBadge>
        </div>
        {nextTask ? (
          <>
            <h2>{nextTask.title}</h2>
            <p>{nextTask.description || 'A clear next step to move your goals forward.'}</p>
            <div className="tp-assistant-task-meta">
              <span><Clock3 aria-hidden="true" />{formatDuration(nextTask.duration)}</span>
              <span><CalendarClock aria-hidden="true" />Due {nextTask.deadline === today ? 'today' : formatCalendarDate(nextTask.deadline, { month: 'short', day: 'numeric' })}</span>
            </div>
            <StatusBadge tone={`priority-${nextTask.priority}`}>{nextTask.priority} priority</StatusBadge>
          </>
        ) : (
          <EmptyState title="Clear horizon" description="You have no open tasks right now. Add one or ask TaskPilot to plan your goals." />
        )}
      </Card>

      <Card className="tp-assistant-due-card">
        <SectionHeading title="Upcoming deadlines" description="Keep these milestones in view." />
        {upcoming.length === 0 ? (
          <p className="tp-muted-copy">No tasks due soon. Space is open.</p>
        ) : (
          <ul className="tp-assistant-upcoming-list">
            {upcoming.map((task) => (
              <li key={task.id}>
                <span className="tp-upcoming-date">
                  {task.deadline === today ? 'Today' : formatCalendarDate(task.deadline, { month: 'short', day: 'numeric' })}
                </span>
                <span className="tp-upcoming-title">{task.title}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/tasks" className="tp-inline-link">
          View all tasks <ArrowRight aria-hidden="true" />
        </Link>
      </Card>

      <Card className="tp-assistant-privacy-card">
        <span className="tp-privacy-mark"><Sparkles aria-hidden="true" /></span>
        <strong>Gemini Planning Engine</strong>
        <p>Uses your actual open tasks and routine to create realistic focus blocks without inventing fake data.</p>
      </Card>
    </aside>
  )
}

export function AssistantPage() {
  const { data, ready, requestAiAssistant, recoverMissedSchedule } = useTaskPilot()
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [recoveryEvent, setRecoveryEvent] = useState<ScheduleItem | null>(null)
  const today = data.profile.timezone ? formatCalendarDate(new Date().toISOString().slice(0, 10), { timeZone: 'UTC' }) : new Date().toISOString().slice(0, 10)

  const visibleMessages = useMemo(() => {
    if (data.chat.length > 0) return data.chat
    return [{
      id: 'welcome-chat-message',
      role: 'assistant' as const,
      content: assistantWelcome(data.profile.name || 'there'),
      createdAt: new Date().toISOString(),
    }]
  }, [data.chat, data.profile.name])

  const sendMessage = async (value: string) => {
    const content = value.trim()
    if (!content || typing) return
    setDraft('')
    setTyping(true)

    try {
      await requestAiAssistant(content)
    } finally {
      setTyping(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendMessage(draft)
  }

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return
      event.preventDefault()
      sendMessage(draft)
    }
  }

  const handleRecovery = () => {
    if (!recoveryEvent) return
    recoverMissedSchedule(recoveryEvent.id, 'next')
    setRecoveryEvent(null)
  }

  if (!ready) return <div className="tp-page"><div className="tp-skeleton-header" /><div className="tp-skeleton-lower" /></div>

  return (
    <div className="tp-page tp-assistant-page">
      <PageHeader
        eyebrow="YOUR AI PLANNING PARTNER"
        title="Clarity on demand."
        description="Describe exams, assignments, or study plans in natural language. TaskPilot organizes your time and creates real tasks."
        action={<StatusBadge tone="quiet"><Sparkles aria-hidden="true" /> GEMINI AI</StatusBadge>}
      />

      <div className="tp-assistant-layout">
        <Card className="tp-chat-card">
          <div className="tp-chat-card-header">
            <div className="tp-chat-assistant-id">
              <span className="tp-chat-assistant-mark"><Sparkles aria-hidden="true" /></span>
              <div>
                <strong>TaskPilot Assistant</strong>
                <small>Powered by Google Gemini</small>
              </div>
            </div>
            <div className="tp-chat-header-actions">
              <span className="tp-local-indicator"><span />Connected</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Start a fresh prompt"
                title="Clear draft"
                onClick={() => setDraft('')}
              >
                <Plus data-icon="inline-start" />
              </Button>
            </div>
          </div>

          <div className="tp-chat-transcript" aria-label="Conversation with TaskPilot">
            <MessageScrollerProvider>
              <MessageScroller className="tp-message-scroller">
                <MessageScrollerViewport className="tp-message-viewport">
                  <MessageScrollerContent className="tp-message-content">
                    <Marker variant="separator" className="tp-chat-marker">
                      <MarkerContent>Conversation with TaskPilot AI</MarkerContent>
                    </Marker>
                    <MessageGroup>
                      {visibleMessages.map((message, index) => (
                        <ChatMessageRow
                          key={message.id}
                          message={message}
                          name={data.profile.name}
                          latest={index === visibleMessages.length - 1 && !typing}
                        />
                      ))}
                      {typing && (
                        <MessageScrollerItem scrollAnchor className="tp-chat-message-item">
                          <Message align="start" className="tp-chat-message-row tp-chat-row-ai">
                            <MessageAvatar className="tp-chat-avatar">
                              <span className="tp-chat-ai-avatar"><Sparkles aria-hidden="true" /></span>
                            </MessageAvatar>
                            <MessageContent className="tp-chat-message-content">
                              <MessageHeader className="tp-chat-message-header">
                                <strong>TaskPilot AI</strong>
                                <span>thinking…</span>
                              </MessageHeader>
                              <Bubble variant="ghost" className="tp-chat-bubble-wrap tp-bubble-ai">
                                <BubbleContent className="tp-chat-typing" aria-label="TaskPilot is thinking">
                                  <span className="text-xs text-muted-foreground mr-1">Analyzing with Gemini</span>
                                  <i /><i /><i />
                                </BubbleContent>
                              </Bubble>
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                      )}
                    </MessageGroup>
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton aria-label="Jump to latest message" />
              </MessageScroller>
            </MessageScrollerProvider>
          </div>

          {/* Quick Prompts */}
          {visibleMessages.length <= 2 && !typing && (
            <div className="tp-chat-quick-prompts" aria-label="Try a prompt">
              {QUICK_PROMPTS.map(({ label, icon: Icon }) => (
                <button
                  className="tp-prompt-chip"
                  key={label}
                  type="button"
                  onClick={() => sendMessage(label)}
                >
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}

          {recoveryEvent && (
            <div className="tp-assistant-recovery-prompt">
              <div>
                <strong>Reschedule “{recoveryEvent.title}”?</strong>
                <span>TaskPilot can find the next open focus slot.</span>
              </div>
              <Button type="button" size="sm" onClick={handleRecovery}>
                Move to next slot <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          )}

          {/* Composer */}
          <form className="tp-chat-composer" onSubmit={handleSubmit}>
            <InputGroup className="tp-chat-input-group">
              <InputGroupTextarea
                aria-label="Message TaskPilot"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Ask or plan (e.g. 'I have a Data Structures exam on Friday covering 5 chapters. I can study 2 hours tonight.')…"
                rows={2}
                maxLength={1000}
                disabled={typing}
              />
              <InputGroupAddon align="block-end" className="tp-chat-composer-footer">
                <InputGroupText>
                  <CornerDownLeft aria-hidden="true" /> Press Enter to send · Shift + Enter for new line
                </InputGroupText>
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  variant="default"
                  aria-label="Send message"
                  disabled={!draft.trim() || typing}
                >
                  <Send data-icon="inline-start" />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <p className="tp-chat-disclaimer">
              Natural language task extraction and calendar shaping are saved directly to your workspace.
            </p>
          </form>
        </Card>

        <AssistantSidebar tasks={data.tasks} today={today} />
      </div>
    </div>
  )
}

export default AssistantPage
