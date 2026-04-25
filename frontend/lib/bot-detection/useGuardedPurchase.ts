'use client';

import { useCallback, useState } from 'react';
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
 *   user passes the modal, call `acknowledgeChallenge()` to continue.
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

  const acknowledgeChallenge = useCallback(() => {
    setPendingChallenge(null);
  }, []);

  const runGuard = useCallback(
    async (ctx: GuardContext): Promise<GuardedPurchaseRunResult> => {
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
    acknowledgeChallenge,
    bd,
  };
}
