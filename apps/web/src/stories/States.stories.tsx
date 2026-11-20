import type { Story } from '@ladle/react';
import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState, TrayCard } from '../components';
import { grid } from './layout';

export default { title: 'Molecules / States' };

export const LoadingEmptyError: Story = () => {
  const [retries, setRetries] = useState(0);
  return (
    <div style={grid(260)}>
      <TrayCard title="Loading">
        <LoadingState label="Loading employees…" />
      </TrayCard>
      <TrayCard title="Empty">
        <EmptyState
          title="No salary changes yet"
          description="The starting salary is the first entry."
        />
      </TrayCard>
      <TrayCard title="Error">
        <ErrorState
          title="Could not load insights"
          description={retries ? `Retried ${retries} time${retries === 1 ? '' : 's'}` : undefined}
          onRetry={() => setRetries((count) => count + 1)}
        />
      </TrayCard>
    </div>
  );
};
