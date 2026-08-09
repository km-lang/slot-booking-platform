"use strict";

// True if the student belongs to cohortId via either their primary (e.g. Disha)
// or SIGFi cohort slot. Use this everywhere a mentor's cohort is compared against
// a student's cohort — never compare studentProfile.cohortId alone, it misses
// SIGFi-only membership.
function isCohortMember(studentProfile, cohortId) {
  if (!studentProfile || !cohortId) return false;
  return studentProfile.cohortId === cohortId || studentProfile.sigfiCohortId === cohortId;
}

// Where-fragment for rosters: "every StudentProfile belonging to cohortId" via either slot.
const cohortMemberWhere = (cohortId) => ({
  OR: [{ cohortId }, { sigfiCohortId: cohortId }],
});

module.exports = { isCohortMember, cohortMemberWhere };
