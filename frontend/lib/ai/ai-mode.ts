import { BotDetector } from "./models/bot-detector";
import { ScalpingDetector } from "./models/scalping-detector";
import { RiskEvaluationAgent } from "./agents/risk-agent";
import { PolicyEnforcementAgent, EnforcementDecision, EnforcementActionType } from "./agents/policy-agent";

// Minimal in-memory storage (simulating backend DB)
interface PurchaseRecord {
    timestamp: number;
    wallet: string;
    eventId: number;
}

const PURCHASE_HISTORY_KEY = "ai_mode_purchase_history";

// Re-export enums for frontend compatibility
export enum EnforcementAction {
    ALLOW = "ALLOW",
    WARNING = "WARNING",
    BLOCK = "BLOCK",
}

export interface RiskAssessment {
    riskLevel: string; // HIGH, MEDIUM, LOW
    detectionType: string;
    confidenceScore: number;
    action: EnforcementAction;
    reason: string;
}

class AIModeService {
    private history: PurchaseRecord[] = [];

    // Phase 1: Detectors
    private botDetector: BotDetector;
    private scalpingDetector: ScalpingDetector;

    // Phase 2: Agents
    private riskAgent: RiskEvaluationAgent;
    private policyAgent: PolicyEnforcementAgent;

    constructor() {
        this.botDetector = new BotDetector();
        this.scalpingDetector = new ScalpingDetector();
        this.riskAgent = new RiskEvaluationAgent();
        this.policyAgent = new PolicyEnforcementAgent();

        if (typeof window !== "undefined") {
            this.loadHistory();
        }
    }

    private loadHistory() {
        try {
            const stored = localStorage.getItem(PURCHASE_HISTORY_KEY);
            if (stored) {
                this.history = JSON.parse(stored);
            }
        } catch (e) {
            console.error("Failed to load purchase history", e);
        }
    }

    private saveHistory() {
        try {
            if (typeof window !== "undefined") {
                localStorage.setItem(PURCHASE_HISTORY_KEY, JSON.stringify(this.history));
            }
        } catch (e) {
            console.error("Failed to save purchase history", e);
        }
    }

    public recordPurchase(wallet: string, eventId: number) {
        this.history.push({
            timestamp: Date.now(),
            wallet,
            eventId,
        });
        this.saveHistory();
    }

    public assessRisk(wallet: string, eventId: number): RiskAssessment {
        const now = Date.now();
        const userHistory = this.history.filter((h) => h.wallet === wallet);

        // 1. Observation (ML Layer)
        const botScore = this.botDetector.analyze(userHistory, now);
        const scalpingScore = this.scalpingDetector.analyze(userHistory, eventId);

        // 2. Decision (Agent Layer)
        const evaluation = this.riskAgent.evaluate(botScore, scalpingScore);
        const decision = this.policyAgent.decide(evaluation);

        // Map internal decision to frontend RiskAssessment interface
        return {
            riskLevel: evaluation.trustScore < 0.5 ? "HIGH" : evaluation.trustScore < 0.8 ? "MEDIUM" : "LOW",
            detectionType: evaluation.dominantRisk.toUpperCase(),
            confidenceScore: 1 - evaluation.trustScore, // risk score is inverse of trust
            action: this.mapAction(decision.action),
            reason: decision.message || evaluation.reason,
        };
    }

    private mapAction(action: EnforcementActionType): EnforcementAction {
        switch (action) {
            case 'BLOCK': return EnforcementAction.BLOCK;
            case 'WARNING': return EnforcementAction.WARNING;
            case 'ALLOW': return EnforcementAction.ALLOW;
            default: return EnforcementAction.ALLOW;
        }
    }
}

export const aiModeService = new AIModeService();
