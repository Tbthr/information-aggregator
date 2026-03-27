// Diagnostics Framework Reports Integrity Verification
// Migrated from scripts/verify-reports-pipeline.ts testCrossPipelineIntegrity()
//
// Compatibility: These cross-pipeline integrity checks verify the contract
// between daily and weekly reports after the scoring pipeline refactor.
//
// Key invariants:
//   F-01: DigestTopic.dailyId -> DailyOverview.id (no orphans)
//   F-03: WeeklyPick.weeklyId -> WeeklyReport.id (no orphans)
//   F-04: DailyOverview.topicCount === actual DigestTopic count
//   F-05: Every WeeklyPick.itemId appears in some DigestTopic.itemIds
//         (weekly only consumes what daily produced)
//   F-06: Items referenced by DigestTopic.itemIds have non-null title/url/sourceId
//   F-07: Tweets referenced by DigestTopic.tweetIds have non-null text/authorHandle/url
//
// The daily pipeline now uses runtime scoring (ReportCandidate + ScoredCandidate),
// but the persisted output shape (itemIds/tweetIds on DigestTopic) is unchanged.
// These checks ensure the weekly-daily data contract is maintained.

import { prisma } from "@/lib/prisma";
import type { DiagnosticsAssertion } from "../core/types";
import type { ReportsRunOptions } from "./types";

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

  // ── F-05: Weekly pick items come from daily topic items ─

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
      orderBy: { date: "desc" },
    });

    // Collect all topic itemIds from daily reports
    const dailyTopicItemIds = new Set<string>();
    for (const daily of dailyOverviews) {
      for (const topic of daily.topics) {
        for (const id of topic.itemIds) dailyTopicItemIds.add(id);
      }
    }

    let f05NotFromDaily = 0;
    let f05TotalPicks = 0;
    for (const report of weeklyReports) {
      for (const pick of report.picks) {
        f05TotalPicks++;
        if (!dailyTopicItemIds.has(pick.itemId)) {
          f05NotFromDaily++;
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
        ? "all weekly pick items from daily topics"
        : `${f05NotFromDaily}/${f05TotalPicks} weekly pick items not from daily topics`,
      evidence: { totalPicks: f05TotalPicks, notFromDaily: f05NotFromDaily },
    });
  }

  // ── F-06: Referenced items have non-null core fields ─

  const f06Start = Date.now();
  const allTopicsForF06 = await prisma.digestTopic.findMany();
  const f06ItemIds = new Set<string>();
  for (const t of allTopicsForF06) for (const id of t.itemIds) f06ItemIds.add(id);

  if (f06ItemIds.size === 0) {
    assertions.push({
      id: "F-06",
      category: "reports",
      status: "SKIP",
      blocking: false,
      message: "no referenced items to verify",
      evidence: { itemCount: 0 },
    });
  } else {
    const f06Items = await prisma.item.findMany({
      where: { id: { in: Array.from(f06ItemIds) } },
      select: { id: true, title: true, url: true, sourceId: true },
    });
    let f06InvalidCount = 0;
    for (const item of f06Items) {
      if (!item.title || !item.url || !item.sourceId) f06InvalidCount++;
    }
    const f06Ok = f06InvalidCount === 0;
    verboseLog(`  F-06 item field completeness: ${f06Items.length - f06InvalidCount}/${f06Items.length} valid`);

    assertions.push({
      id: "F-06",
      category: "reports",
      status: f06Ok ? "PASS" : "FAIL",
      blocking: false,
      message: f06Ok ? "all items have required fields (title, url, sourceId)" : `${f06InvalidCount} items missing required fields`,
      evidence: { validCount: f06Items.length - f06InvalidCount, invalidCount: f06InvalidCount, totalCount: f06Items.length },
    });
  }

  // ── F-07: Referenced tweets have valid fields ─────────

  const f07Start = Date.now();
  const allTopicsForF07 = await prisma.digestTopic.findMany();
  const f07TweetIds = new Set<string>();
  for (const t of allTopicsForF07) for (const id of t.tweetIds) f07TweetIds.add(id);

  if (f07TweetIds.size === 0) {
    assertions.push({
      id: "F-07",
      category: "reports",
      status: "SKIP",
      blocking: false,
      message: "no referenced tweets to verify",
      evidence: { tweetCount: 0 },
    });
  } else {
    const f07Tweets = await prisma.tweet.findMany({
      where: { id: { in: Array.from(f07TweetIds) } },
      select: { id: true, text: true, authorHandle: true, url: true },
    });
    let f07InvalidCount = 0;
    for (const tweet of f07Tweets) {
      if (!tweet.text || !tweet.authorHandle || !tweet.url) f07InvalidCount++;
    }
    const f07Ok = f07InvalidCount === 0;
    verboseLog(`  F-07 tweet field completeness: ${f07Tweets.length - f07InvalidCount}/${f07Tweets.length} valid`);

    assertions.push({
      id: "F-07",
      category: "reports",
      status: f07Ok ? "PASS" : "FAIL",
      blocking: false,
      message: f07Ok ? "all tweets have required fields (text, authorHandle, url)" : `${f07InvalidCount} tweets missing required fields`,
      evidence: { validCount: f07Tweets.length - f07InvalidCount, invalidCount: f07InvalidCount, totalCount: f07Tweets.length },
    });
  }

  return assertions;
}
