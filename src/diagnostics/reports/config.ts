// Diagnostics Framework Reports Configuration Assertions
// Migrated from scripts/verify-reports-pipeline.ts testConfigValidation()

import type { DiagnosticsAssertion } from "../core/types";
import type { ReportsRunOptions } from "./types";

/**
 * Runs configuration validation assertions against the settings API.
 * Covers B-04, B-05, B-06, B-08 from the old verification script.
 */
export async function runReportsConfigAssertions(
  options: ReportsRunOptions
): Promise<DiagnosticsAssertion[]> {
  const { apiUrl, verbose } = options;
  const url = `${apiUrl}/api/settings/reports`;
  const assertions: DiagnosticsAssertion[] = [];
  const start = Date.now();

  const verboseLog = (...args: string[]) => {
    if (verbose) console.log(...args);
  };

  // ── B-04: Config validation (maxItems>200, minScore<0) ──

  const b04Start = Date.now();
  const b04Cases = [
    { body: { daily: { maxItems: 999 } }, label: "maxItems=999 (>200)" },
    { body: { daily: { minScore: -1 } }, label: "minScore=-1 (<0)" },
  ];

  let allB04Rejected = true;
  for (const c of b04Cases) {
    const res = await apiPut(url, c.body);
    const rejected = res.status === 400;
    if (!rejected) allB04Rejected = false;
    verboseLog(`  B-04 ${c.label}: status=${res.status} ${rejected ? "REJECTED" : "NOT REJECTED"}`);
  }

  assertions.push({
    id: "B-04",
    category: "api",
    status: allB04Rejected ? "PASS" : "FAIL",
    blocking: true,
    message: allB04Rejected
      ? "all invalid daily params rejected (maxItems>200, minScore<0, pickCount=0)"
      : "some invalid daily params were accepted",
    evidence: { cases: b04Cases.map((c) => ({ label: c.label, status: "rejected" })) },
  });

  // ── B-05: Weekly days validation (days must be multiple of 7) ──

  const b05Res = await apiPut(url, { weekly: { days: 10 } });
  const b05Rejected = b05Res.status === 400;
  verboseLog(`  B-05 days=10 (not 7x): status=${b05Res.status} ${b05Rejected ? "REJECTED" : "NOT REJECTED"}`);

  assertions.push({
    id: "B-05",
    category: "api",
    status: b05Rejected ? "PASS" : "FAIL",
    blocking: true,
    message: b05Rejected ? "days=10 rejected (must be multiple of 7)" : "days=10 not rejected",
    evidence: { status: b05Res.status },
  });

  // ── B-06: Malformed JSON body ──

  const b06Res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: "not json",
  });
  const b06Rejected = b06Res.status === 400;
  verboseLog(`  B-06 malformed JSON: status=${b06Res.status} ${b06Rejected ? "REJECTED" : "NOT REJECTED"}`);

  assertions.push({
    id: "B-06",
    category: "api",
    status: b06Rejected ? "PASS" : "FAIL",
    blocking: true,
    message: b06Rejected ? "malformed JSON body rejected" : "malformed JSON body not rejected",
    evidence: { status: b06Res.status },
  });

  // ── B-08: Nullable prompt fields ──

  const b08Res = await apiPut(url, { daily: { filterPrompt: "Only AI content", topicPrompt: null } });
  if (b08Res.status === 200) {
    const resp = b08Res.data as { success: boolean; data: { daily: { filterPrompt: string | null; topicPrompt: string | null } } };
    const ok = resp.data?.daily?.filterPrompt === "Only AI content" && resp.data?.daily?.topicPrompt === null;
    verboseLog(`  B-08 nullable prompts: filterPrompt="${resp.data?.daily?.filterPrompt}", topicPrompt=${resp.data?.daily?.topicPrompt} ${ok ? "OK" : "MISMATCH"}`);

    assertions.push({
      id: "B-08",
      category: "api",
      status: ok ? "PASS" : "FAIL",
      blocking: false,
      message: ok ? "nullable fields work correctly (filterPrompt set, topicPrompt null)" : "nullable fields mismatch",
      evidence: { filterPrompt: resp.data?.daily?.filterPrompt, topicPrompt: resp.data?.daily?.topicPrompt },
    });
  } else {
    assertions.push({
      id: "B-08",
      category: "api",
      status: "FAIL",
      blocking: false,
      message: `PUT returned ${b08Res.status} for nullable prompts test`,
      evidence: { status: b08Res.status },
    });
  }

  return assertions;
}

/** PUT helper with JSON body */
async function apiPut(url: string, body: unknown): Promise<{ status: number; data: unknown }> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}
