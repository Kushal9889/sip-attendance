import type { ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  backTo?: string;
  rightAction?: ReactNode;
}

export function Layout({ children, title, backTo, rightAction }: LayoutProps) {
  const { pathname } = useLocation();

  return (
    <div className="app-shell">
      {/* Desktop Header — Hidden on Mobile */}
      <header className="desktop-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🔴</span>
          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-title)' }}>
            SIP Abacus Manager
          </span>
        </div>
        <nav className="desktop-nav">
          <Link to="/" className={`desktop-nav-link ${pathname === '/' ? 'active' : ''}`}>
            🏠 Home
          </Link>
          <Link to="/calendar" className={`desktop-nav-link ${pathname === '/calendar' ? 'active' : ''}`}>
            📅 Calendar
          </Link>
          <Link to="/reports" className={`desktop-nav-link ${pathname === '/reports' ? 'active' : ''}`}>
            📊 Reports
          </Link>
        </nav>
      </header>

      {/* Page Header (Mobile/Tablet and detail page headers) */}
      {title && (
        <header className="page-header">
          {backTo && (
            <Link to={backTo} className="btn btn-ghost btn-sm" style={{ padding: '8px', minHeight: 40 }}>
              ← Back
            </Link>
          )}
          <h1 style={{ fontSize: '18px', fontWeight: 700 }}>{title}</h1>
          {rightAction && <div>{rightAction}</div>}
        </header>
      )}

      <main className="page-content">
        {children}
      </main>

      {/* Mobile Floating Bottom Nav */}
      <nav className="bottom-nav">
        <Link
          to="/"
          className={`nav-item ${pathname === '/' ? 'active' : ''}`}
        >
          <span className="nav-icon">🏠</span>
          <span>Home</span>
        </Link>
        <Link
          to="/calendar"
          className={`nav-item ${pathname === '/calendar' ? 'active' : ''}`}
        >
          <span className="nav-icon">📅</span>
          <span>Calendar</span>
        </Link>
        <Link
          to="/reports"
          className={`nav-item ${pathname === '/reports' ? 'active' : ''}`}
        >
          <span className="nav-icon">📊</span>
          <span>Reports</span>
        </Link>
      </nav>
    </div>
  );
}
