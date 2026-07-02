// Canonical "home" route per role — used to send a signed-in user somewhere
// valid after login or after being bounced off a restricted page.
const ROLE_HOME = {
  STUDENT: () => "/student",
  MENTOR: () => "/mentor",
  SuperADMIN: () => "/admin/placements",
  AIGs: (user) => `/admin/${user.aigSlug}`,
};

export function getRoleHome(user) {
  const resolve = user && ROLE_HOME[user.role];
  return resolve ? resolve(user) : "/login";
}
