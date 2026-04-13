import { BaseRepository } from './base.repository';
import { RiskScore } from '../interfaces';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Repository for risk scores and decisions.
 */
export class RiskScoreRepository extends BaseRepository<RiskScore> {
  async saveRiskScore(data: Omit<RiskScore, 'PK' | 'SK' | 'ttl'>): Promise<void> {
    const days365InSeconds = 365 * 24 * 60 * 60;
    const ttl = Math.floor(Date.now() / 1000) + days365InSeconds;

    const item: RiskScore = {
      ...data,
      PK: `USER#${data.walletAddress}`,
      SK: `RISK#${data.timestamp}`,
      ttl,
    };

    await this.put(item);
  }

  async getLatestRiskScore(walletAddress: string): Promise<RiskScore | undefined> {
    const response = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': `USER#${walletAddress}`, ':sk': 'RISK#' },
      ScanIndexForward: false, // Latest first
      Limit: 1,
    }));
    return response.Items?.[0] as RiskScore | undefined;
  }
}
