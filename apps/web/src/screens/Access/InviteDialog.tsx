import {
  inviteUserRequestSchema,
  type CountryInfo,
  type InviteUserRequest,
  type Me,
  type Role,
} from '@acme/shared';
import { useState } from 'react';
import { ChoiceChips, Dialog, FormField, Notice, PillButton } from '../../components';
import { canAssignRole } from '../../session/permissions';
import form from '../shared/form.module.css';
import { zodFieldErrors } from '../shared/formErrors';
import styles from './Access.module.css';

export interface InviteDialogProps {
  me: Me;
  roles: readonly Role[];
  countries: readonly CountryInfo[];
  saving?: boolean;
  error?: string;
  /** Set after the invite is created: the link is shown once (decision #25). */
  inviteUrl?: string;
  onInvite: (body: InviteUserRequest) => void;
  onClose: () => void;
}

/** Invite an HR user with a role (and countries for a scoped role); the link is copied by hand. */
export function InviteDialog({
  me,
  roles,
  countries,
  saving = false,
  error,
  inviteUrl,
  onInvite,
  onClose,
}: InviteDialogProps) {
  const offered = roles.filter((role) => canAssignRole(me, role));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState(
    offered.find((r) => r.countryScope === 'assigned')?.id ?? offered[0]?.id ?? '',
  );
  const [chosen, setChosen] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const scoped = roles.find((r) => r.id === roleId)?.countryScope === 'assigned';

  const submit = () => {
    const parsed = inviteUserRequestSchema.safeParse({
      name,
      email,
      roleId,
      countries: scoped ? chosen : [],
    });
    const fieldErrors = parsed.success ? {} : zodFieldErrors(parsed.error);
    if (scoped && chosen.length === 0) fieldErrors.countries = 'Choose at least one country';
    setErrors(fieldErrors);
    if (parsed.success && Object.keys(fieldErrors).length === 0) onInvite(parsed.data);
  };

  if (inviteUrl) {
    return (
      <Dialog
        open
        title="Invite created"
        onClose={onClose}
        actions={
          <PillButton tone="primary" onClick={onClose}>
            Done
          </PillButton>
        }
      >
        <div className={form.form}>
          <Notice tone="info" title="Copy this link now">
            Send it to {name || 'them'} yourself. It is shown once and expires in 72 hours.
          </Notice>
          <code className={styles.inviteUrl}>{inviteUrl}</code>
          <div>
            <PillButton
              onClick={() => {
                void navigator.clipboard?.writeText(inviteUrl).then(() => setCopied(true));
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </PillButton>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      title="Invite person"
      onClose={onClose}
      busy={saving}
      actions={
        <>
          <PillButton onClick={onClose} disabled={saving}>
            Cancel
          </PillButton>
          <PillButton tone="primary" loading={saving} onClick={submit}>
            Create invite
          </PillButton>
        </>
      }
    >
      <div className={form.form}>
        <FormField label="Name" required error={errors.name}>
          {(control) => (
            <input
              {...control}
              className={form.control}
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
          )}
        </FormField>
        <FormField label="Work email" required error={errors.email}>
          {(control) => (
            <input
              {...control}
              type="email"
              className={form.control}
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
          )}
        </FormField>
        <FormField label="Role" required error={errors.roleId}>
          {(control) => (
            <select
              {...control}
              className={form.control}
              value={roleId}
              onChange={(e) => setRoleId(e.currentTarget.value)}
            >
              {offered.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
        {scoped && (
          <ChoiceChips
            legend="Countries they can see and edit"
            options={countries.map((c) => ({
              value: c.code,
              label: c.name,
              disabled: me.role.countryScope !== 'all' && !me.countries.includes(c.code),
            }))}
            value={chosen}
            onChange={setChosen}
            error={errors.countries}
          />
        )}
        {error && (
          <p role="alert" className={form.error}>
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
