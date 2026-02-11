import { TrustAssessment } from "./risk-agent";

export type EnforcementActionType = 'ALLOW' | 'BLOCK' | 'WARNING' | 'CAPTCHA';

export interface EnforcementDecision {
    action: EnforcementActionType;
    message?: string;
}

export class PolicyEnforcementAgent {
    public decide(assessment: TrustAssessment): EnforcementDecision {
        const { trustScore, dominantRisk, reason } = assessment;

        // Strict Policy Rules

        // 1. Immediate Block
        if (trustScore < 0.3) {
            return {
                action: 'BLOCK',
                message: `Transaction blocked: ${reason}. Trust Score: ${trustScore}`
            };
        }

        // 2. Warning / Friction
        if (trustScore < 0.7) {
            return {
                action: 'WARNING',
                message: `High traffic detected. Please proceed with caution. (${reason})`
            };
        }

        // 3. Allow
        return {
            action: 'ALLOW'
        };
    }
}
