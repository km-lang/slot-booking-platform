import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiClient";

// ── Stable query keys ─────────────────────────────────────────────────────────
// Centralised here so invalidation in mutations always matches the right cache.

export const QK = {
  profile:         ()        => ["profile"],
  aigs:            ()        => ["aigs"],
  aigMentors:      (slug)    => ["mentors", slug],
  allMentors:      ()        => ["mentors", "all"],
  mentor:          (slug)    => ["mentor", slug],
  slots:           (slug)    => ["slots", slug],
  mentorDashboard: ()        => ["mentorDashboard"],
  mentorCohort:    ()        => ["mentorCohort"],
  aigOverview:     (slug)    => ["aigOverview", slug],
  mentorDetail:    (slug)    => ["mentorDetail", slug],
  adminBatch:      ()        => ["adminBatch"],
  orgStats:        ()        => ["orgStats"],
  mentorStats:     ()        => ["mentorStats"],
  studentSearch:   (q)       => ["studentSearch", q],
  studentDetail:   (pgpId)   => ["studentDetail", pgpId],
  adminCalendar:   (weekStart) => ["adminCalendar", weekStart],
  whitelist:       ()        => ["whitelist"],
  config:          ()        => ["config"],
  bans:            ()        => ["bans"],
};

// ── Query hooks ───────────────────────────────────────────────────────────────

export const useProfile = () =>
  useQuery({
    queryKey: QK.profile(),
    queryFn:  () => apiFetch("/profile"),
    staleTime: 60_000,
  });

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      apiFetch("/profile", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.profile() }),
  });
};

export const useAigs = () =>
  useQuery({
    queryKey: QK.aigs(),
    queryFn:  () => apiFetch("/aigs"),
  });

// Per-AIG mentor list — only fetches when aigSlug is set (i.e. AIG is expanded)
export const useAigMentors = (aigSlug) =>
  useQuery({
    queryKey: QK.aigMentors(aigSlug),
    queryFn:  () => apiFetch(`/mentors?aigSlug=${aigSlug}`),
    enabled:  !!aigSlug,
  });

// All mentors — enabled lazily when the student opens the search box
export const useAllMentors = (enabled) =>
  useQuery({
    queryKey: QK.allMentors(),
    queryFn:  () => apiFetch("/mentors"),
    enabled:  !!enabled,
  });

export const useMentor = (slug) =>
  useQuery({
    queryKey: QK.mentor(slug),
    queryFn:  () => apiFetch(`/mentors/${slug}`),
    enabled:  !!slug,
  });

// Student: slots for a specific mentor (future-only, server enforces this)
export const useSlots = (mentorSlug) =>
  useQuery({
    queryKey: QK.slots(mentorSlug),
    queryFn:  () => apiFetch(`/slots?mentorSlug=${mentorSlug}`),
    enabled:  !!mentorSlug,
    staleTime: 10_000, // slots refresh more aggressively
  });

export const useMyBookings = () =>
  useQuery({
    queryKey: ["myBookings"],
    queryFn:  () => apiFetch("/bookings/mine"),
    staleTime: 15_000,
  });

export const useMentorDashboard = () =>
  useQuery({
    queryKey: QK.mentorDashboard(),
    queryFn:  () => apiFetch("/slots/mine"),
    staleTime: 10_000,
  });

export const useMentorCohort = () =>
  useQuery({
    queryKey: QK.mentorCohort(),
    queryFn:  () => apiFetch("/cohort"),
  });

export const useAigOverview = (aigSlug) =>
  useQuery({
    queryKey: QK.aigOverview(aigSlug),
    queryFn:  () => apiFetch(`/admin/aig/${aigSlug}`),
    enabled:  !!aigSlug,
  });

export const useMentorDetail = (mentorSlug) =>
  useQuery({
    queryKey: QK.mentorDetail(mentorSlug),
    queryFn:  () => apiFetch(`/admin/mentor/${mentorSlug}`),
    enabled:  !!mentorSlug,
    staleTime: 30_000,
  });

// Polls so the "Live" activity feed on the Placement Admin dashboard is actually live.
export const useAdminBatch = () =>
  useQuery({
    queryKey: QK.adminBatch(),
    queryFn:  () => apiFetch("/admin/batch"),
    refetchInterval: 15_000,
  });

export const useOrgStats = () =>
  useQuery({
    queryKey: QK.orgStats(),
    queryFn:  () => apiFetch("/admin/org-stats"),
  });

export const useMentorStats = () =>
  useQuery({
    queryKey: QK.mentorStats(),
    queryFn:  () => apiFetch("/admin/mentors"),
  });

