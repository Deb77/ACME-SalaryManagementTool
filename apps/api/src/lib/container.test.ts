import { describe, expect, it } from 'vitest';
import { Container } from './container.js';

interface Registry {
  greeting: string;
  greeter: { greet: () => string };
  a: number;
  b: number;
}

describe('Container', () => {
  it('resolves dependencies lazily and once', () => {
    let built = 0;
    const c = new Container<Registry>()
      .register('greeter', (r) => {
        built += 1;
        return { greet: () => `${r.resolve('greeting')}, world` };
      })
      .register('greeting', () => 'Hello');
    expect(built).toBe(0);
    expect(c.resolve('greeter').greet()).toBe('Hello, world');
    expect(c.resolve('greeter')).toBe(c.resolve('greeter'));
    expect(built).toBe(1);
  });

  it('lets tests override an entry before first use', () => {
    const c = new Container<Registry>().register('greeting', () => 'Hello');
    c.override('greeting', () => 'Hi');
    expect(c.resolve('greeting')).toBe('Hi');
    expect(() => c.override('greeting', () => 'Hey')).toThrow(/already resolved/);
  });

  it('reports missing registrations, duplicates and cycles', () => {
    const c = new Container<Registry>()
      .register('a', (r) => r.resolve('b'))
      .register('b', (r) => r.resolve('a'));
    expect(() => c.resolve('a')).toThrow(/cycle: a -> b -> a/);
    expect(() => c.resolve('greeting')).toThrow(/Nothing is registered/);
    expect(() => c.register('a', () => 1)).toThrow(/already registered/);
  });
});
