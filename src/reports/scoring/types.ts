import type { ReportCandidate, SignalScores, ScoreBreakdown } from "../../types/index";

// Re-export shared types for use by scoring sub-modules
export type { ReportCandidate, SignalScores, ScoreBreakdown } from "../../types/index";

// Stage input/output types

export interface BaseStageInput {
  candidate: ReportCandidate;
  kindPreferences: KindPreferences;
}

export interface BaseStageOutput {
  baseScore: number;
}

export interface KindPreferences {
  articles?: number;
  tweets?: number;
}

export interface KindSignalStageInput {
  candidate: ReportCandidate;
}

export interface KindSignalStageOutput {
  signalScores: SignalScores;
}

export interface MergeStageInput {
  baseScore: number;
  signalScores: SignalScores;
}

export interface MergeStageOutput {
  runtimeScore: number;
}

export interface HistoryPenaltyStageInput {
  runtimeScore: number;
  candidate: ReportCandidate;
  recentCandidates: ReportCandidate[];
  windowDays?: number;
}

export interface HistoryPenaltyStageOutput {
  historyPenalty: number;
  finalScore: number;
}

export interface ScoredCandidate extends ReportCandidate {
  breakdown: ScoreBreakdown;
}
