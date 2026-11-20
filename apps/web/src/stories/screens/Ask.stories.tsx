import type { Story } from '@ladle/react';
import { useState } from 'react';
import type { AskTurn } from '../../screens/Ask/Ask.utils';
import { AskView, type AskViewProps } from '../../screens/Ask/AskView';
import { querySteps } from '../sampleData';
import { sampleDraft, sampleMeCountry, sampleMeGlobal } from '../screenSampleData';
import { ScreenFrame } from './ScreenFrame';

export default { title: 'Screens / Ask AI' };

const answered: AskTurn = {
  id: 't1',
  question:
    'Which Data Analysts in India are paid below the 10th percentile, and what would fix it?',
  answer:
    'Nine Data Analysts in India earn below the 10th percentile (₹8,50,000). Seven of them have been with ACME for more than three years.\n\nI drafted raises that bring each of them to the 25th percentile. Nothing is saved until you review each one.',
  steps: querySteps.map((step, index) => ({ ...step, callId: `c${index}` })),
  drafts: [sampleDraft],
  status: 'done',
};

function Ask(overrides: Partial<AskViewProps>) {
  const [question, setQuestion] = useState('');
  return (
    <AskView
      turns={[]}
      question={question}
      onQuestionChange={setQuestion}
      onAsk={() => {}}
      onNewChat={() => {}}
      busy={false}
      canReviewDrafts
      savedDraftIds={new Set()}
      onReviewDrafts={() => {}}
      scopeLabel="all countries"
      {...overrides}
    />
  );
}

export const NewChat: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/ask">
    <Ask />
  </ScreenFrame>
);
NewChat.storyName = 'New chat (suggestions)';
NewChat.meta = { fullscreen: true };

export const AnswerWithDrafts: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/ask">
    <Ask turns={[answered]} />
  </ScreenFrame>
);
AnswerWithDrafts.storyName = 'Answer with drafts to approve';
AnswerWithDrafts.meta = { fullscreen: true };

export const Streaming: Story = () => (
  <ScreenFrame me={sampleMeCountry} path="/ask">
    <Ask
      scopeLabel="India"
      busy
      turns={[
        {
          ...answered,
          answer: 'Nine Data Analysts in India earn below',
          steps: answered.steps.slice(0, 1),
          drafts: [],
          status: 'streaming',
        },
      ]}
    />
  </ScreenFrame>
);
Streaming.storyName = 'Streaming, Country HR';
Streaming.meta = { fullscreen: true };

export const Failed: Story = () => (
  <ScreenFrame me={sampleMeGlobal} path="/ask">
    <Ask
      canReviewDrafts={false}
      turns={[
        answered,
        {
          id: 't2',
          question: 'And in Brazil?',
          answer: '',
          steps: [],
          drafts: [],
          status: 'error',
          error: 'The assistant is unavailable. Try again in a minute.',
        },
      ]}
    />
  </ScreenFrame>
);
Failed.storyName = 'Error, drafts not reviewable';
Failed.meta = { fullscreen: true };
