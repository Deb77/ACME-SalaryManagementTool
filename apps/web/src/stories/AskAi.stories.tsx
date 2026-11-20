import type { Story } from '@ladle/react';
import { ChatMessage, MoneyText, QuerySteps } from '../components';
import { querySteps } from './sampleData';

export default { title: 'Organisms / Ask AI' };

export const Conversation: Story = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
    <ChatMessage from="user">
      What do we pay Data Analysts in India compared with the US and UK?
    </ChatMessage>
    <ChatMessage from="assistant">
      <QuerySteps title="Worked through 3 steps · 1.4s" steps={querySteps} />
      <p style={{ margin: 0 }}>
        Data Analysts in India have a median salary of{' '}
        <MoneyText amountMinor={126_000_000} currency="INR" strong />. In the US the median is{' '}
        <MoneyText amountMinor={9_200_000} currency="USD" strong />.
      </p>
    </ChatMessage>
  </div>
);
