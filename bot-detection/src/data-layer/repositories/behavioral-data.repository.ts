import { BaseRepository } from './base.repository';
import { BehavioralData } from '../interfaces';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Repository for storing and retrieving behavioral data.
 * PK: USER#{hashedWalletAddress}
 * SK: SESSION#{timestamp}#{sessionId}
 */
export class BehavioralDataRepository extends BaseRepository<BehavioralData> {
  /**
   * Save a single behavioral event.
   * Calculates the TTL (90 days) before saving.
   */
  async saveEvent(data: Omit<BehavioralData, 'PK' | 'SK' | 'ttl'>): Promise<void> {
    const days90InSeconds = 90 * 24 * 60 * 60;
    const ttl = Math.floor(Date.now() / 1000) + days90InSeconds;

    const item: BehavioralData = {
      ...data,
      PK: `USER#${data.walletAddress}`,
      SK: `SESSION#${data.timestamp}#${data.sessionId}`,
      ttl,
    };

    await this.put(item);
  }

  /**
   * Retrieve all events for a specific user.
   */
  async getEventsByUser(walletAddress: string): Promise<BehavioralData[]> {
    return this.queryByPk(`USER#${walletAddress}`);
  }

  /**
   * Retrieve events for a specific session using GSI1.
   */
  async getEventsBySession(sessionId: string): Promise<BehavioralData[]> {
    const response = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'sessionId = :sid',
      ExpressionAttributeValues: { ':sid': sessionId },
    }));
    return (response.Items || []) as BehavioralData[];
  }
}
