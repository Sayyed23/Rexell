/**
 * Data models for Rexell AI Bot Detection.
 * Based on design.md database schema.
 */

export interface BehavioralData {
  /** PK: USER#{hashedWalletAddress} */
  PK: string;
  /** SK: SESSION#{timestamp}#{sessionId} */
  SK: string;
  /** Hashed wallet address */
  walletAddress: string;
  /** Unique session ID */
  sessionId: string;
  /** Unix timestamp of the event */
  timestamp: number;
  /** Event type (e.g., 'click', 'keystroke', 'mouse_move') */
  eventType: string;
  /** Contextual data (x, y coordinates, keycode, element, etc.) */
  eventData: Record<string, any>;
  /** Client-side metadata (browser, OS, viewport) */
  clientMetadata: Record<string, any>;
  /** TTL for data retention (90 days) */
  ttl: number;
}

export interface RiskScore {
  /** PK: USER#{hashedWalletAddress} */
  PK: string;
  /** SK: RISK#{timestamp} */
  SK: string;
  /** Hashed wallet address */
  walletAddress: string;
  /** Risk level (0.0 to 1.0) */
  score: number;
  /** Decision: 'ALLOW' | 'CHALLENGE' | 'BLOCK' */
  decision: 'ALLOW' | 'CHALLENGE' | 'BLOCK';
  /** Reason/features that influenced the score */
  reason: string[];
  /** Associated event/session ID */
  eventId: string;
  /** Unix timestamp of the decision */
  timestamp: number;
  /** TTL for data retention (1 year) */
  ttl: number;
}

export interface VerificationToken {
  /** PK: TOKEN#{tokenId} */
  PK: string;
  /** SK: WALLET#{walletAddress} */
  SK: string;
  /** Token ID (UUID) */
  tokenId: string;
  /** Hashed wallet address */
  walletAddress: string;
  /** Token value (HMAC-SHA256 signature) */
  signature: string;
  /** Unix timestamp when issued */
  issuedAt: number;
  /** Unix timestamp when expires (24h) */
  expiresAt: number;
  /** TTL for DynamoDB expiration */
  ttl: number;
}

export interface UserReputation {
  /** PK: USER#{hashedWalletAddress} */
  PK: string;
  /** SK: REPUTATION */
  SK: string;
  /** Aggregate risk score */
  avgRiskScore: number;
  /** Total events recorded */
  totalEvents: number;
  /** Total challenges issued */
  challengesIssued: number;
  /** Total challenges passed */
  challengesPassed: number;
  /** Current status: 'CLEAN' | 'SUSPICIOUS' | 'FLAGGED' */
  status: 'CLEAN' | 'SUSPICIOUS' | 'FLAGGED';
  /** Last updated timestamp */
  updatedAt: number;
}

export interface ChallengeState {
  /** PK: CHALLENGE#{challengeId} */
  PK: string;
  /** SK: SESSION#{sessionId} */
  SK: string;
  /** Challenge ID */
  challengeId: string;
  /** Session ID */
  sessionId: string;
  /** Type of challenge (e.g., 'POW', 'biometric') */
  type: string;
  /** Challenge payload (e.g., PoW difficulty, biometric targets) */
  payload: Record<string, any>;
  /** Solution (if solved) */
  solution?: string;
  /** Verification status: 'PENDING' | 'SOLVED' | 'EXPIRED' | 'FAILED' */
  status: 'PENDING' | 'SOLVED' | 'EXPIRED' | 'FAILED';
  /** Created timestamp */
  createdAt: number;
  /** Solved timestamp */
  solvedAt?: number;
  /** TTL for challenge expiration */
  ttl: number;
}
