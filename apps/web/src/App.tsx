import { BrowserRouter } from 'react-router';
import { RouterLink } from './app/RouterLink';
import { AppRoutes } from './app/Routes';
import { ErrorBoundary, LinkProvider } from './components';
import { SessionProvider } from './session/SessionProvider';
import { ThemeProvider } from './theme';

export function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <LinkProvider component={RouterLink}>
            <SessionProvider>
              <AppRoutes />
            </SessionProvider>
          </LinkProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
