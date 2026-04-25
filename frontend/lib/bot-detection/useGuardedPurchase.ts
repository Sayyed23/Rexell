'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useBotDetection } from './useBotDetection';
import type { GuardContext, GuardResult } from './types';

export interface UseGuardedPurchaseOptions {
  walletAddress: string | undefined;
  sessionId?: string;
}

export interface GuardedPurchaseRunResult extends GuardResult {
  proceed: boolean;
}

/**
 * Wraps a purchase flow with the Rexell bot-detection guard.
 *
 * - Boots the behavioural tracker as soon as the user has a wallet address.
 * - Calls POST /v1/detect via {@link BotDetectionIntegration.guardPurchase}
 *   before the on-chain write.
 * - Returns `{ proceed: false }` for `block` decisions (caller should bail).
 * - Returns `{ proceed: true }` for `allow` and degraded responses.
 * - For `challenge`, exposes the challenge metadata + a `pendingChallenge`
 *   piece of state so the page can mount a confirmation modal. After the
 *   user passes the modal, call ``verifyChallenge()`` to actually post the
 *   response to /v1/verify-challenge — on success the returned verification
 *   token is primed and the next ``runGuard`` short-circuits with it,
 *   breaking the infinite challenge → re-detect → challenge loop that
 *   existed when the modal only cleared local state.
 *
 * Even when the bot-detection backend is unreachable, the helper falls back
 * to `allow + degraded`, so the marketplace stays open for legitimate users.
 */
export function useGuardedPurchase(opts: UseGuardedPurchaseOptions) {
  const sessionId = opts.sessionId ?? `rexell-${opts.walletAddress ?? 'anon'}`;
  const bd = useBotDetection({
    sessionId,
    walletAddress: opts.walletAddress,
    enabled: Boolean(opts.walletAddress),
  });

  const [pendingChallenge, setPendingChallenge] = useState<GuardResult | null>(null);
  // Token received from /v1/verify-challenge after the user successfully
  // completed a challenge. Stored in a ref so ``runGuard`` consumes it
  // exactly once on the next call without race-prone re-renders.
  const primedTokenRef = useRef<string | null>(null);

  const verifyChallenge = useCallback(
    async (responseData?: Record<string, unknown>): Promise<boolean> => {
      const challenge = pendingChallenge;
      if (!challenge?.challengeId || !opts.walletAddress) {
        // No active challenge to verify; treat as a no-op cancel.
        setPendingChallenge(null);
        return false;
      }
      const result = await bd.verifyChallenge(
        challenge.challengeId,
        sessionId,
        opts.walletAddress,
        responseData,
      );
      if (result.success && result.verificationToken) {
        primedTokenRef.current = result.verificationToken;
        setPendingChallenge(null);
        return true;
      }
      // Verification failed (wrong response, expired, max attempts) — keep
      // the modal closed so the user isn't stuck in the same step, surface
      // an error, and let the caller decide whether to retry.
      setPendingChallenge(null);
      toast.error('Verification failed', {
        description: result.blockedUntil
          ? 'Too many failed attempts. Please try again later.'
          : 'Please try the purchase again.',
      });
      return false;
    },
    [bd, opts.walletAddress, pendingChallenge, sessionId],
  );

  const cancelChallenge = useCallback(() => {
    setPendingChallenge(null);
  }, []);

  const runGuard = useCallback(
    async (ctx: GuardContext): Promise<GuardedPurchaseRunResult> => {
      // Short-circuit: if we just verified a challenge, use the resulting
      // verification token directly instead of running detection again.
      // Without this the freshly verified user would post /v1/detect, hit
      // the same elevated risk score, and be re-challenged → loop.
      if (primedTokenRef.current) {
        const verificationToken = primedTokenRef.current;
        primedTokenRef.current = null;
        return {
          decision: 'allow',
          riskScore: 0,
          verificationToken,
          proceed: true,
        };
      }

      const result = await bd.guardPurchase(ctx);

      if (result.degraded) {
        // Backend unreachable; allow but log so we can spot outages in dev tools.
        console.warn(
          '[bot-detection] guard ran in degraded mode (backend unreachable); allowing purchase',
          result,
        );
      }

      if (result.decision === 'block') {
        toast.error('Purchase blocked', {
          description:
            'Our bot-detection system flagged this request. If you believe this is a mistake, please contact support.',
        });
        return { ...result, proceed: false };
      }

      if (result.decision === 'challenge') {
        toast.warning('Quick verification needed', {
          description: 'Please confirm you are not a bot to continue.',
        });
        setPendingChallenge(result);
        return { ...result, proceed: false };
      }

      return { ...result, proceed: true };
    },
    [bd],
  );

  const consumeToken = useCallback(
    async (token: string | undefined, txHash: string) => {
      if (!token) return false;
      try {
        return await bd.consumeToken(token, txHash);
      } catch (err) {
        console.warn('[bot-detection] consumeToken failed', err);
        return false;
      }
    },
    [bd],
  );

  return {
    runGuard,
    consumeToken,
    pendingChallenge,
    verifyChallenge,
    cancelChallenge,
    // Backwards-compat alias for older call sites that just want to clear
    // the modal without sending a response (treats acknowledge as cancel —
    // the actual API call now flows through ``verifyChallenge``).
    acknowledgeChallenge: cancelChallenge,
    bd,
  };
}
