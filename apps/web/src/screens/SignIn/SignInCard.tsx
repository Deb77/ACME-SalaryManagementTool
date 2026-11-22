import type { ReactNode } from 'react';
import { Logo } from '../../components';
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
          <Logo className={styles.logo} />
          ACME People
        </div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lead}>{lead}</p>
        {children}
      </div>
    </main>
  );
}
