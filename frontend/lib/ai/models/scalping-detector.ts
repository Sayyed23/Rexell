
export interface ScalpingScore {
    score: number;
    riskType: 'scalping_behavior' | 'none';
    factors: {
        eventRepetition: number;
        priceMarkup?: number;
    };
}

export class ScalpingDetector {
    public analyze(userHistory: any[], eventId: number): ScalpingScore {
        // 1. Feature: Repetition for same event
        const sameEventPurchases = userHistory.filter(h => h.eventId === eventId).length;

        // 2. Normalization
        // 4+ tickets is high risk
        const normRepetition = Math.min(sameEventPurchases, 5) / 5.0;

        // 3. Inference (Rule-based / Isolation Forest logic)
        // Score increases significantly after 3rd ticket
        let score = 0.1;
        if (sameEventPurchases >= 4) score = 0.9;
        else if (sameEventPurchases === 3) score = 0.6;
        else if (sameEventPurchases < 3) score = 0.2;

        return {
            score,
            riskType: score > 0.7 ? 'scalping_behavior' : 'none',
            factors: {
                eventRepetition: sameEventPurchases
            }
        };
    }
}
