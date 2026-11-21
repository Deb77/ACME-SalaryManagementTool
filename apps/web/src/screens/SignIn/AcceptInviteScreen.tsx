import { passwordSchema } from '@acme/shared';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { describeError, fieldErrors } from '../../api/client';
import { acceptInvite, getInviteInfo } from '../../api/endpoints';
import { useResource } from '../../api/useResource';
import { ErrorState, FormField, LoadingState, PillButton } from '../../components';
import form from '../shared/form.module.css';
import { SignInCard } from './SignInCard';
import styles from './SignIn.module.css';

/** The token is in the URL fragment (`#token=…`), so it never reaches server logs. */
function tokenFromHash(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token') ?? '';
}

/** Invite and password-reset links: choose a password, then go straight in. */
export function AcceptInviteScreen() {
  const navigate = useNavigate();
  const [token] = useState(() => tokenFromHash(window.location.hash));
  const invite = useResource(`invite:${token}`, (signal) => getInviteInfo(token, { signal }));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token || invite.status === 'error') {
    return (
      <SignInCard
        title="This link does not work"
        lead="It may have expired (links last 72 hours) or been used already."
      >
        <ErrorState
          title="Ask Global HR for a new link"
          description={
            token
              ? describeError(invite.error)
              : 'The link is incomplete. Copy the whole link and try again.'
          }
        />
      </SignInCard>
    );
  }
  if (invite.status !== 'success' || !invite.data) {
    return (
      <SignInCard title="Checking your link" lead="One moment.">
        <LoadingState label="Checking your link" />
      </SignInCard>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    const next: Record<string, string> = {};
    if (!parsed.success)
      next.password = parsed.error.issues[0]?.message ?? 'Choose another password';
    if (confirm !== password) next.confirm = 'The passwords do not match';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    setFormError(null);
    try {
      await acceptInvite({ token, password });
      window.history.replaceState(null, '', window.location.pathname);
      navigate('/', { replace: true });
    } catch (caught) {
      const fields = fieldErrors(caught);
      if (fields.password) setErrors({ password: fields.password });
      else setFormError(describeError(caught));
      setBusy(false);
    }
  }

  const { name, email, isReset } = invite.data;
  return (
    <SignInCard
      title={isReset ? 'Choose a new password' : `Welcome, ${name.split(' ')[0]}`}
      lead={
        <>
          {isReset ? 'Set a new password for ' : 'Choose a password for '}
          <strong>{email}</strong>. Use at least 12 characters; a short sentence works well.
        </>
      }
    >
      <form className={form.form} onSubmit={submit} noValidate>
        {formError && (
          <p role="alert" className={styles.error}>
            {formError}
          </p>
        )}
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <FormField label="New password" error={errors.password} hint="12 to 128 characters">
          {(control) => (
            <input
              {...control}
              className={form.control}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          )}
        </FormField>
        <FormField label="Repeat password" error={errors.confirm}>
          {(control) => (
            <input
              {...control}
              className={form.control}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}
        </FormField>
        <PillButton tone="primary" type="submit" loading={busy} className={styles.submit}>
          {isReset ? 'Save and sign in' : 'Create account'}
        </PillButton>
      </form>
    </SignInCard>
  );
}
