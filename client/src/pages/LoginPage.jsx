import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Heart } from "lucide-react";
import { useAuth } from "../context/useAuth";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const ROLE_HOME = {
  STUDENT: () => "/student",
  MENTOR: () => "/mentor",
  SuperADMIN: () => "/admin/placements",
  AIGs: (user) => `/admin/${user.aigSlug}`,
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const buttonRef = useRef(null);

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isDevMode = import.meta.env.DEV;

  const handleSuccess = (user) => {
    const resolveHome = ROLE_HOME[user.role];
    navigate(resolveHome ? resolveHome(user) : "/unauthorized", { replace: true });
  };

  // Dev-mode: plain email form
  const handleDevSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setLoading(true);
    try {
      const user = await login({ email: email.trim() });
      handleSuccess(user);
    } catch (err) {
      setError(err.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  // Production: Google GSI button
  useEffect(() => {
    if (isDevMode) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          setError("");
          try {
            const user = await login({ idToken: response.credential });
            handleSuccess(user);
          } catch (err) {
            setError(err.message || "Sign-in failed");
          }
        },
      });
      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          width: 280,
        });
      }
    };
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen app-bg flex items-center justify-center px-4">
      <div className="text-center w-full max-w-xs">
        <div className="w-16 h-16 rounded-2xl bg-emerald-900 flex items-center justify-center text-emerald-400 mx-auto mb-6">
          <Shield size={32} />
        </div>
        <h1 className="text-2xl font-black text-emerald-950 mb-1">Parthsaarthi</h1>
        <p className="text-sm font-semibold text-emerald-700/60 mb-8">
          SIP Mentor Booking · IIM Lucknow
        </p>

        <div className="bg-white border border-emerald-900/10 rounded-2xl p-6 shadow-sm">
          {isDevMode ? (
            <form onSubmit={handleDevSubmit} className="space-y-3">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                Dev mode — whitelist still enforced
              </p>
              <input
                type="email"
                placeholder="your@iiml.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#F5F7FA] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500 transition-colors"
              />
              {error && (
                <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full bg-emerald-900 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 px-6 rounded-xl text-sm transition-colors"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          ) : (
            <>
              <p className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest mb-4">
                Sign in with
              </p>
              <div ref={buttonRef} className="flex justify-center" />
              {error && (
                <p className="text-xs font-semibold text-red-600 mt-4">{error}</p>
              )}
              <p className="text-[10px] text-emerald-700/40 mt-4">
                Only approved @iiml.ac.in accounts can access this platform.
              </p>
            </>
          )}
        </div>

        <div className="mt-8 flex flex-col items-center gap-1.5">
          <p className="text-xs font-semibold text-emerald-700/50 flex items-center gap-1">
            Made with <Heart size={12} className="text-emerald-500 fill-emerald-500" /> by
          </p>
          <p className="text-sm font-black text-emerald-950 tracking-tight">Team Synapse</p>
          <span className="text-[9px] font-bold text-emerald-800/60 uppercase tracking-widest border border-emerald-900/15 rounded px-2 py-0.5">
            IIM Lucknow
          </span>
        </div>
      </div>
    </div>
  );
}
