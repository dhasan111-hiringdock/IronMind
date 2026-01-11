import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Shield } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (res.ok && data.success) {
          navigate('/dashboard');
          return;
        }
      } catch {
        void 0;
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [navigate]);

  const loginWithGoogle = () => {
    window.location.href = '/api/auth/google/start';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/50">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Login</h1>
              <p className="text-white/60 text-sm">Sign in to continue</p>
            </div>
        </div>

          <button
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-900 rounded-lg font-medium hover:bg-white/90 transition-colors"
          >
            Continue with Google
          </button>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/setup')}
              className="text-white/70 hover:text-white text-sm"
            >
              Or set up preferences first
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
