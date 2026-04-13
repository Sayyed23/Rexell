import { BehavioralDataRepository } from '../data-layer/repositories/behavioral-data.repository';
import { RiskScoreRepository } from '../data-layer/repositories/risk-score.repository';
import { DetectionService, DetectionRequest } from './detection.service';

// Initialize repositories outside the handler for connection reuse
const BEHAVIORAL_TABLE = process.env.BEHAVIORAL_TABLE!;
const RISK_SCORE_TABLE = process.env.RISK_SCORE_TABLE!;
const SAGEMAKER_ENDPOINT = process.env.SAGEMAKER_ENDPOINT!;

const behavioralRepo = new BehavioralDataRepository(BEHAVIORAL_TABLE);
const riskRepo = new RiskScoreRepository(RISK_SCORE_TABLE);
const detectionService = new DetectionService(behavioralRepo, riskRepo, SAGEMAKER_ENDPOINT);

/**
 * Main handler for the Detection Lambda.
 * Exposes the bot detection logic via API Gateway.
 * 
 * Requirements: 11.2 - API Gateway and detection endpoint
 */
export const handler = async (event: any) => {
  console.log('Detection Request Received:', JSON.stringify(event));

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const payload = JSON.parse(event.body);
    const { walletAddress, sessionId, events } = payload;

    if (!walletAddress || !sessionId || !events || !Array.isArray(events)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: walletAddress, sessionId, events' }),
      };
    }

    // signature verification placeholder (Requirement 11.2)
    // const sig = event.headers['x-rexell-signature'];
    // if (!sig || !verifySignature(sig, event.body)) { ... }

    const result = await detectionService.detect({
      walletAddress,
      sessionId,
      events,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Configurable in production
      },
      body: JSON.stringify(result),
    };

  } catch (error: any) {
    console.error('Detection Exception:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal detection error',
        requestId: event.requestContext.requestId,
      }),
    };
  }
};
