import { IconCheck } from '@tabler/icons-react';
import styles from './Stepper.module.css';

export interface StepperProps {
  label: string;
  steps: readonly string[];
  /** Zero-based index of the current step. */
  current: number;
}

/**
 * Pill progress indicator for multi-step flows (Import: Upload → Match →
 * Review → Import). A plain ordered list with aria-current="step", so assistive
 * technology announces which step is current.
 */
export function Stepper({ label, steps, current }: StepperProps) {
  return (
    <ol aria-label={label} className={styles.list}>
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo';
        return (
          <li
            key={step}
            aria-current={state === 'current' ? 'step' : undefined}
            className={[styles.step, state !== 'todo' && styles[state]].filter(Boolean).join(' ')}
          >
            <span className={styles.mark} aria-hidden="true">
              {state === 'done' ? <IconCheck size={14} stroke={2.5} /> : index + 1}
            </span>
            {step}
            {state === 'done' && <span className="visually-hidden"> (done)</span>}
          </li>
        );
      })}
    </ol>
  );
}
