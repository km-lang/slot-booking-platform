import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { getRoleHome } from "../lib/roleHome";
import psLogo from "../assets/PSLogo.png";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const buttonRef = useRef(null);

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isDevMode = import.meta.env.DEV;

  const handleSuccess = (user) => {
    navigate(getRoleHome(user), { replace: true });
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
          shape: "pill",
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
    <div className="min-h-screen-safe app-bg flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Subtle vertical "pillar" texture — same idea as the Hodor login's
          background lines, tuned down for a light theme instead of on-black. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#12332b08_1px,transparent_1px)] bg-[size:100px_100%] pointer-events-none" />

      {/* Ambient glow — brass gold instead of amber-on-black */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[900px] h-[280px] bg-gem-accent/10 blur-[110px] pointer-events-none rounded-b-full" />

      <div className="w-full max-w-[400px] relative z-10 flex flex-col gap-6">
        {/* Main card */}
        <div className="bg-white/80 backdrop-blur-xl border border-emerald-900/10 relative overflow-hidden shadow-elevated rounded-3xl">
          {/* Gold horizon line */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-gem-accent/30 via-gem-accent to-gem-accent/30 shadow-[0_0_15px_rgba(201,162,75,0.35)]" />

          <div className="p-8 pt-12 flex flex-col items-center text-center">
            {/* Brand header */}
            <div className="mb-8 relative flex flex-col items-center">
              <div className="absolute -inset-6 bg-gem-accent/10 blur-xl rounded-full" />
              <img src={psLogo} alt="" className="relative w-20 h-20 object-contain mb-2" />
              <h1 className="relative font-display font-bold text-4xl text-emerald-950 tracking-tight">
                PARTHSAARTHI
              </h1>
              <div className="flex items-center justify-center gap-3 mt-3">
                <div className="h-px w-6 bg-gem-accent/40" />
                <span className="text-[10px] uppercase tracking-[0.3em] text-[#5b4e27] font-bold">
                  Team SynapsE · IIM Lucknow
                </span>
                <div className="h-px w-6 bg-gem-accent/40" />
              </div>
            </div>

            {/* Status indicator */}
            <div className="w-full bg-emerald-50 border border-emerald-900/10 rounded-2xl p-4 mb-8 flex items-start gap-3 text-left">
              <div className="mt-0.5 p-1.5 bg-emerald-100 rounded-lg border border-emerald-200 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              </div>
              <div>
                <p className="text-xs text-emerald-900 font-bold uppercase tracking-wider mb-1">
                  Verified Access Only
                </p>
                <p className="text-[10px] text-emerald-700/60 leading-relaxed">
                  Sign-in is restricted to approved @iiml.ac.in accounts.
                </p>
              </div>
            </div>

            {isDevMode ? (
              <form onSubmit={handleDevSubmit} className="w-full space-y-3">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-1">
                  Dev mode — whitelist still enforced
                </p>
                <Input
                  type="email"
                  placeholder="your@iiml.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {error && (
                  <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={loading || !email.trim()}
                  loading={loading}
                  loadingText="Signing in…"
                  className="w-full"
                >
                  Sign In
                </Button>
              </form>
            ) : (
              <div className="w-full">
                <p className="text-[10px] font-bold text-emerald-800/50 uppercase tracking-widest mb-4">
                  Sign in with
                </p>
                <div ref={buttonRef} className="flex justify-center" />
                {error && (
                  <p className="text-xs font-semibold text-red-600 mt-4">{error}</p>
                )}
              </div>
            )}
          </div>

          {/* Bottom tech strip */}
          <div className="bg-emerald-50/70 py-3 px-8 border-t border-emerald-900/5 flex justify-between items-center text-[9px] font-mono text-emerald-700/40 uppercase tracking-wider">
            <span>SIP Prep 2026</span>
            <span>Secure Sign-In</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs font-semibold text-emerald-700/50 flex items-center justify-center gap-1">
            Made with <Heart size={12} className="text-emerald-500 fill-emerald-500" /> by
          </p>
          <p className="text-sm font-black text-emerald-950 tracking-tight mt-1">Team Synapse</p>
          <span className="inline-block text-[9px] font-bold text-emerald-800/60 uppercase tracking-widest border border-emerald-900/15 rounded px-2 py-0.5 mt-1.5">
            IIM Lucknow
          </span>
        </div>
      </div>
    </div>
  );
}
