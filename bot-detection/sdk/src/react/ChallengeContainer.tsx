import * as React from 'react';
import { ChallengeBaseProps } from './types';
import { ImageSelectionChallenge } from './ImageSelectionChallenge';
import { MultiStepChallenge } from './MultiStepChallenge';
import { BehavioralConfirmationChallenge } from './BehavioralConfirmationChallenge';

/**
 * Renders the correct challenge component based on the challenge type.
 * Handles loading / error / success states for Task 15.1.
 */
export const ChallengeContainer: React.FC<ChallengeBaseProps> = (props) => {
  if (!props.content) {
    return <div className="rex-challenge rex-challenge--loading">Loading…</div>;
  }

  switch (props.content.type) {
    case 'image_selection':
      return <ImageSelectionChallenge {...props} />;
    case 'multi_step':
      return <MultiStepChallenge {...props} />;
    case 'behavioral_confirmation':
      return <BehavioralConfirmationChallenge {...props} />;
    default:
      return (
        <div className="rex-challenge rex-challenge--error">
          Unsupported challenge type: {(props.content as any).type}
        </div>
      );
  }
};
