import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccessMsg('Account created! You can now sign in.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">📚</div>
        <h1 className="login-title">SIP Attendance</h1>
        <p className="login-subtitle">Smart class manager for SIP Abacus teachers</p>

        {successMsg && (
          <div style={{
            background: 'var(--present-bg)', color: 'var(--present)',
            border: '1px solid var(--present-border)', borderRadius: 'var(--r-md)',
            padding: '12px', fontSize: 'var(--text-sm)', marginBottom: '16px', textAlign: 'center',
          }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input className="input" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="teacher@example.com" required autoComplete="email" />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="input" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password" required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={6} />
          </div>

          {error && (
            <div style={{
              color: 'var(--absent)', fontSize: 'var(--text-sm)',
              background: 'var(--absent-bg)', padding: '10px 12px',
              borderRadius: 'var(--r-sm)', border: '1px solid var(--absent-border)',
            }}>{error}</div>
          )}

          <button type="submit" className="btn btn-primary btn-full btn-lg"
            disabled={loading} style={{ marginTop: '4px' }}>
            {loading ? 'Please wait…' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button className="btn btn-ghost btn-sm"
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}>
            {isSignUp ? 'Already have an account? Sign in' : 'First time? Create an account'}
          </button>
        </div>

        <p style={{ marginTop: '24px', fontSize: '11px', color: 'var(--gray-400)', textAlign: 'center' }}>
          Your data is secure and private. Only you can access your records.
        </p>
      </div>
    </div>
  );
}
