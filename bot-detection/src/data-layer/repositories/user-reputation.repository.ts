import { BaseRepository } from './base.repository';
import { UserReputation } from '../interfaces';

/**
 * Repository for aggregate user reputation status.
 */
export class UserReputationRepository extends BaseRepository<UserReputation> {
  async getReputation(walletAddress: string): Promise<UserReputation | undefined> {
    return this.get(`USER#${walletAddress}`, 'REPUTATION');
  }

  async updateReputation(walletAddress: string, update: Partial<UserReputation>): Promise<void> {
    const pk = `USER#${walletAddress}`;
    const sk = 'REPUTATION';

    // Implementation would use UpdateCommand to be atomic
    // For now using simple put for initial version
    const existing = await this.getReputation(walletAddress);
    const item: UserReputation = {
      PK: pk,
      SK: sk,
      avgRiskScore: existing?.avgRiskScore || 0,
      totalEvents: existing?.totalEvents || 0,
      challengesIssued: existing?.challengesIssued || 0,
      challengesPassed: existing?.challengesPassed || 0,
      status: existing?.status || 'CLEAN',
      updatedAt: Date.now(),
      ...update,
    };

    await this.put(item);
  }
}
