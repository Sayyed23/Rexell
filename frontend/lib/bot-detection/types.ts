export type DetectionDecision = 'allow' | 'challenge' | 'block';

export interface BehavioralData {
  sessionId: string;
  walletAddress: string;
  userAgent: string;
  events: unknown[];
}

export interface ClientDetectionResponse {
  decision: DetectionDecision;
  riskScore: number;
  challengeId?: string;
  challengeType?: 'image_selection' | 'behavioral_confirmation' | 'multi_step';
  verificationToken?: string;
}

export interface GuardContext {
  action: 'buyTicket' | 'buyTickets' | 'resale';
  quantity?: number;
  eventId?: string;
  accountAgeDays?: number;
  transactionCount?: number;
}

export interface GuardRequestContext {
  accountAgeDays: number;
  transactionCount: number;
  isBulkPurchase: boolean;
  requestedQuantity: number;
  isResale: boolean;
}

export interface GuardResult {
  decision: DetectionDecision;
  riskScore: number;
  challengeId?: string;
  challengeType?: ClientDetectionResponse['challengeType'];
  verificationToken?: string;
  degraded?: boolean;
}
