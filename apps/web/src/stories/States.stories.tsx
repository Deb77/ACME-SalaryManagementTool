import type { Story } from '@ladle/react';
import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState, PageSkeleton, TrayCard } from '../components';
import { grid } from './layout';

export default { title: 'Molecules / States' };

export const LoadingEmptyError: Story = () => {
  const [retries, setRetries] = useState(0);
  return (
    <div style={grid(260)}>
      <TrayCard title="Loading">
        <LoadingState label="Loading employees…" shape="table" rows={3} delayMs={0} />
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

export const Skeletons: Story = () => (
  <div style={grid(320)}>
    <TrayCard title="table">
      <LoadingState shape="table" rows={4} delayMs={0} />
    </TrayCard>
    <TrayCard title="list">
      <LoadingState shape="list" rows={4} delayMs={0} />
    </TrayCard>
    <TrayCard title="chart">
      <LoadingState shape="chart" delayMs={0} />
    </TrayCard>
    <TrayCard title="lines / answer">
      <LoadingState shape="lines" rows={4} delayMs={0} />
    </TrayCard>
  </div>
);

export const PageSkeletons: Story<{
  variant: 'list' | 'detail' | 'form' | 'dashboard' | 'cards';
}> = ({ variant }) => <PageSkeleton variant={variant} delayMs={0} />;
PageSkeletons.args = { variant: 'list' };
PageSkeletons.argTypes = {
  variant: {
    options: ['list', 'detail', 'form', 'dashboard', 'cards'],
    control: { type: 'radio' },
  },
};
