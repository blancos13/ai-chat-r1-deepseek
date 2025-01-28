import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  timeout: 60000, // 60 second timeout
});

export const runtime = 'edge';

export async function POST(req: Request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const { messages, model } = await req.json();

    const stream = new ReadableStream({
      async start(streamController) {
        try {
          const completion = await groq.chat.completions.create({
            messages: [
              {
                role: "system",
                content: "You are a helpful assistant. You provide clear and concise answers."
              },
              ...messages
            ],
            model: model || "mixtral-8x7b-32768",
            temperature: 0.7,
            max_tokens: 1000,
            stream: true,
          }, {
            signal: controller.signal
          });

          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              streamController.enqueue(new TextEncoder().encode(content));
            }
          }
        } catch (error: any) {
          console.error("Streaming error:", error);
          if (error?.name === 'AbortError') {
            streamController.error(new Error('Request timeout'));
          } else {
            streamController.error(error);
          }
        } finally {
          clearTimeout(timeoutId);
          streamController.close();
        }
      },
      cancel() {
        clearTimeout(timeoutId);
        controller.abort();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('Error:', error);
    
    if (error?.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 