import { describe, expect, it } from "vitest";
import { authorize, isWellFormedAgentToken, toJackboySeverity } from "./agent-policy";

const future = new Date(Date.now() + 864e5).toISOString();
const past = new Date(Date.now() - 1000).toISOString();
const qa = { status: "active", duties: ["qa_observer"], role: "sentinel" };

describe("agent authorization", () => {
  it("allows a scoped, active grant for the same project", () => {
    expect(authorize(qa, [{ target: "razul-hub", scopes: ["qa:read"], expires_at: future, revoked_at: null }], "razul-hub", "qa:read").ok).toBe(true);
  });
  it("denies a grant for a different project", () => {
    expect(authorize(qa, [{ target: "jackboy", scopes: ["qa:read"], expires_at: future, revoked_at: null }], "razul-hub", "qa:read").ok).toBe(false);
  });
  it("denies a scope the grant does not include", () => {
    expect(authorize(qa, [{ target: "razul-hub", scopes: ["qa:read"], expires_at: future, revoked_at: null }], "razul-hub", "qa:report").ok).toBe(false);
  });
  it("denies expired and revoked grants", () => {
    expect(authorize(qa, [{ target: "razul-hub", scopes: ["qa:read"], expires_at: past, revoked_at: null }], "razul-hub", "qa:read").ok).toBe(false);
    expect(authorize(qa, [{ target: "razul-hub", scopes: ["qa:read"], expires_at: future, revoked_at: past }], "razul-hub", "qa:read").ok).toBe(false);
  });
  it("denies paused or revoked agents", () => {
    const g = [{ target: "razul-hub", scopes: ["qa:read"], expires_at: future, revoked_at: null }];
    expect(authorize({ ...qa, status: "paused" }, g, "razul-hub", "qa:read").ok).toBe(false);
    expect(authorize({ ...qa, status: "revoked" }, g, "razul-hub", "qa:read").ok).toBe(false);
  });
  it("requires the developer duty for dev scopes", () => {
    const g = [{ target: "razul-hub", scopes: ["dev:propose"], expires_at: future, revoked_at: null }];
    expect(authorize(qa, g, "razul-hub", "dev:propose")).toEqual({ ok: false, reason: "dev_duty_required" });
    expect(authorize({ status: "active", duties: ["qa_observer", "developer"] }, g, "razul-hub", "dev:propose").ok).toBe(true);
  });
  it("reserves security inspection to DemonTech and research to AngelTech", () => {
    const g = [{ target: "jackboy", scopes: ["security:inspect", "research:propose"], expires_at: future, revoked_at: null }];
    expect(authorize(qa, g, "jackboy", "security:inspect")).toEqual({ ok: false, reason: "role_demontech_required" });
    expect(authorize({ ...qa, role: "demontech" }, g, "jackboy", "security:inspect").ok).toBe(true);
    expect(authorize({ ...qa, role: "demontech" }, g, "jackboy", "research:propose").ok).toBe(false);
    expect(authorize({ ...qa, role: "angeltech" }, g, "jackboy", "research:propose").ok).toBe(true);
  });
  it("validates token format and maps severities", () => {
    expect(isWellFormedAgentToken("rza_" + "a".repeat(64))).toBe(true);
    expect(isWellFormedAgentToken("jbk_" + "a".repeat(64))).toBe(false);
    expect(toJackboySeverity("blocker")).toBe("critical");
    expect(toJackboySeverity("major")).toBe("high");
  });
});
