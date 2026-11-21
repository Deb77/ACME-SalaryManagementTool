import { useId, useState } from 'react';
import { PillButton } from '../../atoms/PillButton/PillButton';
import { TrayCard } from '../../molecules/TrayCard/TrayCard';
import styles from './QuerySteps.module.css';

export interface QueryStep {
  /** What the step looked up, in plain English. */
  label: string;
  /** Short outcome, e.g. "3 rows". */
  result: string;
}

export interface QueryStepsProps {
  title: string;
  steps: readonly QueryStep[];
  defaultExpanded?: boolean;
}

/** "Worked through 3 steps": what an AI answer looked up, in plain English, with each outcome. */
export function QuerySteps({ title, steps, defaultExpanded = true }: QueryStepsProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const listId = useId();
  return (
    <TrayCard
      title={title}
      headingLevel={3}
      extra={
        <PillButton
          tone="quiet"
          size="small"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Hide steps' : 'Show steps'}
        </PillButton>
      }
    >
      <ol id={listId} className={styles.list} hidden={!expanded}>
        {steps.map((step) => (
          <li key={step.label} className={styles.step}>
            <span className={styles.dot} aria-hidden="true" />
            <div className={styles.main}>
              <div className={styles.label}>{step.label}</div>
            </div>
            <span className={styles.result}>{step.result}</span>
          </li>
        ))}
      </ol>
    </TrayCard>
  );
}
