import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <main className="login-card">
        <div className="mb-9 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-[#102a43] text-xl font-bold text-white">A</div>
          <h1 className="text-4xl font-bold tracking-[-0.03em] text-[#102a43]">ALL IN ONE <span className="text-[#2f78a0]">POS</span></h1>
          <p className="mt-2 text-sm font-bold uppercase tracking-[0.18em] text-[#667789]">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600 animate-shake">
                {error}
              </div>
            )}
            {location.state?.notice && (
              <div role="status" className="rounded-xl border border-green-100 bg-green-50 p-4 text-sm font-semibold text-green-700">
                {location.state.notice}
              </div>
            )}

            <div className="space-y-5">
                <div>
                  <label className="mb-2 ml-1 block text-xs font-black uppercase tracking-widest text-[#738087]">Username, employee ID, or email</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-md border-2 border-[#e2e8ee] bg-[#f8fafc] px-5 py-4 text-base font-bold text-[#102a43] outline-none transition-all placeholder:text-[#9aa8b5] focus:border-[#2f78a0] focus:bg-white"
                    placeholder="Enter your login ID"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 ml-1 block text-xs font-black uppercase tracking-widest text-[#738087]">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border-2 border-[#e2e8ee] bg-[#f8fafc] px-5 py-4 text-base font-bold text-[#102a43] outline-none transition-all placeholder:text-[#9aa8b5] focus:border-[#2f78a0] focus:bg-white"
                    placeholder="Enter your password"
                    required
                  />
                </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[#102a43] py-5 text-base font-black uppercase tracking-widest text-white shadow-lg shadow-[#102a43]/20 transition-all hover:bg-[#1b4668] active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Secure Login'}
            </button>

        </form>

        <p className="mt-8 text-center text-[11px] font-bold uppercase tracking-[0.15em] text-[#738087]">
          © {new Date().getFullYear()} SIVARA GROUP · All Rights Reserved
        </p>
      </main>
    </div>
  );
}
