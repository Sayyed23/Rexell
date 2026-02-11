
export interface BotScore {
    score: number; // 0 to 1
    riskType: 'bot_buying' | 'none';
    factors: {
        timeDelta: number;
        purchaseFreq: number;
    };
}

export class BotDetector {
    // Simulating a trained Logistic Regression model
    // w1 = -0.8 (Time Delta), w2 = 0.9 (Freq), b = -0.5

    public analyze(history: any[], currentTimestamp: number): BotScore {
        // 1. Feature Extraction
        const recentPurchases = history.filter(h => currentTimestamp - h.timestamp < 10000); // last 10s

        const lastPurchaseTime = history.length > 0
            ? history[history.length - 1].timestamp
            : currentTimestamp - 3600000; // default 1h ago

        const timeDelta = (currentTimestamp - lastPurchaseTime) / 1000; // seconds
        const freq = recentPurchases.length;

        // 2. Normalization (matching "training" scale)
        const normTime = Math.min(timeDelta, 60) / 60.0; // 0-1 (1 = 60s+)
        const normFreq = Math.min(freq, 5) / 5.0;        // 0-1 (1 = 5+ buys)

        // 3. Inference (Logic-based LR)
        // We want LOW time and HIGH freq to be high risk.
        // Score = Sigmoid( -0.8 * normTime + 2.0 * normFreq - 0.5 )
        // If fast buy (normTime=0) and high freq (normFreq=1) -> Sigmoid(1.5) ~= 0.81 (High Risk)
        // If slow buy (normTime=1) and low freq (normFreq=0) -> Sigmoid(-1.3) ~= 0.21 (Low Risk)

        const logit = -1.5 * normTime + 3.0 * normFreq - 0.5;
        const score = 1 / (1 + Math.exp(-logit));

        return {
            score,
            riskType: score > 0.6 ? 'bot_buying' : 'none',
            factors: {
                timeDelta,
                purchaseFreq: freq
            }
        };
    }
}
