import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, GraduationCap, UserCheck, ShieldCheck, Building2, Shield, BookOpen, Loader2, Search } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { apiFetch } from "../lib/apiClient";
import { getRoleHome } from "../lib/roleHome";
import AvatarMenu from "../components/AvatarMenu";
import Card from "../components/ui/Card";
import psLogo from "../assets/PSLogo.png";

function OptionButton({ icon: Icon, title, hint, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 text-left p-4 rounded-2xl border border-emerald-900/10 bg-white hover:bg-emerald-50 disabled:opacity-50 transition-colors"
    >
      <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0"><Icon size={18} /></span>
      <span className="min-w-0">
        <span className="block font-bold text-sm text-emerald-950">{title}</span>
        <span className="block text-[11px] font-semibold text-emerald-700/60">{hint}</span>
      </span>
    </button>
  );
}

// Role switcher for viewers (server-side allow-list, see server/src/lib/viewers.js).
// Everything except "Mentor" opens a read-only session — the server refuses writes.
export default function ViewAsSwitcher() {
  const { user, switchView } = useAuth();
  const navigate = useNavigate();
  const [aigs, setAigs] = useState([]);
  const [aigSlug, setAigSlug] = useState("");
  const [q, setQ] = useState("");
  const [students, setStudents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/auth/view-as/options")
      .then((d) => {
        const nonDisha = d.aigs.filter((a) => a.category !== "COMMITTEE");
        setAigs(nonDisha);
        setAigSlug(nonDisha[0]?.slug ?? "");
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!q.trim()) return;
    const h = setTimeout(() => {
      apiFetch(`/auth/view-as/students?q=${encodeURIComponent(q.trim())}`).then(setStudents).catch(() => setStudents([]));
    }, 300);
    return () => clearTimeout(h);
  }, [q]);

  if (!user?.canViewAs) return <Navigate to="/unauthorized" replace />;

  const go = async (payload) => {
    setBusy(true);
    setError("");
    try {
      const next = await switchView(payload);
      navigate(getRoleHome(next), { replace: true });
    } catch (e) {
      setError(e.message || "Could not switch view");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen app-bg text-emerald-950 font-sans pb-12">
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-emerald-900/10 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3 font-bold text-lg">
          <img src={psLogo} alt="Parthsaarthi" className="w-8 h-8 rounded-lg object-contain bg-white" />
          Parthsaarthi
        </div>
        <AvatarMenu />
      </nav>

      <main className="max-w-xl mx-auto px-4 pt-8 space-y-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2"><Eye size={22} /> Choose a view</h1>
          <p className="text-sm font-semibold text-emerald-700/70">
            Signed in as {user.name}. Student, Super Admin, AIG, Disha and Secretary views are read-only.
          </p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs font-bold text-red-700">{error}</div>}

        <OptionButton icon={BookOpen} title="Mentor" hint="Your own mentor board (full access)" disabled={busy} onClick={() => go({ role: "MENTOR" })} />
        <OptionButton icon={ShieldCheck} title="Super Admin" hint="Placement admin dashboard (read-only)" disabled={busy} onClick={() => go({ role: "SuperADMIN" })} />
        <OptionButton icon={Shield} title="Team Disha" hint="Disha committee dashboard (read-only)" disabled={busy} onClick={() => go({ role: "AIGs", aigSlug: "disha" })} />
        <OptionButton icon={UserCheck} title="Academic Secretary" hint="Mentoring activity + exports (read-only)" disabled={busy} onClick={() => go({ role: "ACADEMIC_SECY_VIEW" })} />

        <Card>
          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-emerald-800/60 uppercase tracking-widest"><Building2 size={14} /> AIG</div>
          <div className="flex gap-2">
            <select
              value={aigSlug} onChange={(e) => setAigSlug(e.target.value)}
              className="flex-1 bg-[var(--color-bg)] border border-emerald-900/10 rounded-xl px-3 py-2 text-sm font-semibold outline-none"
            >
              {aigs.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
            </select>
            <button
              disabled={busy || !aigSlug}
              onClick={() => go({ role: "AIGs", aigSlug })}
              className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold px-4 rounded-xl"
            >
              View
            </button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-emerald-800/60 uppercase tracking-widest"><GraduationCap size={14} /> Student</div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700/40" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or PGP ID"
              className="w-full bg-[var(--color-bg)] border border-emerald-900/10 rounded-xl pl-9 pr-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500"
            />
          </div>
          {q.trim() && students.length > 0 && (
            <ul className="mt-2 divide-y divide-emerald-900/5">
              {students.map((s) => (
                <li key={s.pgpId}>
                  <button disabled={busy} onClick={() => go({ role: "STUDENT", pgpId: s.pgpId })} className="w-full text-left py-2 px-1 hover:bg-emerald-50 rounded-lg flex justify-between gap-2">
                    <span className="text-sm font-semibold truncate">{s.name}</span>
                    <span className="text-xs font-bold text-emerald-700/60 shrink-0">{s.pgpId}{s.cohort ? ` · ${s.cohort}` : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {busy && <div className="flex justify-center"><Loader2 className="animate-spin text-emerald-700/50" /></div>}
      </main>
    </div>
  );
}
