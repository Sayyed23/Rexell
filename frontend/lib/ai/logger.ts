
export type AIEventType =
    | 'purchase_attempt'
    | 'purchase_success'
    | 'purchase_failed'
    | 'resale_attempt'
    | 'resale_success'
    | 'page_view';

export interface AIEvent {
    eventType: AIEventType;
    wallet: string;
    eventId?: number | string;
    timestamp: number;
    metadata?: any;
}

class AILogger {
    private async sendLog(event: AIEvent) {
        try {
            await fetch('/api/ai/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event),
            });
        } catch (error) {
            console.error('Failed to send AI log:', error);
        }
    }

    public log(eventType: AIEventType, wallet: string, eventId?: number | string, metadata?: any) {
        // Fire and forget - don't await to avoid blocking UI
        this.sendLog({
            eventType,
            wallet,
            eventId,
            timestamp: Date.now(),
            metadata,
        });
    }
}

export const aiLogger = new AILogger();
