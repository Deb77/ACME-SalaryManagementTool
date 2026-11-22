import { describe, expect, it } from 'vitest';
import { HELP_TOPICS, helpTopicBySlug, searchHelpTopics } from './helpTopics';

describe('help topics', () => {
  it('gives every topic a unique slug', () => {
    const slugs = HELP_TOPICS.map((topic) => topic.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('finds a topic by its slug', () => {
    expect(helpTopicBySlug('change-pay')?.title).toBe('Change someone’s pay');
    expect(helpTopicBySlug('nope')).toBeUndefined();
  });

  it('lists every topic for an empty search', () => {
    expect(searchHelpTopics('  ')).toBe(HELP_TOPICS);
  });

  it('matches every word, ignoring case and bold marks', () => {
    expect(searchHelpTopics('UNDO import').map((topic) => topic.slug)).toEqual(['import']);
    // "Export as CSV" is written **Export as CSV** in the steps.
    expect(searchHelpTopics('export as csv').map((topic) => topic.slug)).toContain('find-people');
  });

  it('searches the common questions too', () => {
    expect(searchHelpTopics('lost my invite').map((topic) => topic.slug)).toEqual(['questions']);
  });
});
