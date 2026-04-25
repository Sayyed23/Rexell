/**
 * HTTP client for the Rexell bot-detection service.
 *
 * Implements Task 17.1: typed wrappers around the /v1/detect,
 * /v1/verify-challenge, /v1/validate-token and /v1/consume-token endpoints
 * with retry + exponential-backoff, API-key injection and correlation-ID
 * propagation.
 */

import {
  BehavioralData,
  DetectionRequest,
  DetectionResponse
} from './types';

export interface BotDetectionClientConfig {
  apiUrl: string;
  apiKey: string;
  /** Timeout for a single HTTP attempt (ms). Default 3000. */
  timeoutMs?: number;
  /** Total retry attempts on transient failures. Default 3. */
  maxRetries?: number;
  /** Hook for request correlation IDs. */
  correlationId?: () => string;
  fetchImpl?: typeof fetch;
}

export interface ChallengeVerifyRequest {
  challengeId: string;
  sessionId: string;
  walletAddress: string;
  response: unknown;
}

export interface ChallengeVerifyResponse {
  success: boolean;
  challengeId: string;
  riskScoreAdjustment: number;
  verificationToken?: string;
  attemptsRemaining: number;
  reason?: string;
}

export interface TokenValidationResponse {
  valid: boolean;
  reason?: string;
}

export interface TokenConsumptionResponse {
  consumed: boolean;
}

export interface ResaleCheckResponse {
  flagged: boolean;
  requiresAdditionalVerification: boolean;
  trusted: boolean;
  requestsInWindow: number;
}

const DEFAULT_TIMEOUT_MS = 3_000;
const DEFAULT_MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BotDetectionClient {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly correlationId?: () => string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: BotDetectionClientConfig) {
    if (!config.apiUrl) throw new Error('BotDetectionClient: apiUrl required');
    if (!config.apiKey) throw new Error('BotDetectionClient: apiKey required');
    this.apiUrl = config.apiUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.correlationId = config.correlationId;
    this.fetchImpl = config.fetchImpl ?? (globalThis as any).fetch;
    if (!this.fetchImpl) {
      throw new Error('BotDetectionClient: no fetch implementation available');
    }
  }

  async detect(
    behavioralData: BehavioralData,
    context?: DetectionRequest['context']
  ): Promise<DetectionResponse> {
    return this.request<DetectionResponse>('POST', '/v1/detect', {
      behavioralData,
      context
    });
  }

  async verifyChallenge(
    payload: ChallengeVerifyRequest
  ): Promise<ChallengeVerifyResponse> {
    return this.request<ChallengeVerifyResponse>(
      'POST',
      '/v1/verify-challenge',
      payload
    );
  }

  async validateToken(
    token: string,
    walletAddress: string
  ): Promise<TokenValidationResponse> {
    return this.request<TokenValidationResponse>('POST', '/v1/validate-token', {
      token,
      walletAddress
    });
  }

  async consumeToken(
    token: string,
    txHash: string
  ): Promise<TokenConsumptionResponse> {
    return this.request<TokenConsumptionResponse>('POST', '/v1/consume-token', {
      token,
      txHash
    });
  }

  async checkResale(walletAddress: string, ticketId?: string): Promise<ResaleCheckResponse> {
    return this.request<ResaleCheckResponse>('POST', '/v1/resale-check', {
      walletAddress,
      ticketId
    });
  }

  async health(): Promise<Record<string, unknown>> {
    return this.request('GET', '/v1/health');
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    let attempt = 0;
    let lastErr: unknown = null;

    while (attempt < this.maxRetries) {
      attempt++;
      const controller =
        typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller
        ? setTimeout(() => controller.abort(), this.timeoutMs)
        : null;

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        };
        if (this.correlationId) {
          headers['X-Correlation-ID'] = this.correlationId();
        }

        const resp = await this.fetchImpl(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller ? (controller.signal as any) : undefined
        });

        if (!resp.ok) {
          if (RETRYABLE_STATUS.has(resp.status) && attempt < this.maxRetries) {
            const retryAfter = Number(resp.headers.get('retry-after')) * 1000;
            await sleep(Number.isFinite(retryAfter) && retryAfter > 0
              ? retryAfter
              : this.backoffMs(attempt));
            continue;
          }
          const text = await resp.text();
          throw new Error(
            `bot-detection ${method} ${path} failed (${resp.status}): ${text}`
          );
        }
        return (await resp.json()) as T;
      } catch (err) {
        lastErr = err;
        if (attempt >= this.maxRetries) break;
        await sleep(this.backoffMs(attempt));
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }
    throw lastErr ?? new Error('bot-detection request failed');
  }

  private backoffMs(attempt: number): number {
    return Math.min(2_000, 150 * 2 ** (attempt - 1));
  }
}
