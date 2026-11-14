import { useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FileText, GitBranch, Printer } from 'lucide-react';
import pbgLogoWhite from '../assets/logo-pbg-white.png';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../api';

export default function Login() {
  const { user, loading, login, devLogin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef(null);

  if (loading) return <div className="auth-shell" role="status">Memuat sesi...</div>;
  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (!username.trim() || password.length < 6) return;
    setSubmitting(true);
    setError('');
    try {
      await login(username.trim().toLowerCase(), password);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDevLogin = async (name) => {
    setError('');
    try {
      await devLogin(name);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const handleUsernameKeyDown = (event) => {
    if (event.key === 'Enter' && passwordRef.current) {
      event.preventDefault();
      passwordRef.current.focus();
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-brand" aria-label="Tentang Insetive Tracking">
        <div className="auth-brand-head">
          <span className="auth-mark" aria-hidden="true"><img src={pbgLogoWhite} alt="" className="w-full h-full object-contain" /></span>
          <span className="auth-brand-name">
            Insetive Tracking
            <small>Insentif Sales</small>
          </span>
        </div>

        <div className="auth-brand-body">
          <h2>Rekap insentif yang rapi, dari draft sampai final.</h2>
          <p className="auth-lead">
            Catat target, capaian, dan insentif per wilayah, sales, dan periode — lalu cetak
            dokumennya dalam format yang sudah disetujui.
          </p>
          <ul className="auth-points">
            <li>
              <span className="auth-point-icon" aria-hidden="true"><FileText size={16} /></span>
              <div><strong>Dokumen terkendali</strong><small>Draft, final, dan koreksi tercatat rapi.</small></div>
            </li>
            <li>
              <span className="auth-point-icon" aria-hidden="true"><GitBranch size={16} /></span>
              <div><strong>Struktur BM, SPV, Sales</strong><small>Data mengikuti hierarki tim yang sebenarnya.</small></div>
            </li>
            <li>
              <span className="auth-point-icon" aria-hidden="true"><Printer size={16} /></span>
              <div><strong>Siap dicetak</strong><small>Format perhitungan dan kwitansi dalam satu dokumen.</small></div>
            </li>
          </ul>
        </div>

        <p className="auth-brand-foot">Pulau Baru Group · Sales Incentive</p>
      </section>

      <section className="auth-form-panel">
        <form className="auth-card" onSubmit={submit} noValidate>
          <header className="auth-card-head">
            <h1>Masuk ke akun</h1>
            <p>Gunakan akun yang dibuat Super Admin.</p>
          </header>

          <label htmlFor="username">
            Username
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={handleUsernameKeyDown}
              autoComplete="username"
              autoFocus
              required
            />
          </label>

          <label htmlFor="password">
            Password
            <div className="password-wrapper">
              <Input
                ref={passwordRef}
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                minLength="6"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </Button>
            </div>
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <Button className="button primary" type="submit" disabled={submitting || !username.trim() || password.length < 6}>
            {submitting ? 'Memeriksa...' : 'Masuk'}
          </Button>

          {import.meta.env.DEV && (
            <div className="dev-login">
              <p className="subtitle">Masuk cepat (pengembangan)</p>
              {['super', 'officer', 'direksi'].map((name) => (
                <Button key={name} type="button" className="button" onClick={() => handleDevLogin(name)}>
                  Masuk sebagai {name}
                </Button>
              ))}
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
