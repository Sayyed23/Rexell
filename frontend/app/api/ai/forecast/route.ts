import { NextRequest, NextResponse } from 'next/server';

// Server-side proxy to the AI Insights service. Keeps the service API key
// off the client and lets the browser call a same-origin endpoint.
const AI_BASE_URL = process.env.AI_INSIGHTS_BASE_URL || 'http://localhost:8200';
const AI_API_KEY = process.env.AI_INSIGHTS_API_KEY || 'dev-ai-insights-key';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const kind = body?.kind === 'demand' ? 'demand' : 'resale-price';

        const upstream = await fetch(`${AI_BASE_URL}/v1/forecast/${kind}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': AI_API_KEY,
            },
            body: JSON.stringify(body),
            // Forecasts are cheap; never cache.
            cache: 'no-store',
        });

        const data = await upstream.json().catch(() => ({}));
        return NextResponse.json(data, { status: upstream.status });
    } catch (error: any) {
        // Graceful degradation: the resale page still works without a suggestion.
        return NextResponse.json(
            { error: 'AI service unavailable', detail: error?.message || 'unknown' },
            { status: 503 },
        );
    }
}
