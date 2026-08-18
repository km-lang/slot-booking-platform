// Canonical "home" route per role — used to send a signed-in user somewhere
// valid after login or after being bounced off a restricted page.
const ROLE_HOME = {
  STUDENT: () => "/student",
  MENTOR: () => "/mentor",
  SuperADMIN: () => "/admin/placements",
  AIGs: (user) => `/admin/${user.aigSlug}`,
  ACADEMIC_SECY_VIEW: () => "/admin/secy",
};

export function getRoleHome(user) {
  const resolve = user && ROLE_HOME[user.role];
  return resolve ? resolve(user) : "/login";
}

// Human-readable role label — shared by AvatarMenu and ProfileSettings so a
// user's account menu and profile page never disagree on what to call their
// own role. Disha's admin is a "Committee" (see schema's OrgCategory), shown
// distinctly from a regular AIG admin.
const ROLE_LABEL = {
  STUDENT: "Student",
  MENTOR: "Mentor",
  AIGs: "AIG Admin",
  SuperADMIN: "Super Admin",
  ACADEMIC_SECY_VIEW: "Academic Secretary (View Only)",
};

export function getRoleLabel(user) {
  if (!user) return "";
  if (user.aigCategory === "COMMITTEE") return "Committee";
  return ROLE_LABEL[user.role] ?? user.role;
}
