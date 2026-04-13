import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BehavioralDataRepository } from '../../src/data-layer/repositories/behavioral-data.repository';
import { RiskScoreRepository } from '../../src/data-layer/repositories/risk-score.repository';

// Note: Using mocks for the SDK v3 client
const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb') as any;
  return {
    ...actual,
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({
        send: mockSend,
      })),
    },
    PutCommand: jest.fn((args) => args),
    GetCommand: jest.fn((args) => args),
    QueryCommand: jest.fn((args) => args),
  };
});

describe('Repository Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BehavioralDataRepository', () => {
    const repo = new BehavioralDataRepository('TestTable');

    it('should correctly build PK and SK for saving events', async () => {
      (mockSend as any).mockResolvedValueOnce({});
      
      const event = {
        walletAddress: '0xabc',
        sessionId: 'sess-123',
        timestamp: 1600000000,
        eventType: 'click',
        eventData: { x: 10 },
        clientMetadata: { browser: 'chrome' },
      };

      await repo.saveEvent(event);

      expect(mockSend).toHaveBeenCalled();
      const putCall = mockSend.mock.calls[0][0] as any; // DocumentClient sends the command
      // Since we mocked PutCommand to return its args, and repo.put uses new PutCommand
      expect(putCall.Item.PK).toBe('USER#0xabc');
      expect(putCall.Item.SK).toBe('SESSION#1600000000#sess-123');
      expect(putCall.Item.ttl).toBeDefined();
    });

    it('should query events by user wallet address', async () => {
      (mockSend as any).mockResolvedValueOnce({ Items: [{ PK: 'USER#0xabc', SK: 'SESSION#1', walletAddress: '0xabc' }] });
      
      const results = await repo.getEventsByUser('0xabc');
      
      expect(mockSend).toHaveBeenCalled();
      const queryCall = (mockSend.mock.calls[0][0]) as any;
      expect(queryCall.KeyConditionExpression).toBe('PK = :pk');
      expect(queryCall.ExpressionAttributeValues[':pk']).toBe('USER#0xabc');
      expect(results.length).toBe(1);
    });
  });

  describe('RiskScoreRepository', () => {
    const repo = new RiskScoreRepository('RiskTable');

    it('should retrieve latest risk score using reverse scan', async () => {
      (mockSend as any).mockResolvedValueOnce({ 
        Items: [{ PK: 'USER#0x123', SK: 'RISK#999', score: 0.9 }] 
      });

      const result = await repo.getLatestRiskScore('0x123');

      expect(mockSend).toHaveBeenCalled();
      const queryCall = mockSend.mock.calls[0][0] as any;
      expect(queryCall.ScanIndexForward).toBe(false);
      expect(queryCall.Limit).toBe(1);
      expect(result?.score).toBe(0.9);
    });
  });
});
