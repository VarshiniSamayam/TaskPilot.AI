import { NextResponse } from 'next/server'
import { processWithGemini, type AssistantContext } from '@/lib/taskpilot/gemini'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { prompt, context } = body as { prompt: string; context: AssistantContext }

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Please enter a message.' }, { status: 400 })
    }

    const customKey = request.headers.get('x-gemini-key') || undefined
    const response = await processWithGemini(prompt, context, customKey)

    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    console.error('API assistant error:', error)
    return NextResponse.json(
      { error: 'Failed to process AI assistant request. Please try again.' },
      { status: 500 },
    )
  }
}
