/**
 * A small typed inversion-of-control container (decision #31).
 *
 * Each dependency is registered once, by name, with a factory that receives the container and
 * resolves its own dependencies from it. Classes only declare what they need in their
 * constructor; the composition root (`../container.ts`) decides which implementation each name
 * gets. Tests swap one entry (a fixed clock, a fake hasher) with `override` without touching the
 * code under test.
 *
 * Instances are singletons per container and are created lazily on first `resolve`, so
 * registration order does not matter. A cycle fails loudly instead of overflowing the stack.
 */
export type Factory<R, K extends keyof R> = (container: Container<R>) => R[K];

export class Container<R> {
  private readonly factories = new Map<keyof R, Factory<R, keyof R>>();
  private readonly instances = new Map<keyof R, unknown>();
  private readonly resolving = new Set<keyof R>();

  register<K extends keyof R>(key: K, factory: Factory<R, K>): this {
    if (this.factories.has(key)) throw new Error(`"${String(key)}" is already registered`);
    this.factories.set(key, factory as Factory<R, keyof R>);
    return this;
  }

  /** Replaces a registration (tests). Must happen before the entry is first resolved. */
  override<K extends keyof R>(key: K, factory: Factory<R, K>): this {
    if (this.instances.has(key)) {
      throw new Error(`"${String(key)}" was already resolved; override it before first use`);
    }
    this.factories.set(key, factory as Factory<R, keyof R>);
    return this;
  }

  resolve<K extends keyof R>(key: K): R[K] {
    if (this.instances.has(key)) return this.instances.get(key) as R[K];
    const factory = this.factories.get(key);
    if (!factory) throw new Error(`Nothing is registered for "${String(key)}"`);
    if (this.resolving.has(key)) {
      throw new Error(
        `Dependency cycle: ${[...this.resolving, key].map((k) => String(k)).join(' -> ')}`,
      );
    }
    this.resolving.add(key);
    try {
      const instance = factory(this) as R[K];
      this.instances.set(key, instance);
      return instance;
    } finally {
      this.resolving.delete(key);
    }
  }
}
