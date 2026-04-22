import * as React from 'react';
import { ChallengeBaseProps } from './types';

/**
 * Grid-of-images challenge (Task 15.2).
 * Users toggle images and submit; the service returns success/failure.
 */
export const ImageSelectionChallenge: React.FC<ChallengeBaseProps> = ({
  client,
  challengeId,
  sessionId,
  walletAddress,
  content,
  onSuccess,
  onFailure,
  onError
}) => {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const images = content.images ?? [];

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await client.verifyChallenge({
        challengeId,
        sessionId,
        walletAddress,
        response: { selectedIds: Array.from(selected) }
      });
      if (result.success && result.verificationToken) {
        setFeedback('Success');
        onSuccess(result.verificationToken);
      } else {
        setFeedback(result.reason ?? 'Incorrect selection');
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
    <div className="rex-challenge rex-challenge--images">
      {content.prompt && <p className="rex-challenge__prompt">{content.prompt}</p>}
      <div
        className="rex-challenge__grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8
        }}
      >
        {images.map((img) => {
          const isSelected = selected.has(img.id);
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => toggle(img.id)}
              aria-pressed={isSelected}
              className={
                'rex-challenge__cell' +
                (isSelected ? ' rex-challenge__cell--selected' : '')
              }
              style={{
                border: isSelected ? '3px solid #10b981' : '2px solid #e5e7eb',
                padding: 0,
                background: 'none',
                cursor: 'pointer'
              }}
            >
              <img
                src={img.url}
                alt=""
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
            </button>
          );
        })}
      </div>
      <div
        className="rex-challenge__actions"
        style={{ marginTop: 12, display: 'flex', gap: 8 }}
      >
        <button type="button" onClick={submit} disabled={submitting || selected.size === 0}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
        {feedback && <span className="rex-challenge__feedback">{feedback}</span>}
      </div>
    </div>
  );
};
