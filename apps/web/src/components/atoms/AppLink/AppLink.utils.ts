import { createContext, type AnchorHTMLAttributes, type ComponentType } from 'react';

export interface LinkComponentProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

/**
 * The element every internal link renders. Defaults to a plain `<a>`; the app swaps in a
 * router-aware link (client-side navigation) through `LinkProvider`, so components never
 * import the router and work unchanged in Ladle and tests.
 */
export const LinkComponentContext = createContext<ComponentType<LinkComponentProps> | null>(null);
