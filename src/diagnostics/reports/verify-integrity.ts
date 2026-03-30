// Diagnostics Framework Reports Integrity Verification
// Migrated from scripts/verify-reports-pipeline.ts testCrossPipelineIntegrity()
//
// Content model: These cross-pipeline integrity checks verify the contract
// between daily and weekly reports using the Content unified model.
//
// Key invariants:
//   F-01: DigestTopic.dailyId -> DailyOverview.id (no orphans)
//   F-03: WeeklyPick.weeklyId -> WeeklyReport.id (no orphans)
//   F-04: DailyOverview.topicCount === actual DigestTopic count
//   F-05: Every WeeklyPick.contentId appears in some DigestTopic.contentIds
//         (weekly only consumes what daily produced)
//   F-06: Content (article) referenced by DigestTopic.contentIds has non-null title/url
//   F-07: Content (tweet) referenced by DigestTopic.contentIds has non-null body/authorLabel/url

import { prisma } from "@/lib/prisma";
import { formatUtcDate } from "@/lib/date-utils";
import type { DiagnosticsAssertion } from "../core/types";
import type { ReportsRunOptions } from "./types";

/**
 * Parse a week number string like "2026-W13" into the Monday date of that week.
 * Returns a Date at 00:00:00.000 UTC representing the start of that ISO week.
 */
function parseWeekNumber(weekNumber: string): Date {
  const [yearStr, weekStr] = weekNumber.split("-W");
  const year = parseInt(yearStr, 10);
  const weekNum = parseInt(weekStr, 10);

  // Jan 4 is always in ISO week 1 per ISO 8601.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Days to go back from jan4 to reach Monday of week 1.
  // Mon(1)->0, Tue(2)->1, Wed(3)->2, Thu(4)->3, Fri(5)->4, Sat(6)->5, Sun(0)->6
  const daysToMonday = jan4Day === 0 ? 6 : jan4Day - 1;
  const week1Monday = new Date(Date.UTC(year, 0, 4 - daysToMonday));

  // Add (weekNum - 1) weeks to get the Monday of the target week
  const targetMonday = new Date(week1Monday.getTime() + (weekNum - 1) * 7 * 24 * 60 * 60 * 1000);
  return targetMonday;
}

/**
 * Runs cross-pipeline integrity assertions (F-01 through F-07).
 */
