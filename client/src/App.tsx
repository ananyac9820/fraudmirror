import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAppSelector } from './store';
import Layout from './components/Layout';
import { canAccess } from './components/nav';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function Protected({ children }: { children: ReactNode }) {
  const { token, user } = useAppSelector((s) => s.auth);
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!canAccess(location.pathname, user?.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
