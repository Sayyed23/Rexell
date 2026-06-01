"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/shared/ui/button";
import type { GuardResult } from "@/lib/bot-detection/types";

interface BotChallengeModalProps {
  challenge: GuardResult | null;
  /**
   * Called when the user confirms humanity. May be async — return a
   * Promise so the modal can show a "Verifying…" state and stay open
   * until the challenge service has actually issued a verification
   * token. Resolves regardless of success/failure; the caller is
   * responsible for surfacing errors.
   */
  onConfirm: () => void | Promise<unknown>;
  onCancel: () => void;
}

/**
 * Lightweight confirmation modal shown when the bot-detection backend
 * returns a `challenge` decision. We surface a single explicit human
 * gesture (a button click on a mouse-driven prompt) before allowing the
 * on-chain write to continue. Real adaptive challenges (image grid /
 * multi-step) live in `bot-detection/sdk/src/react/` and can be mounted
 * here in production builds; this minimal version keeps the integration
 * shippable without those assets.
 */
export function BotChallengeModal({
  challenge,
  onConfirm,
  onCancel,
}: BotChallengeModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset the checkbox whenever a new challenge instance arrives. React
  // preserves component state across renders even when we briefly return
  // null (challenge transitions to null after a cancel), so without this
  // the user's previous tick survives and the "Continue purchase" button
  // is re-enabled without an explicit re-confirmation on the next round.
  useEffect(() => {
    setAcknowledged(false);
    setSubmitting(false);
  }, [challenge]);

  if (!challenge) return null;

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      // ``challenge`` will normally transition to null on success and the
      // useEffect above resets state; the finally block covers the error
      // path where the modal stays mounted.
      setSubmitting(false);
      setAcknowledged(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-xl font-semibold text-gray-900">
          Quick verification
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          Our anti-bot system is running an extra check on this purchase
          (risk score {Math.round(challenge.riskScore)} / 100). Please
          confirm you are a real person to continue.
        </p>

        <label className="mb-4 flex items-start gap-3 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={submitting}
          />
          <span>
            I confirm I am a human and I am buying this ticket for myself,
            not for resale automation.
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            disabled={!acknowledged || submitting}
            onClick={handleConfirm}
          >
            {submitting ? "Verifying…" : "Continue purchase"}
          </Button>
        </div>
      </div>
    </div>
  );
}
