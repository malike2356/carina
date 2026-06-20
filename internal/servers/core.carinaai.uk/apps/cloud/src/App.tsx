import { Navigate, Route, Routes } from 'react-router-dom';
import { getToken } from './api/client';
import { AppLayout } from './components/AppLayout';
import { BillingPage } from './pages/BillingPage';
import { DashboardPage } from './pages/DashboardPage';
import { KeysPage } from './pages/KeysPage';
import { LauncherPage } from './pages/LauncherPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ScoutPage } from './pages/ScoutPage';
import { TerminalPage } from './pages/TerminalPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/launcher"
        element={<RequireAuth><LauncherPage /></RequireAuth>}
      />
      <Route
        element={(
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        )}
      >
        <Route path="/" element={<Navigate to="/launcher" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/terminal" element={<TerminalPage />} />
        <Route path="/settings/keys" element={<KeysPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/security" element={<ScoutPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/launcher" replace />} />
    </Routes>
  );
}
