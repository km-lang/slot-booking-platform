import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
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
  const [error, setError] = useState("");

  const handleCredential = async (response) => {
    setError("");
    try {
      const user = await login(response.credential);
      const resolveHome = ROLE_HOME[user.role];
      navigate(resolveHome ? resolveHome(user) : "/unauthorized", { replace: true });
    } catch (err) {
      setError(err.message || "Sign-in failed");
    }
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: 280,
      });
    };
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAF7] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-900 flex items-center justify-center text-emerald-400 mx-auto mb-6">
          <Shield size={32} />
        </div>
        <h1 className="text-2xl font-black text-emerald-950 mb-1">
          Parthsaarthi
        </h1>
        <p className="text-sm font-semibold text-emerald-700/60 mb-8">
          SIP Mentor Booking · IIM Lucknow
        </p>
        <div className="bg-white border border-emerald-900/10 rounded-2xl p-6 shadow-sm max-w-xs mx-auto">
          <p className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest mb-4">
            Sign in with
          </p>
          <div ref={buttonRef} className="flex justify-center" />
          {error && (
            <p className="text-xs font-semibold text-red-600 mt-4">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
