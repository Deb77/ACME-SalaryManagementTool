import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { BootSkeleton } from './app/BootSkeleton';
import { RouterLink } from './app/RouterLink';
import { AppRoutes } from './app/Routes';
import { ErrorBoundary, LinkProvider } from './components';
import { SessionProvider } from './session/SessionProvider';
import { ThemeProvider } from './theme';

const SignInScreen = lazy(() =>
  import('./screens/SignIn/SignInScreen').then((m) => ({ default: m.SignInScreen })),
);
const HelpScreen = lazy(() =>
  import('./screens/Help/HelpScreen').then((m) => ({ default: m.HelpScreen })),
);
const AcceptInviteScreen = lazy(() =>
  import('./screens/SignIn/AcceptInviteScreen').then((m) => ({ default: m.AcceptInviteScreen })),
);

export function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <LinkProvider component={RouterLink}>
            <Suspense fallback={<BootSkeleton />}>
              <Routes>
                {/* Public pages: no session yet. */}
                <Route path="sign-in" element={<SignInScreen />} />
                <Route path="accept-invite" element={<AcceptInviteScreen />} />
                {/* Help is public so a link to it can be shared with anyone. */}
                <Route path="help" element={<HelpScreen />} />
                <Route path="help/:topic" element={<HelpScreen />} />
                <Route
                  path="*"
                  element={
                    <SessionProvider>
                      <AppRoutes />
                    </SessionProvider>
                  }
                />
              </Routes>
            </Suspense>
          </LinkProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
