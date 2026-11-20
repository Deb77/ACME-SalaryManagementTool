import { PageSkeleton, Skeleton } from '../../components';
import { useOptionalSession } from '../../session/SessionContext';
import { askScopeLabel } from './Ask.utils';
import { AskView } from './AskView';

/**
 * Ask AI while its code downloads. The page loads no data, so this is the real empty
 * conversation (title, suggestions and question box) rather than an approximation.
 */
export function AskSkeleton() {
  // Before the session loads (first page load), the scope is a placeholder.
  const session = useOptionalSession();
  return (
    <PageSkeleton label="Loading Ask AI…">
      <AskView
        turns={[]}
        question=""
        onQuestionChange={() => {}}
        onAsk={() => {}}
        onNewChat={() => {}}
        busy={false}
        canReviewDrafts={session?.can('salary:change') ?? false}
        savedDraftIds={new Set()}
        onReviewDrafts={() => {}}
        scopeLabel={
          session ? (
            askScopeLabel(session.me, session.countryName)
          ) : (
            <Skeleton inline width={90} height={12} />
          )
        }
      />
    </PageSkeleton>
  );
}
