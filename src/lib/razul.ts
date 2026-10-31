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


export const categoryLabel = (c: string) => CATEGORIES.find(([k]) => k === c)?.[1] ?? c;

// Findings from read-only inspection of each project's code (no project was modified).
export const INTEGRATIONS: {
  id: "razul-hub" | "anomaly-legacy" | "jackboy" | "omni";
  name: string;
  ref: string;
  handshake: "live" | "defined_needs_secrets" | "none";
  finding: string;
  prerequisites: string[];
}[] = [
  {
    id: "razul-hub", name: "Razul hub (this project)", ref: "this project", handshake: "live",
    finding: "Agent API live here: GET /api/public/agents/v1/whoami, GET|POST /api/public/agents/v1/issues. rza_ bearer credential + per-project grant required; every call audited.",
    prerequisites: ["Owner creates an agent, issues a credential, grants qa:read / qa:report on razul-hub"],
  },
  {
    id: "jackboy", name: "Jackboy Developer Console", ref: "72823346-c174-4e90-9e17-671e197837c5", handshake: "defined_needs_secrets",
    finding: "Jackboy already exposes POST /api/public/agent-ingest (Bearer jbk_ project token, owner-enrolled project, write-only, rate-limited, audited). Razul relays issues there as AngelTech 'diagnostic' reports via POST /api/public/agents/v1/relay/jackboy.",
    prerequisites: [
      "In Jackboy: enroll a project for Razul and issue its jbk_ ingest token (Jackboy owner, in Jackboy)",
      "Here: add secrets JACKBOY_BASE_URL (Jackboy's reachable app URL) and JACKBOY_INGEST_TOKEN",
      "Grant the agent qa:report on jackboy",
      "Note: Jackboy's own Razul module expects a different research-feed API (RAZUL_API_URL /v1/search, /v1/feed) that this QA hub does not provide",
    ],
  },
  {
    id: "anomaly-legacy", name: "Anomaly Legacy", ref: "bc815e5c-10a5-405a-9e24-733180ad008f", handshake: "none",
    finding: "Has human QA (invite links, issue list) but no machine/agent endpoint. Agents cannot access it yet.",
    prerequisites: ["Anomaly Legacy owner adds an agent endpoint (e.g. evidence export or issue read) verifying a scoped token", "Then add its URL + token here and grant scopes on anomaly-legacy"],
  },
  {
    id: "omni", name: "OMNI", ref: "Not confirmed (closest match: 'Orbiting Minds Mothership' f02f1b04-…)", handshake: "none",
    finding: "No OMNI project confirmed and no agent handshake found.",
    prerequisites: ["Owner confirms which project is OMNI", "OMNI exposes a token-verified agent endpoint"],
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
