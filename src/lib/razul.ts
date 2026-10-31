// Shared, browser-safe constants for Razul's console.
export const CATEGORIES = [
  ["animation_snapping", "Animation snapping"],
  ["foot_sliding", "Foot sliding"],
  ["clipping", "Clipping"],
  ["collision_mismatch", "Collision mismatch"],
  ["horse_chariot", "Horse / chariot glitch"],
  ["performance_spike", "Performance spike"],
  ["multiplayer_desync", "Multiplayer desync"],
  ["other", "Other"],
] as const;

export const SEVERITIES = ["blocker", "critical", "major", "minor", "trivial"] as const;
export const STATUSES = ["new", "triaged", "in_progress", "fixed", "verified", "wont_fix", "duplicate"] as const;
export const OPEN_STATUSES = ["new", "triaged", "in_progress"] as const;

export const SERVICE_SCOPES = ["evidence:write", "telemetry:write", "issues:read", "issues:write"] as const;

export const categoryLabel = (c: string) => CATEGORIES.find(([k]) => k === c)?.[1] ?? c;

export type IntegrationStatus = "disconnected" | "contract_ready";
export const INTEGRATIONS: {
  id: string;
  name: string;
  ref: string;
  status: IntegrationStatus;
  direction: string;
  contract: string;
  prerequisites: string[];
}[] = [
  {
    id: "anomaly-legacy",
    name: "Anomaly Legacy",
    ref: "bc815e5c-10a5-405a-9e24-733180ad008f",
    status: "disconnected",
    direction: "Anomaly Legacy → Razul (game-test evidence & telemetry)",
    contract: "POST evidence bundles (build_version, session_id, clip/log reference, frame-time samples) using a scoped service credential with evidence:write / telemetry:write.",
    prerequisites: [
      "Razul ingest endpoint enabled (not built yet)",
      "Owner issues a service credential with evidence:write",
      "Anomaly Legacy owner adds the credential to that project's secrets and implements the sender",
    ],
  },
  {
    id: "jackboy",
    name: "Jackboy Developer Console",
    ref: "72823346-c174-4e90-9e17-671e197837c5",
    status: "disconnected",
    direction: "Razul → Jackboy (issue handoff for repair)",
    contract: "Jackboy pulls confirmed issues (issues:read) or receives the JSON handoff export below; Jackboy reports fix status back (issues:write, status only).",
    prerequisites: [
      "Owner issues credential with issues:read",
      "Jackboy owner implements the pull client in that project",
      "Agreement on status write-back rules",
    ],
  },
  {
    id: "omni",
    name: "OMNI",
    ref: "No project ID provided",
    status: "disconnected",
    direction: "Razul ↔ OMNI (orchestration of the repair loop)",
    contract: "Read-only issue summary feed (issues:read). Contract to be confirmed against the role blueprint.",
    prerequisites: ["OMNI project/endpoint identified by owner", "Scoped credential issued", "Contract confirmed"],
  },
  {
    id: "guardian",
    name: "Guardian",
    ref: "No project ID provided",
    status: "disconnected",
    direction: "Guardian → Razul (security / access oversight)",
    contract: "Guardian audits credential issuance and revocation. No data exchange defined yet.",
    prerequisites: ["Guardian project/endpoint identified by owner", "Audit contract defined"],
  },
];

export const PLANNED_ANALYSIS = [
  "Automated animation-snap detection from bone transform deltas",
  "Foot-slide detection (foot velocity vs. ground contact)",
  "Clipping / collision mismatch from physics vs. render bounds",
  "Horse / chariot mount & attachment drift checks",
  "Frame-time spike detection from telemetry samples",
  "Multiplayer desync from client vs. server state hashes",
];
