import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { ChatMessage } from './ChatMessage';

describe('ChatMessage', () => {
  it('labels the user question for screen readers', () => {
    render(<ChatMessage from="user">What do we pay Data Analysts?</ChatMessage>);

    expect(screen.getByText(/You asked:/).parentElement).toHaveTextContent(
      'You asked: What do we pay Data Analysts?',
    );
  });

  it('wraps the assistant answer in a named article', () => {
    render(<ChatMessage from="assistant">The median is ₹12,60,000.</ChatMessage>);

    expect(screen.getByRole('article', { name: 'Assistant answer' })).toHaveTextContent(
      'The median is ₹12,60,000.',
    );
  });
});
