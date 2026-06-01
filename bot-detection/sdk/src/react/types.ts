import { BotDetectionClient } from '../client';

export interface ChallengeContent {
  type: 'image_selection' | 'behavioral_confirmation' | 'multi_step';
  prompt?: string;
  images?: { id: string; url: string }[];
  answer_indices?: number[];
  steps?: ChallengeContent[];
}

export interface ChallengeBaseProps {
  client: BotDetectionClient;
  challengeId: string;
  sessionId: string;
  walletAddress: string;
  content: ChallengeContent;
  onSuccess: (token: string) => void;
  onFailure: (reason: string, attemptsRemaining: number) => void;
  onError?: (error: unknown) => void;
}
