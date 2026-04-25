/**
 * Thin integration layer between the Next.js frontend and the Rexell
 * bot-detection platform. Task 17 (17.1 – 17.5).
 *
 * Usage:
 *   const bd = getBotDetection();
 *   bd.startTracking({ sessionId, walletAddress });
 *   const { decision, token } = await bd.guardPurchase({ action: 'buyTicket' });
 *   if (decision === 'block') { return toast.error('Blocked'); }
 *   if (decision === 'challenge') { renderChallenge(token); }
 */

import type { BehavioralData } from './types';
import {
  ClientDetectionResponse,
  GuardContext,
  GuardResult,
  GuardRequestContext
} from './types';

const DEFAULT_API_URL =
  process.env.NEXT_PUBLIC_BOT_DETECTION_URL ?? '/api/bot-detection';
const DEFAULT_CHALLENGE_URL =
  process.env.NEXT_PUBLIC_BOT_DETECTION_CHALLENGE_URL ?? DEFAULT_API_URL;
const DEFAULT_API_KEY = process.env.NEXT_PUBLIC_BOT_DETECTION_KEY ?? '';

type EventRow = {
  type: string;
  timestamp: number;
  [k: string]: unknown;
};

class FrontendTracker {
  private events: EventRow[] = [];
  private started = false;
  private sessionId = '';
  private walletAddress = '';
  private readonly bufferLimit = 4096;

