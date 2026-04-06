import Database from "@tauri-apps/plugin-sql";
import { v4 as uuidv4 } from "uuid";
import type {
  Series,
  SeriesI18n,
  Thread,
  ThreadI18n,
  Response,
  ResponseI18n,
} from "../types";

let db: Database | null = null;

export async function initDb(): Promise<void> {
  db = await Database.load("sqlite:libraa.db");
  await db.execute("PRAGMA foreign_keys = ON");
}

function getDb(): Database {
  if (!db) throw new Error("Database not initialized");
  return db;
}

function now(): string {
  return new Date().toISOString();
}

// --- Series ---

export async function getAllSeries(): Promise<Series[]> {
  const d = getDb();
  const rows = await d.select<
    Array<{ id: string; sort_order: number; created_at: string; updated_at: string }>
  >("SELECT * FROM series ORDER BY sort_order, created_at");

  const result: Series[] = [];
  for (const row of rows) {
    const i18nRows = await d.select<
      Array<{ locale: string; name: string | null; author: string | null; link: string | null }>
    >("SELECT * FROM series_i18n WHERE series_id = $1", [row.id]);

    const tagRows = await d.select<Array<{ tag: string }>>(
      "SELECT tag FROM series_tags WHERE series_id = $1",
      [row.id],
    );

    const i18n: Record<string, SeriesI18n> = {};
    for (const ir of i18nRows) {
      i18n[ir.locale] = {
        name: ir.name ?? undefined,
        author: ir.author ?? undefined,
        link: ir.link ?? undefined,
      };
    }

    result.push({
      id: row.id,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      i18n,
      tags: tagRows.map((t) => t.tag),
    });
  }
  return result;
}

export async function createSeries(
  i18n: Record<string, SeriesI18n>,
  tags: string[] = [],
): Promise<string> {
  const d = getDb();
  const id = uuidv4();
  const ts = now();

  await d.execute(
    "INSERT INTO series (id, sort_order, created_at, updated_at) VALUES ($1, 0, $2, $3)",
    [id, ts, ts],
  );

  for (const [locale, fields] of Object.entries(i18n)) {
    await d.execute(
      "INSERT INTO series_i18n (series_id, locale, name, author, link) VALUES ($1, $2, $3, $4, $5)",
      [id, locale, fields.name ?? null, fields.author ?? null, fields.link ?? null],
    );
  }

  for (const tag of tags) {
    await d.execute(
      "INSERT INTO series_tags (series_id, tag) VALUES ($1, $2)",
      [id, tag],
    );
  }

  return id;
}

export async function updateSeriesI18n(
  seriesId: string,
  locale: string,
  fields: SeriesI18n,
): Promise<void> {
  const d = getDb();
  await d.execute(
    `INSERT INTO series_i18n (series_id, locale, name, author, link)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (series_id, locale)
     DO UPDATE SET name = $3, author = $4, link = $5`,
    [seriesId, locale, fields.name ?? null, fields.author ?? null, fields.link ?? null],
  );
  await d.execute("UPDATE series SET updated_at = $1 WHERE id = $2", [now(), seriesId]);
}

export async function updateSeriesTags(seriesId: string, tags: string[]): Promise<void> {
  const d = getDb();
  await d.execute("DELETE FROM series_tags WHERE series_id = $1", [seriesId]);
  for (const tag of tags) {
    await d.execute("INSERT INTO series_tags (series_id, tag) VALUES ($1, $2)", [seriesId, tag]);
  }
  await d.execute("UPDATE series SET updated_at = $1 WHERE id = $2", [now(), seriesId]);
}

export async function getAllTags(): Promise<string[]> {
  const d = getDb();
  const rows = await d.select<Array<{ tag: string }>>(
    "SELECT DISTINCT tag FROM series_tags UNION SELECT DISTINCT tag FROM thread_tags ORDER BY tag",
  );
  return rows.map((r) => r.tag);
}

export async function deleteSeries(id: string): Promise<void> {
  const d = getDb();
  await d.execute("DELETE FROM series WHERE id = $1", [id]);
}

// --- Threads ---

