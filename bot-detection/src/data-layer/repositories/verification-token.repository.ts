import { BaseRepository } from './base.repository';
import { VerificationToken } from '../interfaces';

/**
 * Repository for generated verification tokens.
 */
export class VerificationTokenRepository extends BaseRepository<VerificationToken> {
  async saveToken(data: Omit<VerificationToken, 'PK' | 'SK' | 'ttl'>): Promise<void> {
    const item: VerificationToken = {
      ...data,
      PK: `TOKEN#${data.tokenId}`,
      SK: `WALLET#${data.walletAddress}`,
      ttl: data.expiresAt,
    };

    await this.put(item);
  }

  async getToken(tokenId: string): Promise<VerificationToken | undefined> {
    return this.queryByPk(`TOKEN#${tokenId}`).then(items => items[0]);
  }
}