export async function runIntegrityAssertions(
  options: ReportsRunOptions
): Promise<DiagnosticsAssertion[]> {
  const { verbose } = options;
  const assertions: DiagnosticsAssertion[] = [];
  const verboseLog = (...args: string[]) => {
    if (verbose) console.log(...args);
  };

  // ── F-01: No orphaned DigestTopics ─────────────────────

  const f01Start = Date.now();
  const allTopics = await prisma.digestTopic.findMany({ select: { dailyId: true } });
  const dailyIds = new Set((await prisma.dailyOverview.findMany({ select: { id: true } })).map((d) => d.id));
  const f01Orphans = allTopics.filter((t) => !dailyIds.has(t.dailyId));
  const f01Ok = f01Orphans.length === 0;
  verboseLog(`  F-01 DigestTopic orphans: ${f01Orphans.length} (total ${allTopics.length})`);

  assertions.push({
    id: "F-01",
    category: "reports",
    status: f01Ok ? "PASS" : "FAIL",
    blocking: false,
    message: f01Ok ? "no orphaned DigestTopics" : `${f01Orphans.length} orphaned DigestTopics`,
    evidence: { orphanCount: f01Orphans.length, totalCount: allTopics.length },
  });

  // ── F-03: No orphaned WeeklyPicks ─────────────────────

  const f03Start = Date.now();
  const allPicks = await prisma.weeklyPick.findMany({ select: { weeklyId: true } });
  const weeklyIds = new Set((await prisma.weeklyReport.findMany({ select: { id: true } })).map((w) => w.id));
  const f03Orphans = allPicks.filter((p) => !weeklyIds.has(p.weeklyId));
  const f03Ok = f03Orphans.length === 0;
  verboseLog(`  F-03 WeeklyPick orphans: ${f03Orphans.length} (total ${allPicks.length})`);

  assertions.push({
    id: "F-03",
    category: "reports",
    status: f03Ok ? "PASS" : "FAIL",
    blocking: false,
    message: f03Ok ? "no orphaned WeeklyPicks" : `${f03Orphans.length} orphaned WeeklyPicks`,
    evidence: { orphanCount: f03Orphans.length, totalCount: allPicks.length },
  });

  // ── F-04: topicCount accuracy ─────────────────────────

  const f04Start = Date.now();
  const overviews = await prisma.dailyOverview.findMany({
    include: { topics: true },
  });
  let f04MismatchCount = 0;
  for (const ov of overviews) {
    if (ov.topicCount !== ov.topics.length) {
      f04MismatchCount++;
      verboseLog(`  F-04 ${ov.date}: stored=${ov.topicCount}, actual=${ov.topics.length}`);
    }
  }
  const f04Ok = f04MismatchCount === 0;

  assertions.push({
    id: "F-04",
    category: "reports",
    status: f04Ok ? "PASS" : "FAIL",
    blocking: false,
    message: f04Ok ? `all ${overviews.length} overviews correct` : `${f04MismatchCount}/${overviews.length} topicCount mismatches`,
    evidence: { mismatchCount: f04MismatchCount, totalOverviews: overviews.length },
  });

  // ── F-05: Weekly pick items come from daily topic content ─

  const f05Start = Date.now();
  const weeklyReports = await prisma.weeklyReport.findMany({
    include: { picks: true },
  });

  if (weeklyReports.length === 0) {
    assertions.push({
      id: "F-05",
      category: "reports",
      status: "SKIP",
      blocking: false,
      message: "no weekly reports to verify",
      evidence: { weeklyReportCount: 0 },
    });
  } else {
    const dailyOverviews = await prisma.dailyOverview.findMany({
      include: { topics: true },
      orderBy: { date: "asc" },
    });

    // Index daily overviews by date string (YYYY-MM-DD) for efficient range queries
    // Note: DailyOverview.date is stored as a String (YYYY-MM-DD), not a DateTime
    const dailyByDate = new Map<string, typeof dailyOverviews[0]>();
    for (const daily of dailyOverviews) {
      dailyByDate.set(daily.date, daily);
    }

    let f05NotFromDaily = 0;
    let f05TotalPicks = 0;

    for (const report of weeklyReports) {
      // Calculate the week range (Monday to Sunday) for this weekly report
      const weekStart = parseWeekNumber(report.weekNumber);
      const weekEnd = new Date(weekStart.getTime());
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

      // Collect contentIds from daily overviews within this week only
      const weeklyDailyTopicContentIds = new Set<string>();
      const current = new Date(weekStart);
      while (current <= weekEnd) {
        const dateStr = formatUtcDate(current);
        const daily = dailyByDate.get(dateStr);
        if (daily) {
          for (const topic of daily.topics) {
            for (const id of topic.contentIds) weeklyDailyTopicContentIds.add(id);
          }
        }
        current.setUTCDate(current.getUTCDate() + 1);
      }

      // Check each pick of this weekly report (contentId is the new field)
      for (const pick of report.picks) {
        if (pick.contentId) {
          f05TotalPicks++;
          if (!weeklyDailyTopicContentIds.has(pick.contentId)) {
            f05NotFromDaily++;
          }
        }
      }
    }

    const f05Ok = f05NotFromDaily === 0;
    verboseLog(`  F-05 weekly picks from daily topics: ${f05TotalPicks - f05NotFromDaily}/${f05TotalPicks}`);

    assertions.push({
      id: "F-05",
      category: "reports",
      status: f05Ok ? "PASS" : "FAIL",
      blocking: false,
      message: f05Ok
        ? "all weekly pick content from daily topics"
        : `${f05NotFromDaily}/${f05TotalPicks} weekly pick content not from daily topics`,
      evidence: { totalPicks: f05TotalPicks, notFromDaily: f05NotFromDaily },
    });
  }

  // ── F-06: Content (article) has non-null title/url ─

  const f06Start = Date.now();
  const allTopicsForF06 = await prisma.digestTopic.findMany();
  const f06ContentIds = new Set<string>();
  for (const t of allTopicsForF06) for (const id of t.contentIds) f06ContentIds.add(id);

  if (f06ContentIds.size === 0) {
    assertions.push({
      id: "F-06",
      category: "reports",
      status: "SKIP",
      blocking: false,
      message: "no referenced content to verify",
      evidence: { contentCount: 0 },
    });
  } else {
    const f06Content = await prisma.content.findMany({
      where: { id: { in: Array.from(f06ContentIds) }, kind: "article" },
      select: { id: true, title: true, url: true },
    });
    let f06InvalidCount = 0;
    for (const c of f06Content) {
      if (!c.title || !c.url) f06InvalidCount++;
    }
    const f06Ok = f06InvalidCount === 0;
    verboseLog(`  F-06 article field completeness: ${f06Content.length - f06InvalidCount}/${f06Content.length} valid`);

    assertions.push({
      id: "F-06",
      category: "reports",
      status: f06Ok ? "PASS" : "FAIL",
      blocking: false,
      message: f06Ok ? `all ${f06Content.length} articles have required fields (title, url)` : `${f06InvalidCount}/${f06Content.length} articles missing required fields`,
      evidence: { validCount: f06Content.length - f06InvalidCount, invalidCount: f06InvalidCount, totalCount: f06Content.length },
    });
  }

  // ── F-07: Content (tweet) has non-null body/authorLabel/url ─

  const f07Start = Date.now();
  const allTopicsForF07 = await prisma.digestTopic.findMany();
  const f07ContentIds = new Set<string>();
  for (const t of allTopicsForF07) for (const id of t.contentIds) f07ContentIds.add(id);

  if (f07ContentIds.size === 0) {
    assertions.push({
      id: "F-07",
      category: "reports",
      status: "SKIP",
      blocking: false,
      message: "no referenced content to verify",
      evidence: { contentCount: 0 },
    });
  } else {
    const f07Content = await prisma.content.findMany({
      where: { id: { in: Array.from(f07ContentIds) }, kind: "tweet" },
      select: { id: true, body: true, authorLabel: true, url: true },
    });
    let f07InvalidCount = 0;
    for (const c of f07Content) {
      if (!c.body || !c.authorLabel || !c.url) f07InvalidCount++;
    }
    const f07Ok = f07InvalidCount === 0;
    verboseLog(`  F-07 tweet field completeness: ${f07Content.length - f07InvalidCount}/${f07Content.length} valid`);

    assertions.push({
      id: "F-07",
      category: "reports",
      status: f07Ok ? "PASS" : "FAIL",
      blocking: false,
      message: f07Ok ? `all ${f07Content.length} tweets have required fields (body, authorLabel, url)` : `${f07InvalidCount}/${f07Content.length} tweets missing required fields`,
      evidence: { validCount: f07Content.length - f07InvalidCount, invalidCount: f07InvalidCount, totalCount: f07Content.length },
    });
  }

  return assertions;
}
