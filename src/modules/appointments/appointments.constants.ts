/** Upper bound for service length when querying possible overlaps. */
export const MAX_SERVICE_DURATION_MINUTES = 480;

/** Increment between candidate slot starts in availability search. */
export const SLOT_STEP_MINUTES = 15;

export const CANCELLED_APPOINTMENT_STATUSES = ['cancelled'] as const;
