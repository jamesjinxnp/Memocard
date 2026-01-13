import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores';
import Dashboard from './pages/Dashboard';
import Study from './pages/Study';
import Login from './pages/Login';
import BrowseVocabulary from './pages/BrowseVocabulary';
import DeckPage from './pages/DeckPage';
import Settings from './pages/Settings';
import AnalyticsPage from './pages/AnalyticsPage';
import './App.css';

const queryClient = new QueryClient();

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/browse"
            element={
              <ProtectedRoute>
                <BrowseVocabulary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/deck/:deckId"
            element={
              <ProtectedRoute>
                <DeckPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/study/:mode"
            element={
              <ProtectedRoute>
                <Study />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

