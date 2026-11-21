import { IconChevronLeft } from '@tabler/icons-react';
import {
  AppLink,
  FileDropzone,
  Notice,
  PageHeader,
  PageSkeleton,
  Stepper,
  TrayCard,
  type FileRejection,
} from '../../components';
import { useOptionalSession } from '../../session/SessionContext';
import styles from './Import.module.css';
import { IMPORT_STEPS, scopeNoteFor } from './Import.utils';

/** The import page's header and step bar, shared by ImportView and its skeleton. */
export function ImportHeader({ current }: { current: number }) {
  return (
    <>
      <PageHeader
        back={
          <AppLink href="/employees" className={styles.back}>
            <IconChevronLeft aria-hidden="true" size={18} />
            Employees
          </AppLink>
        }
        title="Import from Excel"
        description="Bring your existing sheet in as it is. Nothing changes until you confirm."
      />
      <div className={styles.steps}>
        <Stepper label="Import progress" steps={IMPORT_STEPS} current={current} />
      </div>
    </>
  );
}

/** Step 1: the drop zone for the sheet. */
export function UploadCard({
  busy = false,
  onFileSelected = () => {},
  onFileRejected,
}: {
  busy?: boolean;
  onFileSelected?: (file: File) => void;
  onFileRejected?: (file: File, reason: FileRejection) => void;
}) {
  return (
    <TrayCard
      title="Upload your file"
      footer="Up to 10,000 rows. Each row is matched by employee code, then email."
    >
      <FileDropzone
        accept=".xlsx,.csv"
        maxSizeBytes={5 * 1024 * 1024}
        disabled={busy}
        onFileSelected={onFileSelected}
        onFileRejected={onFileRejected}
      />
    </TrayCard>
  );
}

/**
 * The import page while its code downloads: the real header, step bar and upload card (the
 * first step has nothing to load), with the drop zone off until the page is ready.
 */
export function ImportSkeleton() {
  const session = useOptionalSession();
  const scoped = session ? session.me.role.countryScope !== 'all' : false;
  return (
    <PageSkeleton label="Loading import…" delayMs={0}>
      <ImportHeader current={0} />
      {session && scoped && (
        <Notice tone="info">{scopeNoteFor(session.me.countries.map(session.countryName))}</Notice>
      )}
      <UploadCard busy />
    </PageSkeleton>
  );
}
