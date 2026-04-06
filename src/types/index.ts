// --- i18n field types ---

export interface SeriesI18n {
  name?: string;
  author?: string;
  link?: string;
}

export interface ThreadI18n {
  name?: string;
  author?: string;
  firstPostedAt?: string;
  lastPostedAt?: string;
  link?: string;
}

export interface ResponseI18n {
  authorName?: string;
  authorId?: string;
  body?: string;
}

// --- Entity types ---

export interface Series {
  id: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  i18n: Record<string, SeriesI18n>;
  tags: string[];
}

export interface Thread {
  id: string;
  seriesId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  i18n: Record<string, ThreadI18n>;
  tags: string[];
  responseCount?: number;
}

export interface Response {
  id: string;
  threadId: string;
  sequence: number | null;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
  i18n: Record<string, ResponseI18n>;
}

// --- .laa file format ---

export interface LaaFile {
  version: "1.0";
  exportedAt: string;
  series?: {
    i18n: Record<string, SeriesI18n>;
    tags: string[];
  };
  threads: Array<{
    i18n: Record<string, ThreadI18n>;
    tags: string[];
    responses: Array<{
      sequence?: number;
      postedAt?: string;
      i18n: Record<string, ResponseI18n>;
    }>;
  }>;
}

// --- Parser types ---

export interface ParsedResponse {
  sequence: number;
  authorName?: string;
  authorId?: string;
  postedAt?: string;
  body: string;
}

export interface ParsedThread {
  name?: string;
  responses: ParsedResponse[];
}

// --- LLM types ---

export type LLMProviderType = "claude" | "openai" | "gemini" | "ollama";

export interface LLMSettings {
  provider: LLMProviderType;
  apiKey: string;
  model: string;
}
