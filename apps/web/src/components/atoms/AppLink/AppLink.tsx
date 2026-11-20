import { createElement, useContext, type ComponentType, type ReactNode } from 'react';
import { LinkComponentContext, type LinkComponentProps } from './AppLink.utils';

export type AppLinkProps = LinkComponentProps;

/** An internal link. Renders the app's router link when one is provided, otherwise `<a>`. */
export function AppLink(props: AppLinkProps) {
  const component = useContext(LinkComponentContext);
  // The link component comes from context and is stable for the app's lifetime.
  return createElement(component ?? 'a', props);
}

export interface LinkProviderProps {
  component: ComponentType<LinkComponentProps>;
  children: ReactNode;
}

export function LinkProvider({ component, children }: LinkProviderProps) {
  return (
    <LinkComponentContext.Provider value={component}>{children}</LinkComponentContext.Provider>
  );
}
