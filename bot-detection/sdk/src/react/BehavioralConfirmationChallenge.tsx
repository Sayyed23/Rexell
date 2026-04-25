import * as React from 'react';
import { ChallengeBaseProps } from './types';

/**
 * Simple behavioral-confirmation step: the user traces a short path
 * before the challenge is submitted. Implements the behavioural leg of
 * the multi-step challenge (Task 15.3).
 */
export const BehavioralConfirmationChallenge: React.FC<ChallengeBaseProps> = ({
  client,
  challengeId,
  sessionId,
  walletAddress,
  onSuccess,
  onFailure,
  onError
}) => {
  const [points, setPoints] = React.useState<{ x: number; y: number; t: number }[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const onMove = (ev: React.MouseEvent<HTMLDivElement>) => {
    if (points.length >= 200) return;
    setPoints((prev) => [
      ...prev,
      { x: ev.clientX, y: ev.clientY, t: performance.now() }
    ]);
  };

  const submit = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await client.verifyChallenge({
        challengeId,
        sessionId,
        walletAddress,
        response: { gesturePoints: points }
      });
      if (result.success && result.verificationToken) {
        setFeedback('Confirmed');
        onSuccess(result.verificationToken);
      } else {
        setFeedback(result.reason ?? 'Please try again');
        onFailure(result.reason ?? 'failed', result.attemptsRemaining);
      }
    } catch (err) {
      setFeedback('Verification failed');
      onError?.(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rex-challenge rex-challenge--behavior">
      <p>Draw a short curve inside the area below to continue.</p>
      <div
        onMouseMove={onMove}
        style={{
          width: 320,
          height: 180,
          border: '2px dashed #9ca3af',
          borderRadius: 8,
          marginBottom: 12
        }}
      />
      <button type="button" onClick={submit} disabled={submitting || points.length < 20}>
        {submitting ? 'Submitting…' : 'Confirm'}
      </button>
      {feedback && <div className="rex-challenge__feedback">{feedback}</div>}
    </div>
  );
};
