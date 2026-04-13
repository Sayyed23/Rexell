import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';
import { BehavioralDataRepository } from '../data-layer/repositories/behavioral-data.repository';
import { RiskScoreRepository } from '../data-layer/repositories/risk-score.repository';
import { BehavioralData, RiskScore } from '../data-layer/interfaces';

export interface DetectionRequest {
  walletAddress: string;
  sessionId: string;
  events: BehavioralData[];
}

export interface DetectionResponse {
  score: number;
  decision: 'ALLOW' | 'CHALLENGE' | 'DENY';
  reason: string[];
}

/**
 * Service for orchestrating bot detection logic.
 * 
 * Requirements: 11.2 - SageMaker integration and risk assessment
 */
export class DetectionService {
  private readonly sagemaker: SageMakerRuntimeClient;
  private readonly behavioralRepo: BehavioralDataRepository;
  private readonly riskRepo: RiskScoreRepository;
  private readonly endpointName: string;

  constructor(
    behavioralRepo: BehavioralDataRepository,
    riskRepo: RiskScoreRepository,
    endpointName: string
  ) {
    this.sagemaker = new SageMakerRuntimeClient({});
    this.behavioralRepo = behavioralRepo;
    this.riskRepo = riskRepo;
    this.endpointName = endpointName;
  }

  /**
   * Process a detection request.
   */
  async detect(request: DetectionRequest): Promise<DetectionResponse> {
    // 1. Persist behavioral data
    await Promise.all(
      request.events.map(event => this.behavioralRepo.saveEvent({
        ...event,
        walletAddress: request.walletAddress,
        sessionId: request.sessionId,
      }))
    );

    // 2. Invoke SageMaker for real-time inference
    const inputPayload = JSON.stringify({
      walletAddress: request.walletAddress,
      events: request.events,
    });

    try {
      const command = new InvokeEndpointCommand({
        EndpointName: this.endpointName,
        ContentType: 'application/json',
        Body: Buffer.from(inputPayload),
      });

      const response = await this.sagemaker.send(command);
      const output = JSON.parse(new TextDecoder().decode(response.Body));

      const score = output.risk_score;
      const decision = this.resolveDecision(score);
      const reason = output.reason || [];

      // 3. Persist risk score
      await this.riskRepo.saveRiskScore({
        walletAddress: request.walletAddress,
        timestamp: Math.floor(Date.now() / 1000),
        score,
        decision,
        reason,
        eventId: request.events[0]?.timestamp.toString() || 'unknown',
      });

      return { score, decision, reason };
    } catch (error) {
      console.error('SageMaker invocation failed:', error);
      // Fallback: Default to ALLOW but log warning (Fail-open for UX, or Fail-closed for security?)
      // Design doc says "Graceful degradation", usually means fail-open or cached score
      return { score: 0.5, decision: 'ALLOW', reason: ['SYSTEM_ERROR_FALLBACK'] };
    }
  }

  private resolveDecision(score: number): 'ALLOW' | 'CHALLENGE' | 'DENY' {
    if (score >= 0.8) return 'DENY';
    if (score >= 0.4) return 'CHALLENGE';
    return 'ALLOW';
  }
}
