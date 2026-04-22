import * as React from 'react';
import { ChallengeBaseProps } from './types';
import { ImageSelectionChallenge } from './ImageSelectionChallenge';
import { BehavioralConfirmationChallenge } from './BehavioralConfirmationChallenge';

/**
 * Multi-step challenge (Task 15.3).
 *
 * Composes image-selection + behavioural confirmation steps with a
 * simple state-machine and displays a progress bar. The top-level
 * ``onSuccess`` handler is invoked only after every step has succeeded.
 */
export const MultiStepChallenge: React.FC<ChallengeBaseProps> = (props) => {
  const steps = props.content.steps ?? [
    { ...props.content, type: 'image_selection' },
    { ...props.content, type: 'behavioral_confirmation' }
  ];
  const [stepIdx, setStepIdx] = React.useState(0);

  const current = steps[stepIdx];
  const advance = (token: string) => {
    if (stepIdx < steps.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      props.onSuccess(token);
    }
  };

  const failure = (reason: string, attemptsRemaining: number) => {
    props.onFailure(reason, attemptsRemaining);
  };

  const inner = React.useMemo(() => {
    if (current.type === 'image_selection') {
      return (
        <ImageSelectionChallenge
          {...props}
          content={current}
          onSuccess={advance}
          onFailure={failure}
        />
      );
    }
    return (
      <BehavioralConfirmationChallenge
        {...props}
        content={current}
        onSuccess={advance}
        onFailure={failure}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  return (
    <div className="rex-challenge rex-challenge--multi">
      <div
        className="rex-challenge__progress"
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 12
        }}
      >
        {steps.map((_, idx) => (
          <span
            key={idx}
            style={{
              flex: 1,
              height: 4,
              background: idx <= stepIdx ? '#10b981' : '#e5e7eb'
            }}
          />
        ))}
      </div>
      {inner}
    </div>
  );
};
