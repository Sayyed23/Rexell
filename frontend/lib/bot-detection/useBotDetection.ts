'use client';

import { useEffect, useMemo } from 'react';
import { getBotDetection } from './index';

export interface UseBotDetectionOptions {
  sessionId: string;
  walletAddress: string | undefined;
  enabled?: boolean;
}

export function useBotDetection(opts: UseBotDetectionOptions) {
  const bd = useMemo(() => getBotDetection(), []);

  useEffect(() => {
    if (!opts.enabled || !opts.walletAddress) return;
    bd.startTracking({
      sessionId: opts.sessionId,
      walletAddress: opts.walletAddress
    });
    return () => bd.stopTracking();
  }, [bd, opts.enabled, opts.sessionId, opts.walletAddress]);

  return bd;
}