export async function getThreads(seriesId: string | null): Promise<Thread[]> {
  const d = getDb();
  let rows: Array<{
    id: string;
    series_id: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
  }>;

  if (seriesId === null) {
    rows = await d.select(
      "SELECT * FROM threads ORDER BY sort_order, created_at",
    );
  } else {
    rows = await d.select(
      "SELECT * FROM threads WHERE series_id = $1 ORDER BY sort_order, created_at",
      [seriesId],
    );
  }

  const result: Thread[] = [];
  for (const row of rows) {
    const i18nRows = await d.select<
      Array<{
        locale: string;
        name: string | null;
        author: string | null;
        first_posted_at: string | null;
        last_posted_at: string | null;
        link: string | null;
      }>
    >("SELECT * FROM thread_i18n WHERE thread_id = $1", [row.id]);

    const tagRows = await d.select<Array<{ tag: string }>>(
      "SELECT tag FROM thread_tags WHERE thread_id = $1",
      [row.id],
    );

    const countRows = await d.select<Array<{ count: number }>>(
      "SELECT COUNT(*) as count FROM responses WHERE thread_id = $1",
      [row.id],
    );

    const i18n: Record<string, ThreadI18n> = {};
    for (const ir of i18nRows) {
      i18n[ir.locale] = {
        name: ir.name ?? undefined,
        author: ir.author ?? undefined,
        firstPostedAt: ir.first_posted_at ?? undefined,
        lastPostedAt: ir.last_posted_at ?? undefined,
        link: ir.link ?? undefined,
      };
    }

    result.push({
      id: row.id,
      seriesId: row.series_id,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      i18n,
      tags: tagRows.map((t) => t.tag),
      responseCount: countRows[0]?.count ?? 0,
    });
  }
  return result;
}

export async function createThread(
  seriesId: string | null,
  i18n: Record<string, ThreadI18n>,
  tags: string[] = [],
): Promise<string> {
  const d = getDb();
  const id = uuidv4();
  const ts = now();

  await d.execute(
    "INSERT INTO threads (id, series_id, sort_order, created_at, updated_at) VALUES ($1, $2, 0, $3, $4)",
    [id, seriesId, ts, ts],
  );

  for (const [locale, fields] of Object.entries(i18n)) {
    await d.execute(
      `INSERT INTO thread_i18n (thread_id, locale, name, author, first_posted_at, last_posted_at, link)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        locale,
        fields.name ?? null,
        fields.author ?? null,
        fields.firstPostedAt ?? null,
        fields.lastPostedAt ?? null,
        fields.link ?? null,
      ],
    );
  }

  for (const tag of tags) {
    await d.execute("INSERT INTO thread_tags (thread_id, tag) VALUES ($1, $2)", [id, tag]);
  }

  return id;
}

export async function updateThreadI18n(
  threadId: string,
  locale: string,
  fields: ThreadI18n,
): Promise<void> {
  const d = getDb();
  await d.execute(
    `INSERT INTO thread_i18n (thread_id, locale, name, author, first_posted_at, last_posted_at, link)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (thread_id, locale)
     DO UPDATE SET name = $3, author = $4, first_posted_at = $5, last_posted_at = $6, link = $7`,
    [
      threadId,
      locale,
      fields.name ?? null,
      fields.author ?? null,
      fields.firstPostedAt ?? null,
      fields.lastPostedAt ?? null,
      fields.link ?? null,
    ],
  );
  await d.execute("UPDATE threads SET updated_at = $1 WHERE id = $2", [now(), threadId]);
}

export async function updateThreadSeriesId(
  threadId: string,
  seriesId: string | null,
): Promise<void> {
  const d = getDb();
  await d.execute("UPDATE threads SET series_id = $1, updated_at = $2 WHERE id = $3", [
    seriesId,
    now(),
    threadId,
  ]);
}

export async function updateThreadSortOrder(threadId: string, sortOrder: number): Promise<void> {
  const d = getDb();
  await d.execute("UPDATE threads SET sort_order = $1, updated_at = $2 WHERE id = $3", [
    sortOrder,
    now(),
    threadId,
  ]);
}

export async function updateThreadTags(threadId: string, tags: string[]): Promise<void> {
  const d = getDb();
  await d.execute("DELETE FROM thread_tags WHERE thread_id = $1", [threadId]);
  for (const tag of tags) {
    await d.execute("INSERT INTO thread_tags (thread_id, tag) VALUES ($1, $2)", [threadId, tag]);
  }
  await d.execute("UPDATE threads SET updated_at = $1 WHERE id = $2", [now(), threadId]);
}

export async function deleteThread(id: string): Promise<void> {
  const d = getDb();
  await d.execute("DELETE FROM threads WHERE id = $1", [id]);
}

// --- Responses ---

export async function getResponses(threadId: string): Promise<Response[]> {
  const d = getDb();
  const rows = await d.select<
    Array<{
      id: string;
      thread_id: string;
      sequence: number | null;
      posted_at: string | null;
      created_at: string;
      updated_at: string;
    }>
  >("SELECT * FROM responses WHERE thread_id = $1 ORDER BY sequence, created_at", [threadId]);

  const result: Response[] = [];
  for (const row of rows) {
    const i18nRows = await d.select<
      Array<{
        locale: string;
        author_name: string | null;
        author_id: string | null;
        body: string | null;
      }>
    >("SELECT * FROM response_i18n WHERE response_id = $1", [row.id]);

    const i18n: Record<string, ResponseI18n> = {};
    for (const ir of i18nRows) {
      i18n[ir.locale] = {
        authorName: ir.author_name ?? undefined,
        authorId: ir.author_id ?? undefined,
        body: ir.body ?? undefined,
      };
    }

    result.push({
      id: row.id,
      threadId: row.thread_id,
      sequence: row.sequence,
      postedAt: row.posted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      i18n,
    });
  }
  return result;
}

export async function createResponse(
  threadId: string,
  sequence: number | null,
  postedAt: string | null,
  i18n: Record<string, ResponseI18n>,
): Promise<string> {
  const d = getDb();
  const id = uuidv4();
  const ts = now();

  await d.execute(
    "INSERT INTO responses (id, thread_id, sequence, posted_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, threadId, sequence, postedAt, ts, ts],
  );

  for (const [locale, fields] of Object.entries(i18n)) {
    await d.execute(
      `INSERT INTO response_i18n (response_id, locale, author_name, author_id, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, locale, fields.authorName ?? null, fields.authorId ?? null, fields.body ?? null],
    );
  }

  return id;
}

