import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { zodFieldErrors } from './formErrors';

const schema = z.object({
  name: z.string().min(1),
  age: z.int().positive(),
  nested: z.object({ city: z.string().min(1) }),
});

const failure = (input: unknown) => {
  const result = schema.safeParse(input);
  if (result.success) throw new Error('expected a failure');
  return result.error;
};

describe('zodFieldErrors', () => {
  it('keys the first message by top-level field', () => {
    const errors = zodFieldErrors(failure({ name: '', age: 3, nested: { city: '' } }));

    expect(Object.keys(errors).sort()).toEqual(['name', 'nested']);
  });

  it('replaces the schema message for mapped fields, by issue code', () => {
    const errors = zodFieldErrors(failure({ name: '', age: -1, nested: { city: 'Pune' } }), {
      name: () => 'Enter a name',
      age: (issue) => (issue.code === 'too_small' ? 'Enter an age above zero' : undefined),
    });

    expect(errors).toEqual({ name: 'Enter a name', age: 'Enter an age above zero' });
  });

  it('keeps the schema message when the mapping returns nothing', () => {
    const errors = zodFieldErrors(failure({ name: 'A', age: undefined, nested: { city: 'X' } }), {
      age: (issue) => (issue.code === 'too_small' ? 'Enter an age above zero' : undefined),
    });

    expect(errors.age).toMatch(/expected number/);
  });
});
