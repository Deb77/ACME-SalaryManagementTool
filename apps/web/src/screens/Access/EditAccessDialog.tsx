import type { CountryInfo, Me, Role, User } from '@acme/shared';
import { useState } from 'react';
import { ChoiceChips, Dialog, PersonCell, PillButton } from '../../components';
import { canAssignRole } from '../../session/permissions';
import form from '../shared/form.module.css';
import styles from './Access.module.css';

export interface EditAccessDialogProps {
  me: Me;
  user: User;
  roles: readonly Role[];
  countries: readonly CountryInfo[];
  /** The last active Global HR keeps their role and access (escalation rule 4). */
  isLastGlobalHr: boolean;
  saving?: boolean;
  error?: string;
  onSave: (change: { roleId: string; countries: string[] }) => void;
  onRemoveAccess: () => void;
  onCancel: () => void;
}

/** Change a person's role and countries; only roles you could hold yourself are offered. */
export function EditAccessDialog({
  me,
  user,
  roles,
  countries,
  isLastGlobalHr,
  saving = false,
  error,
  onSave,
  onRemoveAccess,
  onCancel,
}: EditAccessDialogProps) {
  const [roleId, setRoleId] = useState(user.role.id);
  const [chosen, setChosen] = useState<string[]>(user.countries);
  const [countryError, setCountryError] = useState<string>();
  const offered = roles.filter((role) => role.id === user.role.id || canAssignRole(me, role));
  const role = roles.find((r) => r.id === roleId);
  const scoped = role?.countryScope === 'assigned';

  const save = () => {
    if (scoped && chosen.length === 0) {
      setCountryError('Choose at least one country');
      return;
    }
    onSave({ roleId, countries: scoped ? chosen : [] });
  };

  return (
    <Dialog
      open
      title="Edit access"
      onClose={onCancel}
      busy={saving}
      footerNote="Changes apply on their next request"
      actions={
        <>
          <PillButton onClick={onCancel} disabled={saving}>
            Cancel
          </PillButton>
          <PillButton tone="primary" loading={saving} onClick={save}>
            Save
          </PillButton>
        </>
      }
    >
      <div className={form.form}>
        <PersonCell name={user.name} detail={user.email} wrapDetail />
        <fieldset className={form.fieldset} disabled={isLastGlobalHr}>
          <legend className={form.legend}>Role</legend>
          <div className={form.radioRow}>
            {offered.map((option) => (
              <label key={option.id} className={form.radio}>
                <input
                  type="radio"
                  name="role"
                  value={option.id}
                  checked={roleId === option.id}
                  onChange={() => setRoleId(option.id)}
                />
                {option.name}
              </label>
            ))}
          </div>
          {isLastGlobalHr && (
            <p className={form.note}>
              {user.name} is the last active Global HR, so someone else must hold that role first.
            </p>
          )}
        </fieldset>
        {scoped && (
          <ChoiceChips
            legend="Countries this person can see and edit"
            options={countries.map((c) => ({
              value: c.code,
              label: c.name,
              disabled: me.role.countryScope !== 'all' && !me.countries.includes(c.code),
            }))}
            value={chosen}
            onChange={(next) => {
              setChosen(next);
              setCountryError(undefined);
            }}
            error={countryError}
          />
        )}
        <div className={styles.preview}>
          {scoped
            ? `They will see employees in ${chosen.length} ${chosen.length === 1 ? 'country' : 'countries'}.`
            : 'They will see employees in every country.'}{' '}
          Insights, exports and Ask AI answers are limited to the same countries.
        </div>
        {error && (
          <p role="alert" className={form.error}>
            {error}
          </p>
        )}
        <div>
          <PillButton tone="danger" disabled={isLastGlobalHr || saving} onClick={onRemoveAccess}>
            Remove access
          </PillButton>
        </div>
      </div>
    </Dialog>
  );
}
