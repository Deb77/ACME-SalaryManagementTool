import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError, describeError } from '../../api/client';
import { signIn } from '../../api/endpoints';
import { AppLink, FormField, PillButton } from '../../components';
import form from '../shared/form.module.css';
import { rememberSignedIn } from '../../session/signedIn';
import { SignInCard } from './SignInCard';
import { safeNext } from './safeNext';
import styles from './SignIn.module.css';

/** Email and password sign-in (docs/auth.md). Every failure gets the same message. */
export function SignInScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn({ email: email.trim(), password });
      rememberSignedIn(true);
      navigate(safeNext(params.get('next')), { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.code === 'unauthenticated'
          ? 'That email and password do not match an active account.'
          : describeError(caught),
      );
      setBusy(false);
    }
  }

  return (
    <SignInCard title="Sign in" lead="Use the email your Global HR admin invited.">
      <form className={form.form} onSubmit={submit} noValidate>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <FormField label="Email">
          {(control) => (
            <input
              {...control}
              className={form.control}
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          )}
        </FormField>
        <FormField label="Password">
          {(control) => (
            <input
              {...control}
              className={form.control}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </FormField>
        <PillButton tone="primary" type="submit" loading={busy} className={styles.submit}>
          Sign in
        </PillButton>
      </form>
      <p className={styles.footnote}>
        Forgot your password? Ask Global HR for a new sign-in link.{' '}
        <AppLink href="/help">Help &amp; guide</AppLink>
      </p>
    </SignInCard>
  );
}
