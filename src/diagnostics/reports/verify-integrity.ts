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
//   F-06: Content referenced by DigestTopic.contentIds has non-null url/kind
//   F-07: (Legacy) Items referenced by DigestTopic.itemIds have non-null title/url/sourceId
//   F-08: (Legacy) Tweets referenced by DigestTopic.tweetIds have non-null text/authorHandle/url

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

  // ── F-06: Referenced content has non-null core fields ─

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
      where: { id: { in: Array.from(f06ContentIds) } },
      select: { id: true, url: true, kind: true },
    });
    let f06InvalidCount = 0;
    for (const c of f06Content) {
      if (!c.url || !c.kind) f06InvalidCount++;
    }
    const f06Ok = f06InvalidCount === 0;
    verboseLog(`  F-06 content field completeness: ${f06Content.length - f06InvalidCount}/${f06Content.length} valid`);

    assertions.push({
      id: "F-06",
      category: "reports",
      status: f06Ok ? "PASS" : "FAIL",
      blocking: false,
      message: f06Ok ? "all content have required fields (url, kind)" : `${f06InvalidCount} content missing required fields`,
      evidence: { validCount: f06Content.length - f06InvalidCount, invalidCount: f06InvalidCount, totalCount: f06Content.length },
    });
  }

  // ── F-07: (Legacy) Referenced items have non-null core fields ─

  const f07Start = Date.now();
  const allTopicsForF07 = await prisma.digestTopic.findMany();
  const f07ItemIds = new Set<string>();
  for (const t of allTopicsForF07) for (const id of t.itemIds) f07ItemIds.add(id);

  if (f07ItemIds.size === 0) {
    assertions.push({
      id: "F-07",
      category: "reports",
      status: "SKIP",
      blocking: false,
      message: "no referenced legacy items to verify",
      evidence: { itemCount: 0 },
    });
  } else {
    const f07Items = await prisma.item.findMany({
      where: { id: { in: Array.from(f07ItemIds) } },
      select: { id: true, title: true, url: true, sourceId: true },
    });
    let f07InvalidCount = 0;
    for (const item of f07Items) {
      if (!item.title || !item.url || !item.sourceId) f07InvalidCount++;
    }
    const f07Ok = f07InvalidCount === 0;
    verboseLog(`  F-07 legacy item field completeness: ${f07Items.length - f07InvalidCount}/${f07Items.length} valid`);

    assertions.push({
      id: "F-07",
      category: "reports",
      status: f07Ok ? "PASS" : "FAIL",
      blocking: false,
      message: f07Ok ? "all legacy items have required fields (title, url, sourceId)" : `${f07InvalidCount} legacy items missing required fields`,
      evidence: { validCount: f07Items.length - f07InvalidCount, invalidCount: f07InvalidCount, totalCount: f07Items.length },
    });
  }

  // ── F-08: (Legacy) Referenced tweets have valid fields ─────────

  const f08Start = Date.now();
  const allTopicsForF08 = await prisma.digestTopic.findMany();
  const f08TweetIds = new Set<string>();
  for (const t of allTopicsForF08) for (const id of t.tweetIds) f08TweetIds.add(id);

  if (f08TweetIds.size === 0) {
    assertions.push({
      id: "F-08",
      category: "reports",
      status: "SKIP",
      blocking: false,
      message: "no referenced legacy tweets to verify",
      evidence: { tweetCount: 0 },
    });
  } else {
    const f08Tweets = await prisma.tweet.findMany({
      where: { id: { in: Array.from(f08TweetIds) } },
      select: { id: true, text: true, authorHandle: true, url: true },
    });
    let f08InvalidCount = 0;
    for (const tweet of f08Tweets) {
      if (!tweet.text || !tweet.authorHandle || !tweet.url) f08InvalidCount++;
    }
    const f08Ok = f08InvalidCount === 0;
    verboseLog(`  F-08 legacy tweet field completeness: ${f08Tweets.length - f08InvalidCount}/${f08Tweets.length} valid`);

    assertions.push({
      id: "F-08",
      category: "reports",
      status: f08Ok ? "PASS" : "FAIL",
      blocking: false,
      message: f08Ok ? "all legacy tweets have required fields (text, authorHandle, url)" : `${f08InvalidCount} legacy tweets missing required fields`,
      evidence: { validCount: f08Tweets.length - f08InvalidCount, invalidCount: f08InvalidCount, totalCount: f08Tweets.length },
    });
  }

  return assertions;
}
