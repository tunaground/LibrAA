import type {
  LaaFile,
  SeriesI18n,
  ThreadI18n,
  ResponseI18n,
} from "../types";
import {
  getAllSeries,
  getThreads,
  getResponses,
  createSeries,
  createThreadWithResponses,
} from "./db";

export function serializeLaa(
  series: {
    i18n: Record<string, SeriesI18n>;
    tags: string[];
  } | undefined,
  threads: Array<{
    i18n: Record<string, ThreadI18n>;
    tags: string[];
    responses: Array<{
      sequence?: number;
      postedAt?: string;
      i18n: Record<string, ResponseI18n>;
    }>;
  }>,
): string {
  const laaFile: LaaFile = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    series,
    threads,
  };
  return JSON.stringify(laaFile, null, 2);
}

export function deserializeLaa(json: string): LaaFile {
  const data = JSON.parse(json) as LaaFile;
  if (data.version !== "1.0") {
    throw new Error(`Unsupported .laa version: ${data.version}`);
  }
  return data;
}

export async function exportSeries(seriesId: string): Promise<string> {
  const allSeries = await getAllSeries();
  const series = allSeries.find((s) => s.id === seriesId);
  if (!series) throw new Error("Series not found");

  const threads = await getThreads(seriesId);
  const threadsWithResponses = await Promise.all(
    threads.map(async (thread) => {
      const responses = await getResponses(thread.id);
      return {
        i18n: thread.i18n,
        tags: thread.tags,
        responses: responses.map((r) => ({
          sequence: r.sequence ?? undefined,
          postedAt: r.postedAt ?? undefined,
          i18n: r.i18n,
        })),
      };
    }),
  );

  return serializeLaa(
    { i18n: series.i18n, tags: series.tags },
    threadsWithResponses,
  );
}

export async function exportThread(threadId: string): Promise<string> {
  const allSeries = await getAllSeries();
  const threads = await getThreads(null);
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) throw new Error("Thread not found");

  const responses = await getResponses(threadId);

  // Include series info if thread belongs to one
  let seriesData: { i18n: Record<string, SeriesI18n>; tags: string[] } | undefined;
  if (thread.seriesId) {
    const series = allSeries.find((s) => s.id === thread.seriesId);
    if (series) {
      seriesData = { i18n: series.i18n, tags: series.tags };
    }
  }

  return serializeLaa(seriesData, [
    {
      i18n: thread.i18n,
      tags: thread.tags,
      responses: responses.map((r) => ({
        sequence: r.sequence ?? undefined,
        postedAt: r.postedAt ?? undefined,
        i18n: r.i18n,
      })),
    },
  ]);
}

export async function importLaa(json: string, targetSeriesId?: string | null): Promise<void> {
  const data = deserializeLaa(json);

  let seriesId: string | null = targetSeriesId ?? null;

  // Create series if present and has data (only if no target series specified)
  if (!targetSeriesId && data.series && Object.keys(data.series.i18n).length > 0) {
    seriesId = await createSeries(data.series.i18n, data.series.tags);
  }

  // Create threads with responses
  for (const thread of data.threads) {
    await createThreadWithResponses(
      seriesId,
      thread.i18n,
      thread.tags,
      thread.responses.map((r) => ({
        sequence: r.sequence ?? null,
        postedAt: r.postedAt ?? null,
        i18n: r.i18n,
      })),
    );
  }
}
