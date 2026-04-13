import * as fc from 'fast-check';
import { describe, it, expect, jest } from '@jest/globals';
import { BehavioralDataRepository } from '../../src/data-layer/repositories/behavioral-data.repository';
import { RiskScoreRepository } from '../../src/data-layer/repositories/risk-score.repository';
import { ChallengeStateRepository } from '../../src/data-layer/repositories/challenge-state.repository';

// Mock the docClient and base methods
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: jest.fn() })) },
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
  QueryCommand: jest.fn(),
}));

describe('TTL Property Tests', () => {
  const mockTable = 'MockTable';

  it('BehavioralData TTL should always be approximately 90 days from now', async () => {
    const repo = new BehavioralDataRepository(mockTable);
    const putSpy = jest.spyOn(repo as any, 'put').mockResolvedValue(undefined);

    await fc.assert(
      fc.asyncProperty(fc.integer(), fc.string(), async (timestamp, sessionId) => {
        const walletAddress = '0x123';
        const now = Math.floor(Date.now() / 1000);
        const expectedMinTtl = now + 90 * 24 * 60 * 60 - 5; // allow 5s leeway
        const expectedMaxTtl = now + 90 * 24 * 60 * 60 + 5;

        await repo.saveEvent({
          walletAddress,
          sessionId,
          timestamp,
          eventType: 'click',
          eventData: {},
          clientMetadata: {},
        });

        const lastCall = putSpy.mock.calls[putSpy.mock.calls.length - 1][0] as any;
        expect(lastCall.ttl).toBeGreaterThanOrEqual(expectedMinTtl);
        expect(lastCall.ttl).toBeLessThanOrEqual(expectedMaxTtl);
      })
    );
  });

  it('RiskScore TTL should always be approximately 365 days from now', async () => {
    const repo = new RiskScoreRepository(mockTable);
    const putSpy = jest.spyOn(repo as any, 'put').mockResolvedValue(undefined);

    await fc.assert(
      fc.asyncProperty(fc.integer(), async (timestamp) => {
        const walletAddress = '0x123';
        const now = Math.floor(Date.now() / 1000);
        const expectedMinTtl = now + 365 * 24 * 60 * 60 - 5;
        const expectedMaxTtl = now + 365 * 24 * 60 * 60 + 5;

        await repo.saveRiskScore({
          walletAddress,
          timestamp,
          score: 0.1,
          decision: 'ALLOW',
          reason: [],
          eventId: 'evt-123',
        });

        const lastCall = putSpy.mock.calls[putSpy.mock.calls.length - 1][0] as any;
        expect(lastCall.ttl).toBeGreaterThanOrEqual(expectedMinTtl);
        expect(lastCall.ttl).toBeLessThanOrEqual(expectedMaxTtl);
      })
    );
  });

  it('ChallengeState TTL should always be approximately 24 hours from now', async () => {
    const repo = new ChallengeStateRepository(mockTable);
    const putSpy = jest.spyOn(repo as any, 'put').mockResolvedValue(undefined);

    await fc.assert(
      fc.asyncProperty(fc.string(), fc.string(), async (challengeId, sessionId) => {
        const now = Math.floor(Date.now() / 1000);
        const expectedMinTtl = now + 24 * 60 * 60 - 5;
        const expectedMaxTtl = now + 24 * 60 * 60 + 5;

        await repo.saveChallenge({
          challengeId,
          sessionId,
          type: 'pow',
          payload: {},
          status: 'PENDING',
          createdAt: Date.now(),
        });

        const lastCall = putSpy.mock.calls[putSpy.mock.calls.length - 1][0] as any;
        expect(lastCall.ttl).toBeGreaterThanOrEqual(expectedMinTtl);
        expect(lastCall.ttl).toBeLessThanOrEqual(expectedMaxTtl);
      })
    );
  });
});