export async function updateResponseI18n(
  responseId: string,
  locale: string,
  fields: ResponseI18n,
): Promise<void> {
  const d = getDb();
  await d.execute(
    `INSERT INTO response_i18n (response_id, locale, author_name, author_id, body)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (response_id, locale)
     DO UPDATE SET author_name = $3, author_id = $4, body = $5`,
    [responseId, locale, fields.authorName ?? null, fields.authorId ?? null, fields.body ?? null],
  );
  await d.execute("UPDATE responses SET updated_at = $1 WHERE id = $2", [now(), responseId]);
}

export async function deleteResponse(id: string): Promise<void> {
  const d = getDb();
  await d.execute("DELETE FROM responses WHERE id = $1", [id]);
}

export async function deleteResponseI18n(responseId: string, locale: string): Promise<void> {
  const d = getDb();
  await d.execute(
    "DELETE FROM response_i18n WHERE response_id = $1 AND locale = $2",
    [responseId, locale],
  );
}

export async function insertResponseAt(
  threadId: string,
  atSequence: number,
  i18n: Record<string, ResponseI18n>,
): Promise<string> {
  const d = getDb();
  // Shift existing responses at or after this sequence
  await d.execute(
    "UPDATE responses SET sequence = sequence + 1 WHERE thread_id = $1 AND sequence >= $2",
    [threadId, atSequence],
  );
  return createResponse(threadId, atSequence, null, i18n);
}

// --- Bulk operations ---

export async function createThreadWithResponses(
  seriesId: string | null,
  threadI18n: Record<string, ThreadI18n>,
  threadTags: string[],
  responses: Array<{
    sequence: number | null;
    postedAt: string | null;
    i18n: Record<string, ResponseI18n>;
  }>,
): Promise<string> {
  const threadId = await createThread(seriesId, threadI18n, threadTags);
  for (const resp of responses) {
    await createResponse(threadId, resp.sequence, resp.postedAt, resp.i18n);
  }
  return threadId;
}
