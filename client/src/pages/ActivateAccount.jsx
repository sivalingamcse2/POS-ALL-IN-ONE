import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api';

export default function ActivateAccount() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [token] = useState(() => searchParams.get('token') || '');

  useEffect(() => {
    if (searchParams.has('token')) navigate('/activate', { replace: true });
  }, [navigate, searchParams]);

  const submit = async event => {
    event.preventDefault();
    setError('');
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await authApi.activate({ token, password });
      setComplete(true);
    } catch (activationError) {
      setError(activationError.response?.data?.error || 'Unable to set up this account.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="login-shell">
      <main className="login-card">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-[#102a43] text-xl font-bold text-white">S</div>
          <h1 className="text-3xl font-bold text-[#102a43]">Set up your account</h1>
          <p className="mt-2 text-sm text-[#667789]">Choose a strong password to activate your employee login.</p>
        </div>

        {complete ? (
          <div className="space-y-4 text-center">
            <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">Your password is set. You can now sign in.</p>
            <button type="button" onClick={() => navigate('/login')} className="btn btn-primary w-full">Go to sign in</button>
          </div>
        ) : !token ? (
          <div className="space-y-4">
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">This setup link is missing its token. Ask your administrator for a new link.</p>
            <button type="button" onClick={() => navigate('/login')} className="btn border border-gray-300 bg-white w-full">Return to sign in</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
            <label className="block text-sm font-semibold text-gray-700">
              New password
              <input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required className="input mt-1" />
              <span className="mt-1 block text-xs font-normal text-gray-500">Use at least 12 characters (up to 128).</span>
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              Confirm password
              <input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required className="input mt-1" />
            </label>
            <button type="submit" disabled={saving} className="btn btn-primary w-full disabled:opacity-50">{saving ? 'Activating…' : 'Set password & activate'}</button>
          </form>
        )}
      </main>
    </div>
  );
}
