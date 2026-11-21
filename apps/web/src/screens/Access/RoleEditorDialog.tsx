import {
  createRoleRequestSchema,
  updateRoleRequestSchema,
  type CountryScope,
  type CreateRoleRequest,
  type Me,
  type Permission,
  type PermissionInfo,
  type Role,
  type UpdateRoleRequest,
} from '@acme/shared';
import { useState } from 'react';
import { ChoiceChips, Dialog, FormField, PillButton } from '../../components';
import { permissionLabels } from '../../lib/format';
import { withoutPermission, withRequirements } from '../../session/permissions';
import form from '../shared/form.module.css';
import { requiredTextMessage, tooLongMessage, zodFieldErrors } from '../shared/formErrors';
import { useFocusFirstError } from '../shared/useFocusFirstError';

export type RoleEditorSubmit =
  { mode: 'create'; body: CreateRoleRequest } | { mode: 'edit'; body: UpdateRoleRequest };

export interface RoleEditorDialogProps {
  me: Me;
  /** The role being edited; omit to create one. */
  role?: Role;
  catalogue: readonly PermissionInfo[];
  saving?: boolean;
  error?: string;
  onSubmit: (submit: RoleEditorSubmit) => void;
  onCancel: () => void;
}

/**
 * Create or edit a role. Only permissions you hold can be granted, requirements are added
 * automatically, and the country scope is fixed once the role exists (docs/auth.md).
 */
export function RoleEditorDialog({
  me,
  role,
  catalogue,
  saving = false,
  error,
  onSubmit,
  onCancel,
}: RoleEditorDialogProps) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [countryScope, setCountryScope] = useState<CountryScope>(role?.countryScope ?? 'assigned');
  const [permissions, setPermissions] = useState<Permission[]>(
    role?.permissions ?? ['employees:read'],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const canGrantAll = me.role.countryScope === 'all';
  const { ref: fieldsRef, focusFirstError } = useFocusFirstError<HTMLDivElement>();

  const change = (next: Permission[]) => {
    const added = next.find((p) => !permissions.includes(p));
    const removed = permissions.find((p) => !next.includes(p));
    if (added) setPermissions(withRequirements([...permissions, added]));
    else if (removed) setPermissions(withoutPermission(permissions, removed));
  };

  const submit = () => {
    const parsed = role
      ? updateRoleRequestSchema.safeParse({
          name,
          description: description || undefined,
          permissions,
          version: role.version,
        })
      : createRoleRequestSchema.safeParse({
          name,
          description: description || undefined,
          countryScope,
          permissions,
        });
    if (!parsed.success) {
      setErrors(
        zodFieldErrors(parsed.error, {
          name: requiredTextMessage('name', 60),
          description: tooLongMessage('description', 200),
          permissions: () => 'Choose at least one permission',
        }),
      );
      return focusFirstError();
    }
    setErrors({});
    onSubmit(
      role
        ? { mode: 'edit', body: parsed.data as UpdateRoleRequest }
        : { mode: 'create', body: parsed.data as CreateRoleRequest },
    );
  };

  return (
    <Dialog
      open
      title={role ? `Edit ${role.name}` : 'New role'}
      onClose={onCancel}
      busy={saving}
      width={640}
      footerNote="Changes apply to everyone with this role"
      actions={
        <>
          <PillButton onClick={onCancel} disabled={saving}>
            Cancel
          </PillButton>
          <PillButton tone="primary" loading={saving} onClick={submit}>
            {role ? 'Save role' : 'Create role'}
          </PillButton>
        </>
      }
    >
      <div ref={fieldsRef} className={form.form}>
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
        <FormField label="Description" optional error={errors.description}>
          {(control) => (
            <input
              {...control}
              className={form.control}
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
            />
          )}
        </FormField>
        <fieldset className={form.fieldset}>
          <legend className={form.legend}>Country scope</legend>
          <div className={form.radioRow}>
            <label className={form.radio}>
              <input
                type="radio"
                name="scope"
                checked={countryScope === 'assigned'}
                disabled={role !== undefined}
                onChange={() => setCountryScope('assigned')}
              />
              Assigned countries
            </label>
            <label className={form.radio}>
              <input
                type="radio"
                name="scope"
                checked={countryScope === 'all'}
                disabled={role !== undefined || !canGrantAll}
                onChange={() => setCountryScope('all')}
              />
              All countries
            </label>
          </div>
          <p className={form.note}>
            {role
              ? 'The scope is fixed once a role exists. Create a new role to change it.'
              : canGrantAll
                ? 'Fixed once the role is created.'
                : 'Only someone with access to all countries can create an all-countries role.'}
          </p>
        </fieldset>
        <ChoiceChips
          legend="Permissions"
          columns={1}
          options={catalogue.map((info) => ({
            value: info.key,
            label: permissionLabels[info.key],
            detail: info.key,
            disabled: !me.permissions.includes(info.key),
          }))}
          value={permissions}
          onChange={change}
          hint="Ticking a permission adds what it needs. You can only grant permissions you hold."
          error={errors.permissions}
        />
        {error && (
          <p role="alert" className={form.error}>
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
