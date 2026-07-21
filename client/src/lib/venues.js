// Single source of truth for the venue picker — shown on slot creation, and when
// editing an existing slot's location (RescheduleSlot, Open Slots venue editor).
export const VENUE_OPTIONS = [
  "Library (In-Person)",
  "GMeet (Online)",
  "Mess (In-Person)",
  "CC (In-Person)",
];

export const isOnlineVenue = (venue) => (venue ?? "").toLowerCase().includes("online");
