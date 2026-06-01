import { NextRequest, NextResponse } from 'next/server';

// Server-side proxy to the AI Insights RAG assistant.
const AI_BASE_URL = process.env.AI_INSIGHTS_BASE_URL || 'http://localhost:8200';
const AI_API_KEY = process.env.AI_INSIGHTS_API_KEY || 'dev-ai-insights-key';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const question = (body?.question || '').toString().slice(0, 1000);

        const upstream = await fetch(`${AI_BASE_URL}/v1/ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': AI_API_KEY,
            },
            body: JSON.stringify({ question }),
            cache: 'no-store',
        });

        const data = await upstream.json().catch(() => ({}));
        return NextResponse.json(data, { status: upstream.status });
    } catch (error: any) {
        return NextResponse.json(
            {
                answer: "The assistant is offline right now. Please try again later.",
                sources: [],
                mode: 'error',
            },
            { status: 503 },
        );
    }
}