  start(cfg: { sessionId: string; walletAddress: string }) {
    if (this.started) return;
    this.sessionId = cfg.sessionId;
    this.walletAddress = cfg.walletAddress;
    this.started = true;
    if (typeof window === 'undefined') return;
    window.addEventListener('mousemove', this.onMouse, { passive: true });
    window.addEventListener('click', this.onClick, { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('keydown', this.onKey, { passive: true });
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    if (typeof window === 'undefined') return;
    window.removeEventListener('mousemove', this.onMouse);
    window.removeEventListener('click', this.onClick);
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('keydown', this.onKey);
  }

  snapshot(): BehavioralData {
    return {
      sessionId: this.sessionId || 'anon',
      walletAddress: this.walletAddress || '0x' + '0'.repeat(40),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      events: this.events.slice(-512) as any
    } as BehavioralData;
  }

  private push(row: EventRow) {
    this.events.push(row);
    if (this.events.length > this.bufferLimit) {
      this.events.splice(0, this.events.length - this.bufferLimit);
    }
  }

  private onMouse = (ev: MouseEvent) =>
    this.push({ type: 'mousemove', timestamp: performance.now(), x: ev.clientX, y: ev.clientY });
  private onClick = (ev: MouseEvent) =>
    this.push({ type: 'click', timestamp: performance.now(), x: ev.clientX, y: ev.clientY });
  private onScroll = () =>
    this.push({ type: 'scroll', timestamp: performance.now(), x: window.scrollX, y: window.scrollY });
  private onKey = (ev: KeyboardEvent) => {
    if (
      ev.target instanceof HTMLElement &&
      (ev.target.matches('input[type="password"]') ||
        ev.target.matches('input[name*="password" i]'))
    ) {
      return;
    }
    // The listener is registered on `keydown`, so emit a matching `keydown`
    // row. Mislabelling these as `keyup` confused the backend feature
    // extractor (which expects pressTime / interKeyInterval on keyup events).
    this.push({ type: 'keydown', timestamp: performance.now(), key: ev.code });
  };
}

export class BotDetectionIntegration {
  private readonly apiUrl: string;
  private readonly challengeUrl: string;
  private readonly apiKey: string;
  private readonly tracker = new FrontendTracker();

  constructor(opts?: { apiUrl?: string; challengeUrl?: string; apiKey?: string }) {
    this.apiUrl = (opts?.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, '');
    this.challengeUrl = (opts?.challengeUrl ?? DEFAULT_CHALLENGE_URL).replace(/\/$/, '');
    this.apiKey = opts?.apiKey ?? DEFAULT_API_KEY;
  }

  startTracking(cfg: { sessionId: string; walletAddress: string }) {
    this.tracker.start(cfg);
  }

  stopTracking() {
    this.tracker.stop();
  }

  /**
   * Gate a purchase / resale action through bot detection.
   * Falls back to ``{ decision: 'allow' }`` if the detection service is unreachable,
   * matching the "fail open to rate-limit" strategy described in the spec.
   */
  async guardPurchase(ctx: GuardContext): Promise<GuardResult> {
    const body = {
      behavioralData: this.tracker.snapshot(),
      context: this.buildRequestContext(ctx)
    };
    try {
      const resp = await fetch(`${this.apiUrl}/v1/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify(body),
        credentials: 'include'
      });
      if (!resp.ok) throw new Error(`bot-detection failed (${resp.status})`);
      const payload = (await resp.json()) as ClientDetectionResponse;
      return {
        decision: payload.decision,
        riskScore: payload.riskScore,
        challengeId: payload.challengeId,
        challengeType: payload.challengeType,
        verificationToken: payload.verificationToken
      };
    } catch (err) {
      // Graceful degradation: allow the purchase but record that detection failed
      if (typeof console !== 'undefined') {
        console.warn('bot-detection guard failed, allowing request', err);
      }
      return { decision: 'allow', riskScore: 0, degraded: true };
    }
  }

  /**
   * Submit a user's response to a challenge issued by /v1/detect.
   * On success the challenge service mints a verification token and
   * returns it via the ``X-Verification-Token`` response header. The
   * caller can then short-circuit the next ``guardPurchase`` call with
   * this token so the flow doesn't re-trigger detection (which would
   * otherwise still see the same elevated risk score and challenge
   * again — the original infinite-loop bug).
   */
  async verifyChallenge(
    challengeId: string,
    sessionId: string,
    walletAddress: string,
    responseData: Record<string, unknown> = { confirmed: true }
  ): Promise<{ success: boolean; verificationToken?: string; remainingAttempts: number; blockedUntil?: number }> {
    try {
      const resp = await fetch(`${this.challengeUrl}/v1/verify-challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          challenge_id: challengeId,
          session_id: sessionId,
          wallet_address: walletAddress,
          response_data: responseData
        })
      });
      if (!resp.ok) {
        return { success: false, remainingAttempts: 0 };
      }
      const verificationToken = resp.headers.get('x-verification-token') ?? undefined;
      const payload = (await resp.json()) as {
        success: boolean;
        remaining_attempts: number;
        blocked_until?: number;
      };
      return {
        success: payload.success,
        verificationToken: payload.success ? verificationToken : undefined,
        remainingAttempts: payload.remaining_attempts,
        blockedUntil: payload.blocked_until
      };
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.warn('verifyChallenge failed', err);
      }
      return { success: false, remainingAttempts: 0 };
    }
  }

  async consumeToken(token: string, txHash: string): Promise<boolean> {
    try {
      const resp = await fetch(`${this.apiUrl}/v1/consume-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({ token, txHash })
      });
      if (!resp.ok) return false;
      const payload = (await resp.json()) as { consumed?: boolean };
      return Boolean(payload.consumed);
    } catch {
      return false;
    }
  }

  async checkResale(walletAddress: string, ticketId?: string) {
    try {
      const resp = await fetch(`${this.apiUrl}/v1/resale-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({ walletAddress, ticketId })
      });
      if (!resp.ok) return null;
      return (await resp.json()) as {
        flagged: boolean;
        requiresAdditionalVerification: boolean;
        trusted: boolean;
      };
    } catch {
      return null;
    }
  }

  private buildRequestContext(ctx: GuardContext): GuardRequestContext {
    return {
      accountAgeDays: ctx.accountAgeDays ?? 0,
      transactionCount: ctx.transactionCount ?? 0,
      isBulkPurchase: ctx.action === 'buyTickets' && (ctx.quantity ?? 1) > 1,
      requestedQuantity: ctx.quantity ?? 1,
      isResale: ctx.action === 'resale',
      // Forward the event id so the detection handler can bind the
      // verification token to it (otherwise tokens are event-agnostic).
      eventId: ctx.eventId
    };
  }
}

let singleton: BotDetectionIntegration | null = null;
export function getBotDetection(): BotDetectionIntegration {
  if (!singleton) singleton = new BotDetectionIntegration();
  return singleton;
}

export * from './types';
