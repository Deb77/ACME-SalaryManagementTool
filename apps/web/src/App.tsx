import { ErrorBoundary } from './components';
import { ThemeProvider } from './theme';

export function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <main>
          <h1>ACME Salary Management</h1>
        </main>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
