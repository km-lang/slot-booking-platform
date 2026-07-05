import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Save, CheckCircle } from "lucide-react";
import { useProfile, useUpdateProfile } from "../hooks/useApi";
import { useAuth } from "../context/useAuth";
import { getRoleLabel } from "../lib/roleHome";
import AppFooter from "../components/AppFooter";
import AppShell from "../components/ui/AppShell";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

export default function ProfileSettings() {
  const navigate    = useNavigate();
  const { updateUser } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const mutation    = useUpdateProfile();

  const [firm,   setFirm]   = useState("");
  const [domain, setDomain] = useState("");
  const [phone,  setPhone]  = useState("");
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    if (profile) {
      setFirm(profile.firm ?? "");
      setDomain(profile.domain ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const isMentor = profile?.role === "MENTOR";
  const roleLabel = getRoleLabel(profile);

  const handleSave = (e) => {
    e.preventDefault();
    const body = {};
    if (isMentor) {
      if (firm.trim())   body.firm   = firm.trim();
      if (domain.trim()) body.domain = domain.trim();
      if (phone.trim())  body.phone  = phone.trim();
    }
    mutation.mutate(body, {
      onSuccess: (updated) => {
        updateUser({ name: updated.name });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      },
    });
  };

  const backPath =
    profile?.role === "MENTOR"     ? "/mentor"
    : profile?.role === "SuperADMIN" ? "/admin/placements"
    : profile?.role === "AIGs"       ? "/admin/disha"
    : "/student";

  return (
    <AppShell
      maxWidthClassName="max-w-md md:max-w-2xl lg:max-w-4xl"
      header={
        <PageHeader
          title={isMentor ? "Edit Profile" : "My Profile"}
          subtitle={isLoading ? "Loading…" : profile?.email}
          onBack={() => navigate(backPath)}
        />
      }
    >
        <main className="flex-1 px-4 py-8">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-full bg-emerald-900 text-emerald-400 flex items-center justify-center font-black text-2xl mb-3">
              {(profile?.name || "?")
                .split(" ")
                .map((w) => w[0])
                .join("")
                .substring(0, 2)
                .toUpperCase()}
            </div>
            <div className="flex items-center gap-2">
              <User size={12} className="text-emerald-700/50" />
              <span className="text-xs font-bold text-emerald-700/60 uppercase tracking-widest">
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Read-only account info */}
            <Card className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/50 -mb-1">
                Account
              </p>

              <Input
                label="Full Name"
                type="text"
                value={profile?.name ?? ""}
                disabled
                hint="Synced from your Google account — cannot be changed here"
              />

              <Input
                label="Email"
                type="email"
                value={profile?.email ?? ""}
                disabled
                hint="Email cannot be changed"
              />
            </Card>

            {/* Student-only: cohort + Disha mentor */}
            {profile?.role === "STUDENT" && (profile?.cohort || profile?.dishaMentor) && (
              <Card className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/50 -mb-1">
                  Disha Assignment
                </p>
                {profile?.cohort && (
                  <Input label="Cohort" type="text" value={profile.cohort} disabled />
                )}
                {profile?.dishaMentor && (
                  <Input
                    label="Your Disha Mentor"
                    type="text"
                    value={profile.dishaMentor}
                    disabled
                    hint="Assigned by Disha — cannot be changed"
                  />
                )}
              </Card>
            )}

            {/* Mentor-only: editable firm + domain */}
            {isMentor && (
              <form onSubmit={handleSave}>
                <Card className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/50 -mb-1">
                    Mentor Profile
                  </p>
                  <Input
                    label="Current Firm / Organisation"
                    type="text"
                    value={firm}
                    onChange={(e) => setFirm(e.target.value)}
                    placeholder="e.g. McKinsey & Co."
                  />
                  <Input
                    label="Domain / Function"
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="e.g. Strategy Consulting"
                  />
                  <Input
                    label="Mobile Number"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    hint="Shown to students as Call / WhatsApp once they've booked a session with you. Include the country code."
                  />
                </Card>

                {mutation.error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 mt-4">
                    <p className="text-xs font-bold text-red-700">{mutation.error.message}</p>
                  </div>
                )}

                {saved && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-4 flex items-center gap-2">
                    <CheckCircle size={14} className="text-emerald-600" />
                    <p className="text-xs font-bold text-emerald-700">Profile saved successfully</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  loading={mutation.isPending}
                  loadingText="Saving…"
                  className="w-full mt-4 py-4 shadow-md"
                >
                  <Save size={16} /> Save Changes
                </Button>
              </form>
            )}
          </div>
        </main>
        <AppFooter />
    </AppShell>
  );
}
