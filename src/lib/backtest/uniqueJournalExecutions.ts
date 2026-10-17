import type { JournalRecord } from "./types";

export interface JournalExecutionSelection {
  records: JournalRecord[];
  ambiguousExecutionCount: number;
  duplicateRecordCount: number;
}

/**
 * Resolve historical trade executions without mutating persisted records.
 *
 * Identity: (sessionId, trade.id).
 * Latest createdAt wins; journal ID breaks timestamp ties.
 *
 * If the winning versions have identical timestamps and journal IDs
 * but conflicting contents, exclude that execution from calculations.
 *
 * No-trade decisions and trades without IDs remain independent.
 */
export function selectJournalExecutions(records: JournalRecord[]): JournalExecutionSelection {
  const groups = new Map<string, JournalRecord[]>();
  const retained = new Set<JournalRecord>();
  let ambiguousExecutionCount = 0;
  let duplicateRecordCount = 0;

  for (const record of records) {
    if (record.kind !== "trade" || !record.trade?.id) {
      retained.add(record);
      continue;
    }

    const key = JSON.stringify([record.sessionId, record.trade.id]);
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    duplicateRecordCount += group.length - 1;

    const ordered = [...group].sort(
      (a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id),
    );

    const winner = ordered[0];
    if (!winner) continue;

    const tied = ordered.filter(
      (record) => record.createdAt === winner.createdAt && record.id === winner.id,
    );

    const fingerprints = new Set(tied.map((record) => JSON.stringify(record)));

    if (fingerprints.size > 1) {
      ambiguousExecutionCount++;
      continue;
    }

    retained.add(winner);
  }

  return {
    records: records.filter((record) => retained.has(record)),
    ambiguousExecutionCount,
    duplicateRecordCount,
  };
}

export function uniqueJournalExecutions(records: JournalRecord[]): JournalRecord[] {
  return selectJournalExecutions(records).records;
}
