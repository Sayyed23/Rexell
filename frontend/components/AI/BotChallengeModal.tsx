"use client";

import { useState } from "react";
import { Button } from "@/components/shared/ui/button";
import type { GuardResult } from "@/lib/bot-detection/types";

interface BotChallengeModalProps {
  challenge: GuardResult | null;
  onConfirm: () => void;
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

  if (!challenge) return null;

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
          />
          <span>
            I confirm I am a human and I am buying this ticket for myself,
            not for resale automation.
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={!acknowledged}
            onClick={() => {
              setAcknowledged(false);
              onConfirm();
            }}
          >
            Continue purchase
          </Button>
        </div>
      </div>
    </div>
  );
}
