
export type AIEventType =
    | 'purchase_attempt'
    | 'purchase_success'
    | 'purchase_failed'
    | 'resale_attempt'
    | 'resale_success'
    | 'ticket_cancelled'
    | 'page_view';

export interface AIEvent {
    eventType: AIEventType;
    wallet: string;
    eventId?: number | string;
    timestamp: number;
    metadata?: any;
}

class AILogger {
    private saveToLocalStorage(event: AIEvent) {
        try {
            if (typeof window !== "undefined") {
                const key = "ai_decision_logs";
                const stored = localStorage.getItem(key);
                const logs = stored ? JSON.parse(stored) : [];
                logs.push(event);
                
                // Keep last 100 logs to avoid localStorage bloat
                if (logs.length > 100) {
                    logs.shift();
                }
                
                localStorage.setItem(key, JSON.stringify(logs));
            }
        } catch (e) {
            console.error("Failed to write to localStorage audit logs", e);
        }
    }

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
        const event: AIEvent = {
            eventType,
            wallet,
            eventId,
            timestamp: Date.now(),
            metadata,
        };

        // 1. Audit locally (FR-9.3.2)
        this.saveToLocalStorage(event);

        // 2. Transmit to server
        this.sendLog(event);
    }
}

export const aiLogger = new AILogger();

