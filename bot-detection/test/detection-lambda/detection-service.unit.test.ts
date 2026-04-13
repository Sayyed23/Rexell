import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { DetectionService } from '../../src/detection-lambda/detection.service';
import { BehavioralDataRepository } from '../../src/data-layer/repositories/behavioral-data.repository';
import { RiskScoreRepository } from '../../src/data-layer/repositories/risk-score.repository';

// Mocking dependencies
const mockBehavioralRepo = {
  saveEvent: jest.fn().mockResolvedValue(undefined),
} as unknown as BehavioralDataRepository;

const mockRiskRepo = {
  saveRiskScore: jest.fn().mockResolvedValue(undefined),
} as unknown as RiskScoreRepository;

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-sagemaker-runtime', () => ({
  SageMakerRuntimeClient: jest.fn(() => ({
    send: mockSend,
  })),
  InvokeEndpointCommand: jest.fn((args) => args),
}));

describe('DetectionService', () => {
  const service = new DetectionService(mockBehavioralRepo, mockRiskRepo, 'test-endpoint');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return DENY for high risk score', async () => {
    // Mock SageMaker response body
    const mockOutput = { risk_score: 0.9, reason: ['BOT_DETECTION_CONFIRMED'] };
    mockSend.mockResolvedValueOnce({
      Body: new TextEncoder().encode(JSON.stringify(mockOutput)),
    });

    const request = {
      walletAddress: '0x123',
      sessionId: 'sess-abc',
      events: [{ timestamp: 123456789, eventType: 'click', eventData: {}, clientMetadata: {} } as any],
    };

    const result = await service.detect(request);

    expect(result.decision).toBe('DENY');
    expect(result.score).toBe(0.9);
    expect(mockBehavioralRepo.saveEvent).toHaveBeenCalled();
    expect(mockRiskRepo.saveRiskScore).toHaveBeenCalled();
  });

  it('should return CHALLENGE for medium risk score', async () => {
    const mockOutput = { risk_score: 0.5 };
    mockSend.mockResolvedValueOnce({
      Body: new TextEncoder().encode(JSON.stringify(mockOutput)),
    });

    const result = await service.detect({
      walletAddress: '0x123',
      sessionId: 'sess-abc',
      events: [],
    });

    expect(result.decision).toBe('CHALLENGE');
  });

  it('should fallback to ALLOW on SageMaker error', async () => {
    mockSend.mockRejectedValueOnce(new Error('SageMaker Down'));

    const result = await service.detect({
      walletAddress: '0x123',
      sessionId: 'sess-abc',
      events: [],
    });

    expect(result.decision).toBe('ALLOW');
    expect(result.reason).toContain('SYSTEM_ERROR_FALLBACK');
  });
});
