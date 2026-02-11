import { BotScore } from "../models/bot-detector";
import { ScalpingScore } from "../models/scalping-detector";

export interface TrustAssessment {
    trustScore: number; // 0 (Risky) to 1 (Trusted)
    dominantRisk: string;
    reason: string;
}

export class RiskEvaluationAgent {
    public evaluate(botScore: BotScore, scalpingScore: ScalpingScore): TrustAssessment {
        // Default trust is high
        let trust = 1.0;
        let risk = "none";
        let reason = "Normal activity";

        // Bot Risk Impact (High Impact)
        if (botScore.score > 0.5) {
            trust -= botScore.score * 0.8; // Bot score reduces trust heavily
            if (trust < 0) trust = 0;
            risk = botScore.riskType;
            reason = `Bot-like purchasing detected (Frequency: ${botScore.factors.purchaseFreq})`;
        }

        // Scalping Risk Impact (Medium Impact)
        if (scalpingScore.score > 0.5) {
            if (trust > 0.4) {
                trust -= scalpingScore.score * 0.5;
            }
            // If we already have bot risk, scalping adds to it
            if (scalpingScore.score > botScore.score) {
                risk = scalpingScore.riskType;
                reason = `Scalping behavior detected (Tickets: ${scalpingScore.factors.eventRepetition})`;
            }
        }

        return {
            trustScore: parseFloat(trust.toFixed(2)),
            dominantRisk: risk,
            reason
        };
    }
}
