import { BaseRepository } from './base.repository';
import { ChallengeState } from '../interfaces';

/**
 * Repository for anti-bot challenges (PoW, Biometric, etc.).
 */
export class ChallengeStateRepository extends BaseRepository<ChallengeState> {
  async saveChallenge(data: Omit<ChallengeState, 'PK' | 'SK' | 'ttl'>): Promise<void> {
    const hours24InSeconds = 24 * 60 * 60;
    const ttl = Math.floor(Date.now() / 1000) + hours24InSeconds;

    const item: ChallengeState = {
      ...data,
      PK: `CHALLENGE#${data.challengeId}`,
      SK: `SESSION#${data.sessionId}`,
      ttl,
    };

    await this.put(item);
  }

  async updateStatus(challengeId: string, sessionId: string, status: ChallengeState['status'], solution?: string): Promise<void> {
    const existing = await this.get(`CHALLENGE#${challengeId}`, `SESSION#${sessionId}`);
    if (existing) {
      await this.put({
        ...existing,
        status,
        solution: solution || existing.solution,
        solvedAt: status === 'SOLVED' ? Date.now() : existing.solvedAt,
      });
    }
  }
}
