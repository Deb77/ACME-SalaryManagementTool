import type { ReactNode } from 'react';
import styles from './SignIn.module.css';

/** The frame shared by the sign-in and accept-invite pages. */
export function SignInCard({
  title,
  lead,
  children,
}: {
  title: string;
  lead: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            A
          </span>
          ACME People
        </div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lead}>{lead}</p>
        {children}
      </div>
    </main>
  );
}
