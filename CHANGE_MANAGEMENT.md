# Change Management Log — Parthsaarthi

This file is the running record of every release shipped to production, in
one place, newest first within each month. It exists so anyone — a new
teammate, a future Claude Code session, or you in three months — can answer
"what changed, and when" without reconstructing it from `git log`.

It is a log of **what shipped**, not a design doc. Keep entries to one line;
the commit itself (and, for larger features, the code/PR) is the source of
truth for detail.

---

## Process: updating this file on every release

**Whenever a new release is published (i.e. code is deployed to
`server/public/` and the live process is restarted per
[`README.deployment.md`](README.deployment.md)), add an entry to this file
as part of that same deploy — before considering the release done.**

Concretely:

1. After committing and pushing the release's code (per the deployment
   runbook's step 2), add one row per commit included in the release to the
   table under the current month in [Change History](#change-history) below
   (create a new `### Month Year` section if this is the month's first
   release). Use `git log` for the exact hash/date/subject — don't
   paraphrase from memory.
2. If the release includes a DB migration, note that in the Summary
   (e.g. "adds `Booking.role` column") so a future reader can tell
   schema-affecting releases apart from pure app-code ones at a glance.
3. Commit this file's update together with (or immediately after) the
   release commit — don't let it drift into a separate later cleanup pass.

This rule applies regardless of who or what is performing the release —
human developer or Claude Code session.

### Entry format

```
| YYYY-MM-DD | `<short-hash>` | feat\|fix\|chore\|docs\|style\|refactor | one-line summary |
```

`Type` mirrors the commit's own conventional-commit prefix. Use `misc` only
for commits genuinely written before this repo adopted that convention —
new entries should always carry a real prefix.

---

## Change History

<!-- Newest release at the top of each month's table. Add new months above
     the previous one, immediately under this comment. -->

### August 2026

| Date | Commit | Type | Summary |
|---|---|---|---|
| 2026-08-06 | `bfef239` | feat | Single-Solver Case slots (capacity 1, no Shadow), one-active-booking-per-mentor limit now scoped per slotType+focus instead of per mentor overall, swap blocked across slot types/CASE roles, fixed reassign/unassign/swap emails hardcoding "CV Review", Disha/AIG admin slot count now excludes unbooked slots — adds `Booking.slotType` and `booking_one_active_per_mentor_type` index |
| 2026-08-06 | `fa02b9b` | chore | DB snapshot before add_booking_slot_type_and_per_type_mentor_limit migration (20260806-120853) |

### July 2026

| Date | Commit | Type | Summary |
|---|---|---|---|
| 2026-07-31 | `c37889d` | feat | Case slot descriptions, mandatory Solver on the last open seat, new Stock Pitch slot type (4-way header: CV/HR, GD, Stock Pitch, Case Study), seat counts on Open Slots cards — adds SlotType.STOCK_PITCH + BookingRelease.caseDescription |
| 2026-07-31 | `b46480d` | chore | DB snapshot before add_case_description_and_stock_pitch migration (20260731-111411) |
| 2026-07-25 | `53fcd04` | fix | CSV exports now use a signed download-link + real navigation instead of a JS blob download, fixing silent failures in in-app browsers |
| 2026-07-25 | `d5c5d24` | fix | replace the last remaining alert() (Create Slots skip notice) with an in-app banner |
| 2026-07-25 | `fb4952b` | feat | extend JWT session length from 8h to 48h |
| 2026-07-24 | `47c7d44` | feat | file-backed announcement/feedback popup (no DB) — one-time feature-log or star-rating prompts, per-user tracked in server/data/ |
| 2026-07-24 | `b28e4bd` | feat | per-mentor hours breakdown on the AIG board (incl. Disha), filterable by mentor dropdown |
| 2026-07-22 | `7807421` | fix | replace window.confirm()/alert() with an in-app ConfirmDialog in Mentor + Placement Admin dashboards — native dialogs are silently suppressed by some in-app browsers, making Unassign/Delete Slot appear to do nothing |
| 2026-07-22 | `5f20a0c` | feat | dual-mode time input in Create Slots — type digits or pick via the native time picker |
| 2026-07-22 | `8973d2f` | docs | add structure.readme.md architecture reference |
| 2026-07-22 | `3b24509` | feat | cc mentor on every mentor-action email sent to a student (reassign, unassign, no-show/strike) |
| 2026-07-22 | `74a9ba0` | fix | unassignBooking never released the slot's SlotCapacity seat, leaving it permanently unbookable |
| 2026-07-22 | `fbcf7da` | docs | add CHANGE_MANAGEMENT.md changelog, require a log entry on every release |
| 2026-07-22 | `58f92db` | chore | prune superseded DB backup dumps, keep only the 2 most recent |
| 2026-07-22 | `386cdfc` | feat | GD/CASE group slot types with participant roles and capacity; restore Create Slots end-date control |
| 2026-07-22 | `f43d629` | chore | DB snapshot before add_slot_types_and_roles migration (20260722-072632) |
| 2026-07-22 | `54314eb` | fix | restore explicit end-time control in Create Slots, make time fields typeable |
| 2026-07-22 | `3054e9c` | feat | smarter Create Slots wizard — recurring weekly release, smart defaults, conflict preview |
| 2026-07-21 | `d1f2637` | feat | mentor unassign action, icon-only slot actions with long-press labels, venue picker/editor |
| 2026-07-21 | `debb413` | chore | DB snapshot before reclassifying PGP41324 (Rohan Das) as Non Disha Mentor (20260721-115407) |
| 2026-07-16 | `f0c7b61` | chore | DB snapshot before moving Rohit Kumar (PGP42037) from Manav Gupta's to Riddhi Agarwal's cohort (20260716-120407) |
| 2026-07-11 | `43a30e7` | fix | exclude unpublished slots from the student-facing "N Slots" count |
| 2026-07-11 | `d0f610d` | chore | DB snapshot before creating StudentProfile for Vishal Kumar (ABM23056) in Q6 cohort (20260711-181002) |
| 2026-07-11 | `9f3d9a3` | feat | available-slots filter, mentor contact in My Sessions; fix back-nav crash |
| 2026-07-10 | `cfa5f52` | chore | DB snapshot before fixing PGP42505 cohort and adding ABM23058 (20260710-123238) |
| 2026-07-10 | `fa2113b` | feat | soft-delete slots instead of hard-delete, allow deleting booked slots |
| 2026-07-10 | `7f1421d` | feat | measure mentor/AIG utilization in hours instead of slot counts |
| 2026-07-10 | `286a527` | fix | sort admin session/booking history by session time, not booking creation time |
| 2026-07-09 | `dae6bdc` | feat | disable student-side booking cancellation; pause auto-banning |
| 2026-07-09 | `35c4d9b` | chore | DB snapshot before adding 8 AIG admin whitelist emails (20260709-151814) |
| 2026-07-09 | `0f2d254` | chore | DB snapshot before manually lifting expired ban on PGP42043 (20260709-000821) |
| 2026-07-08 | `d12c47a` | chore | DB snapshot before adding student Ashish Ranjan (PGP42407) to Anandu Vinayak's cohort (20260708-192345) |
| 2026-07-08 | `2d9bdb5` | chore | DB snapshot before merging Akanksha Choudhary (ABM22052) duplicate mentor/student accounts (20260708-161649) |
| 2026-07-08 | `a6c7de1` | chore | DB snapshot before fixing Pratyusha Pakalapati email/pgpId typo (20260708-154609) |
| 2026-07-07 | `65f7acc` | fix | move Shukracharya button into avatar menu on student/mentor screens |
| 2026-07-07 | `064b956` | feat | rebrand headers to Parthsaarthi, add app logo, red heart footer |
| 2026-07-07 | `2caebe5` | chore | DB snapshot before adding 2 students to Disha cohorts (20260707-081046) |
| 2026-07-07 | `8ce2107` | chore | DB snapshot before reassign/swap disposable test fixture (20260707-011928) |
| 2026-07-07 | `581a2be` | feat | let mentors reassign or swap existing bookings between students |
| 2026-07-06 | `bfbd0f3` | feat | add Cracktank AIG and separate PGP 2 Mentors block |
| 2026-07-06 | `d789de0` | chore | DB snapshot before Cracktank AIG + PGP 2 Mentors import (20260706-194852) |
| 2026-07-06 | `8debaef` | chore | DB snapshot before PGP2_STUDENT_NO_AIG enum migration (20260706-193536) |
| 2026-07-06 | `84b8162` | fix | mentor-list scroll/clipping bugs on student and admin screens |
| 2026-07-06 | `11c8651` | fix | rename Non-AIG to Non Disha Mentors; fix whitelist list scroll on mobile |
| 2026-07-06 | `fd33ae0` | chore | DB snapshot before NDM mentor bulk import (20260706-185705) |
| 2026-07-05 | `f48d542` | feat | retire (not reject) slots with only cancelled bookings; UI polish rollout |
| 2026-07-05 | `e7774c2` | chore | DB snapshot before add_slot_retired_flag migration (20260705-193310) |
| 2026-07-05 | `b18e130` | chore | DB snapshot before adding Slot.retired flag and partial no-overlap constraint (20260705-183318) |
| 2026-07-05 | `fc86262` | chore | DB snapshot before adding student ALPANA SINGH (pgp42513) to Chetan Duggirala's cohort (20260705-172719) |
| 2026-07-04 | `558b61b` | feat | mentor phone number + CSV export helper; UI polish foundations |
| 2026-07-04 | `bb323ab` | chore | DB snapshot before add_mentor_phone migration (20260704-221010) |
| 2026-07-04 | `d41de60` | chore | DB snapshot before adding MentorProfile.phone column (20260704-211451) |
| 2026-07-04 | `2429950` | chore | DB snapshot before adding placementchair@iiml.ac.in as SuperADMIN (20260704-172407) |
| 2026-07-04 | `7c652cf` | fix | use Parthsaarthi.ico as the favicon, remove unused vite.svg |
| 2026-07-04 | `1ce9e34` | feat | expired-slot visibility + remaining-time re-release, fix mailer transport caching |
| 2026-07-04 | `f71515f` | chore | DB snapshot before pre-launch cleanup (20260703-231149) |
| 2026-07-03 | `c75e6f3` | feat | add Ongoing sessions view and surface Team Disha first in AIG list |
| 2026-07-03 | `0b62bdb` | chore | DB snapshot before deleting PGP41227 cancelled booking (20260703-184846) |
| 2026-07-03 | `76f8365` | chore | DB snapshot before deleting PGP41302 booking history (20260703-184355) |
| 2026-07-03 | `e833164` | feat | cohort-only slot visibility, combined delay email, collapsible dashboard lists |
| 2026-07-03 | `e0a4ee3` | fix | prevent cancelling a session that has already started |
| 2026-07-03 | `b68a6e5` | fix | keep student header reachable when a page scrolls |
| 2026-07-03 | `e4ab376` | feat | surface non-AIG mentors on the student dashboard |
| 2026-07-03 | `b40c785` | fix | merge slot-creation wizard into a 2-step flow |
| 2026-07-03 | `ad4c413` | fix | hide bulk-Publish action when selection has no draft slots |
| 2026-07-03 | `be4f37d` | feat | replace automatic cancellation penalties with mentor-reviewed strikes |
| 2026-07-03 | `85f61ba` | feat | replace mentor slot-creation/reschedule popups with dedicated pages |
| 2026-07-03 | `9a969c4` | chore | DB snapshot before cancellation redesign migration (20260703-125135) |
| 2026-07-02 | `452ecb2` | chore | DB snapshot before replacing dummy AIG mentors with real roster (20260702-235323) |
| 2026-07-02 | `35d6fe8` | fix | optimize student flow for mobile (iOS/Android) and laptop (Windows/Mac) |
| 2026-07-02 | `c6fc12d` | fix | prevent mentors from creating/rescheduling overlapping slots |
| 2026-07-02 | `c1d4f43` | chore | DB snapshot before adding Slot no-overlap-per-mentor constraint (20260702-165414) |
| 2026-07-02 | `8a0cb23` | docs | update README changelog through Phase 16, add student guide PDF, gitignore backup folders |
| 2026-07-02 | `5c05590` | feat | normalize PGP/ABM ID format, add MentorProfile.pgpId, Committee label for Disha |
| 2026-07-02 | `6b4a416` | chore | DB snapshot before pgpId normalization + MentorProfile.pgpId column (20260702-151949) |
| 2026-07-02 | `a94ff9b` | docs | add student user guide with walkthrough screenshots |
| 2026-07-02 | `e42061a` | fix | Unauthorized page Go Back button could strand users |
| 2026-07-02 | `a47918c` | docs | add application-only deployment runbook with DB safety rules |
| 2026-07-02 | `198f8d3` | feat | mentor search bar for slot allocation, harden reminder/digest cron error handling |
| 2026-07-01 | `a07ff4f` | revert | restore Team SynapsE branding in email header |
| 2026-07-01 | `5144e6b` | fix | re-apply email header rebrand (mailer.js reverted by IDE) |
| 2026-07-01 | `96d8c77` | misc | by Team SynapsE |
| 2026-07-01 | `0971cd2` | fix | specific booking errors, single combined confirmation email, rebrand header |
| 2026-07-01 | `eb87b53` | feat | lock name to Google account, show Disha mentor in student profile |

### June 2026

| Date | Commit | Type | Summary |
|---|---|---|---|
| 2026-06-30 | `0ebc754` | misc | parthsaarthi tests |
| 2026-06-30 | `cb70383` | feat | draft/publish slots, one-booking-per-mentor limit, mentor-allocated bookings |
| 2026-06-30 | `a1aec08` | fix | race condition allowing overbooking past slot capacity |
| 2026-06-30 | `ed05d8e` | fix | listMentors/getMentor crash (500) for non-AIG mentors |
| 2026-06-30 | `30a2b5f` | feat | reschedule, add-to-calendar link, bulk slot actions, waitlist, admin calendar view |
| 2026-06-28 | `7b13027` | feat | Google Meet link UI + custom slot-duration tab in mentor dashboard |
| 2026-06-28 | `3a43541` | feat | Google Meet link support, custom slot duration, verified cohort-only enforcement |
| 2026-06-27 | `0f9de4d` | feat | attach calendar invites (.ics) to booking confirmation/cancellation emails |
| 2026-06-27 | `25775bd` | fix | mobile layout overflow across admin dashboard screens |
| 2026-06-27 | `89d14a4` | fix | sort cohorts (Q1-Q17) numerically instead of alphabetically |
| 2026-06-27 | `f462804` | feat | add Org & Mentor Stats and History tabs to the SuperAdmin dashboard |
| 2026-06-27 | `1a78328` | feat | add SuperAdmin org/mentor stats and mentor/student history endpoints |
| 2026-06-27 | `2f33094` | feat | add org-unit categorization (Committee/Club/AIG) and non-AIG mentor support |
| 2026-06-27 | `e91f0cc` | feat | derive client API base URL from Vite's configured base path |
| 2026-06-27 | `e50d502` | feat | switch database provider from SQLite to PostgreSQL |
| 2026-06-27 | `f8e0a31` | chore | exclude built server/public bundle from version control |
| 2026-06-26 | `f26ba22` | fix | harden authentication, rate limiting, and request integrity |
| 2026-06-26 | `02638fc` | fix | resolve dashboard UX misalignments and data-integrity gaps |
| 2026-06-26 | `dcebcc2` | feat | add CSV export for AIG coordinators and students; lock down browse endpoints |
| 2026-06-26 | `1463e4f` | style | rework UI theme to Soft Sky & Slate palette, drop background image |
| 2026-06-24 | `c245f5c` | misc | new design changes |
| 2026-06-23 | `b2250ff` | feat | persistent session (localStorage) + silent JWT refresh |
| 2026-06-23 | `d895e4e` | fix | production hardening — graceful shutdown, error boundary, email logging, env docs |
| 2026-06-23 | `5721ff3` | fix | SuperADMIN mentor drill-down access, RequireRole multi-role, IST cron |
| 2026-06-23 | `881300b` | feat | AIG mentor drill-down dashboard + profile update fix |
| 2026-06-23 | `f12d854` | misc | seed: replace dummy Disha mentors with 17 real ones; add DEV_EMAIL_OVERRIDE |
| 2026-06-23 | `09ea34f` | feat | add booking confirmation and cancellation emails to student |
| 2026-06-23 | `d9be849` | docs | add Phase 8 summary and production deployment guide to README |
| 2026-06-23 | `e3e6f69` | misc | Phase 7: Email notifications, CSV exports, profile editing, penalty config, audit log detail |
| 2026-06-22 | `8c16e9a` | misc | Phase 5 & 6: Full mentor dashboard overhaul, student My Sessions, PlacementAdmin fixes, concurrency hardening |
| 2026-06-22 | `060daae` | misc | slot controller changes |
| 2026-06-21 | `35161b1` | misc | dev.db push |
| 2026-06-21 | `5ed53df` | misc | Phase & implemented |
| 2026-06-21 | `9e90b1a` | misc | Merge pull request #1 from km-lang/phase_3 |
| 2026-06-20 | `e8c80b7` | misc | phase 4 |
| 2026-06-20 | `99e1bd2` | misc | phase 3 |
| 2026-06-20 | `0e842d1` | misc | Readme for repo |
| 2026-06-20 | `e71215c` | misc | Latest Phase 2 generated through Claude |
| 2026-06-19 | `8bd59d7` | misc | Add Shukracharya redirect |
| 2026-06-19 | `ee4595e` | misc | Mobile first wireframes |
| 2026-06-18 | `9997b4e` | misc | hashrouter changes for hosting |
| 2026-06-18 | `7d6808b` | misc | all 3 views ready |
| 2026-06-18 | `efcc121` | misc | First commit setup |
