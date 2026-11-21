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
}

/**
 * "Worked through 3 steps": what an AI answer looked up, in plain English, with each outcome.
 * Always open: the steps are how people check the numbers, so they are never one click away.
 */
export function QuerySteps({ title, steps }: QueryStepsProps) {
  return (
    <TrayCard title={title} headingLevel={3}>
      <ol className={styles.list}>
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
