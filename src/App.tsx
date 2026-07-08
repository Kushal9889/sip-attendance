import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { BatchDetail } from './pages/BatchDetail';
import { TakeAttendance } from './pages/TakeAttendance';
import { CalendarPage } from './pages/CalendarPage';
import { Reports } from './pages/Reports';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading…</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
      <Route path="/batch/:batchId" element={<AuthGuard><BatchDetail /></AuthGuard>} />
      <Route path="/attendance/:batchId/:date" element={<AuthGuard><TakeAttendance /></AuthGuard>} />
      <Route path="/calendar" element={<AuthGuard><CalendarPage /></AuthGuard>} />
      <Route path="/reports" element={<AuthGuard><Reports /></AuthGuard>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