// Lazily enabled — only fires once the SuperAdmin types something in the search box.
export const useStudentSearch = (q) =>
  useQuery({
    queryKey: QK.studentSearch(q),
    queryFn:  () => apiFetch(`/admin/students?q=${encodeURIComponent(q)}`),
    enabled:  !!q && q.trim().length > 0,
  });

export const useStudentDetail = (pgpId) =>
  useQuery({
    queryKey: QK.studentDetail(pgpId),
    queryFn:  () => apiFetch(`/admin/student/${pgpId}`),
    enabled:  !!pgpId,
  });

export const useWhitelist = () =>
  useQuery({
    queryKey: QK.whitelist(),
    queryFn:  () => apiFetch("/admin/whitelist"),
  });

export const useConfig = () =>
  useQuery({
    queryKey: QK.config(),
    queryFn:  () => apiFetch("/admin/config"),
  });

export const useBans = () =>
  useQuery({
    queryKey: QK.bans(),
    queryFn:  () => apiFetch("/admin/bans"),
  });

// ── Mutation hooks ────────────────────────────────────────────────────────────
// Each hook invalidates its relevant query on success.
// Components can pass per-call onSuccess/onError to mutate() for UI-level side-effects
// (closing sheets, navigating, etc.) — TanStack Query calls both hook-level and
// call-level callbacks, so cache stays correct regardless of component action.

export const useBookSlot = (mentorSlug) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      apiFetch("/bookings", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.slots(mentorSlug) });
      qc.invalidateQueries({ queryKey: ["myBookings"] });
    },
    // 409 = slot taken by someone else — still refresh so the UI shows it as full
    onError: (err) => {
      if (err.status === 409) qc.invalidateQueries({ queryKey: QK.slots(mentorSlug) });
    },
  });
};

export const useCancelBooking = (mentorSlug) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookingId) =>
      apiFetch(`/bookings/${bookingId}/release`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.slots(mentorSlug) });
      qc.invalidateQueries({ queryKey: ["myBookings"] });
    },
  });
};

export const useMarkAttendance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, status }) =>
      apiFetch(`/bookings/${bookingId}/attendance`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.mentorDashboard() });
      qc.invalidateQueries({ queryKey: QK.mentorCohort() });
    },
  });
};

export const useCreateSlots = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      apiFetch("/slots", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.mentorDashboard() }),
  });
};

export const useDeleteSlot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => apiFetch(`/slots/${slotId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.mentorDashboard() }),
  });
};

export const useSetSlotDelay = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, delayMinutes }) =>
      apiFetch(`/slots/${slotId}/delay`, {
        method: "PATCH",
        body: JSON.stringify({ delayMinutes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.mentorDashboard() }),
  });
};

export const useSetSlotMeetingLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, meetingLink }) =>
      apiFetch(`/slots/${slotId}/meeting-link`, {
        method: "PATCH",
        body: JSON.stringify({ meetingLink }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.mentorDashboard() }),
  });
};

export const useRescheduleSlot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, startTime, endTime }) =>
      apiFetch(`/slots/${slotId}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({ startTime, endTime }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.mentorDashboard() }),
  });
};

export const useBulkDeleteSlots = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotIds) =>
      apiFetch("/slots/bulk-delete", { method: "POST", body: JSON.stringify({ slotIds }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.mentorDashboard() }),
  });
};

export const useBulkSetMeetingLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slotIds, meetingLink }) =>
      apiFetch("/slots/bulk-meeting-link", { method: "PATCH", body: JSON.stringify({ slotIds, meetingLink }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.mentorDashboard() }),
  });
};

export const useJoinWaitlist = (mentorSlug) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => apiFetch(`/slots/${slotId}/waitlist`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.slots(mentorSlug) }),
  });
};

export const useLeaveWaitlist = (mentorSlug) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slotId) => apiFetch(`/slots/${slotId}/waitlist`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.slots(mentorSlug) }),
  });
};

export const useAdminCalendar = (weekStart) =>
  useQuery({
    queryKey: QK.adminCalendar(weekStart),
    queryFn:  () => apiFetch(`/admin/calendar?weekStart=${weekStart}`),
  });

export const useAddWhitelist = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      apiFetch("/admin/whitelist", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.whitelist() }),
  });
};

export const useRemoveWhitelist = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => apiFetch(`/admin/whitelist/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.whitelist() }),
  });
};

export const useSaveConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }) =>
      apiFetch(`/admin/config/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.config() }),
  });
};

export const useLiftBan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => apiFetch(`/admin/bans/${id}/lift`, { method: "PATCH" }),
    onSuccess: () => {
      // Refresh bans + batch overview (active ban count changes)
      qc.invalidateQueries({ queryKey: QK.bans() });
      qc.invalidateQueries({ queryKey: QK.adminBatch() });
    },
  });
};
