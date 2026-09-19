import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth';

const USERNAME_HINT =
  '5–16 characters, letters and numbers only, must start with a letter (no spaces or special characters).';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const data = await register(username.trim(), password);
      setSuccess(data.message || 'Registration successful. Wait for admin approval.');
      setUsername('');
      setPassword('');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-brand">
          <span className="brand-mark">SB</span>
          <h1>Scambot</h1>
        </div>
        <p className="auth-lead">Create an account. An administrator must approve it before you can sign in.</p>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              minLength={5}
              maxLength={16}
              required
            />
          </label>
          <p className="field-hint">{USERNAME_HINT}</p>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          {success && <p className="form-success">{success}</p>}
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Registering…' : 'Register'}
          </button>
        </form>
        <p className="auth-footer">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
