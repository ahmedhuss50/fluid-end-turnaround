// Shared domain constants for the Fluid End Turnaround System.

export const JOB_STATUS = {
  DRAFT: "DRAFT",
  AWAITING_PSI: "AWAITING_PSI",
  AWAITING_OPERATOR: "AWAITING_OPERATOR",
  COMPLETED: "COMPLETED",
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  AWAITING_PSI: "Awaiting PSI signature",
  AWAITING_OPERATOR: "Awaiting operator signature",
  COMPLETED: "Completed",
};

export const PARTY = {
  PSI: "PSI",
  PRO_PETRO: "PRO_PETRO",
} as const;

export const PARTY_LABEL: Record<string, string> = {
  PSI: "PSI",
  PRO_PETRO: "Operator (Pro Petro)",
};

export const TEST_RESULT = {
  PASS: "PASS",
  FAIL: "FAIL",
} as const;

export const REQUEST_STATUS = {
  SUBMITTED: "SUBMITTED",
  CONVERTED: "CONVERTED",
} as const;

// Managed list of customer / operator companies. Add new customers here.
export const CUSTOMERS = ["Pro Petro"];

export const DELIVERY_METHOD = {
  DELIVERY: "DELIVERY", // client drops off at PSI
  PICKUP: "PICKUP", // PSI collects from the client
} as const;

export const DELIVERY_LABEL: Record<string, string> = {
  DELIVERY: "Client delivers to PSI",
  PICKUP: "PSI picks up",
};

export const OUTCOME = {
  READY_PICKUP: "READY_PICKUP",
  READY_DELIVERY: "READY_DELIVERY",
  SCRAP: "SCRAP",
} as const;

export const OUTCOME_LABEL: Record<string, string> = {
  READY_PICKUP: "Ready for pickup",
  READY_DELIVERY: "Ready for delivery",
  SCRAP: "Scrap — cannot repair",
};

// Work-order pipeline stages (the kanban columns after "receiving").
export const STAGE_ORDER = ["INSPECTION", "WORK", "TEST", "SIGNOFF"];
export const STAGE_LABEL: Record<string, string> = {
  INSPECTION: "Inspection",
  WORK: "Work performed",
  TEST: "Pressure test",
  SIGNOFF: "Sign-off & outcome",
};

// Wear parts commonly replaced during a fluid-end turnaround.
export const WEAR_PARTS: { key: string; label: string }[] = [
  { key: "valves", label: "Valves" },
  { key: "seats", label: "Seats" },
  { key: "packing", label: "Packing" },
  { key: "seals", label: "Seals" },
  { key: "plungers", label: "Plungers" },
  { key: "studs", label: "Studs" },
  { key: "nuts", label: "Nuts" },
  { key: "springs", label: "Springs" },
];

export const PART_LABEL: Record<string, string> = Object.fromEntries(
  WEAR_PARTS.map((p) => [p.key, p.label])
);
