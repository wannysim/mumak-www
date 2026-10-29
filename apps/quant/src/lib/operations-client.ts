import {
  parseOperations,
  parseSummary,
  time,
  type MonthOperations,
  type SessionOperations,
  type SessionSummary,
} from './operations-schema';

type OperationsErrorKind = 'not-provisioned' | 'access' | 'schema' | 'transport';
class OperationsError extends Error {
  constructor(readonly kind: OperationsErrorKind) {
    super(kind);
  }
}
type Row<T> = { payload: T; revision: number; sourceAsOf: string; storedAt: string };
type SummaryRow = { summary: SessionSummary; revision: number; sourceAsOf: string; storedAt: string };
type OperationsClient = {
  fetchMonth: (episode: string, month: string, signal: AbortSignal) => Promise<Row<MonthOperations> | null>;
  fetchSessions: (episode: string, month: string, signal: AbortSignal) => Promise<SummaryRow[]>;
  fetchSession: (
    episode: string,
    month: string,
    session: string,
    signal: AbortSignal
  ) => Promise<Row<SessionOperations> | null>;
};
type Query = {
  select: (columns: string) => Query;
  eq: (key: string, value: string) => Query;
  order: (key: string, options: { ascending: boolean }) => Query;
  abortSignal: (
    signal: AbortSignal
  ) => PromiseLike<{ data: unknown; error: { code?: string; status?: number } | null; status?: number }>;
};
type SupabaseOperationsLike = { from: (table: string) => Query };
function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new OperationsError('schema');
  if (Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key)))
    throw new OperationsError('schema');
  return value as Record<string, unknown>;
}
function metadata(row: Record<string, unknown>) {
  if (
    typeof row.revision !== 'number' ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1 ||
    typeof row.source_as_of !== 'string' ||
    typeof row.stored_at !== 'string'
  )
    throw new OperationsError('schema');
  time(row.source_as_of);
  time(row.stored_at);
  return { revision: row.revision, sourceAsOf: row.source_as_of, storedAt: row.stored_at };
}
class SupabaseOperationsClient implements OperationsClient {
  constructor(private readonly supabase: SupabaseOperationsLike) {}
  private async rows(
    episode: string,
    month: string,
    signal: AbortSignal,
    type: 'month' | 'list' | 'session',
    session?: string
  ) {
    let query = this.supabase
      .from(type === 'month' ? 'paper_operation_months' : 'paper_operation_sessions')
      .select(
        type === 'list'
          ? 'session,revision,source_as_of,stored_at,summary'
          : type === 'month'
            ? 'episode_id,month,revision,source_as_of,stored_at,payload'
            : 'episode_id,month,session,revision,source_as_of,stored_at,summary,payload'
      )
      .eq('episode_id', episode)
      .eq('month', month);
    if (session) query = query.eq('session', session);
    if (type === 'list') query = query.order('session', { ascending: false });
    try {
      const { data, error, status } = await query.abortSignal(signal);
      if (error)
        throw new OperationsError(
          status === 401 ||
            status === 403 ||
            error.status === 401 ||
            error.status === 403 ||
            error.code === '42501' ||
            error.code?.startsWith('PGRST3')
            ? 'access'
            : error.code === '42P01' || error.code === 'PGRST205'
              ? 'not-provisioned'
              : error.code === '42703'
                ? 'schema'
                : 'transport'
        );
      if (!Array.isArray(data)) throw new OperationsError('schema');
      return data;
    } catch (error) {
      if (error instanceof OperationsError) throw error;
      throw new OperationsError('transport');
    }
  }
  async fetchMonth(episode: string, month: string, signal: AbortSignal): Promise<Row<MonthOperations> | null> {
    const rows = await this.rows(episode, month, signal, 'month');
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new OperationsError('schema');
    try {
      const row = record(rows[0], ['episode_id', 'month', 'revision', 'source_as_of', 'stored_at', 'payload']);
      const payload = parseOperations(row.payload);
      const meta = metadata(row);
      if (
        payload.recordType !== 'month' ||
        payload.episodeId !== episode ||
        payload.month !== month ||
        row.episode_id !== episode ||
        row.month !== month ||
        time(payload.sourceAsOf) !== time(meta.sourceAsOf)
      )
        throw new Error();
      return { payload, ...meta };
    } catch {
      throw new OperationsError('schema');
    }
  }
  async fetchSessions(episode: string, month: string, signal: AbortSignal): Promise<SummaryRow[]> {
    const rows = await this.rows(episode, month, signal, 'list');
    try {
      const sessions = rows.map(value => {
        const row = record(value, ['session', 'revision', 'source_as_of', 'stored_at', 'summary']);
        const summary = parseSummary(row.summary);
        if (row.session !== summary.session || !summary.session.startsWith(`${month}-`)) throw new Error();
        return { summary, ...metadata(row) };
      });
      if (new Set(sessions.map(s => s.summary.session)).size !== sessions.length) throw new Error();
      return sessions.toSorted((a, b) => b.summary.session.localeCompare(a.summary.session));
    } catch {
      throw new OperationsError('schema');
    }
  }
  async fetchSession(
    episode: string,
    month: string,
    session: string,
    signal: AbortSignal
  ): Promise<Row<SessionOperations> | null> {
    const rows = await this.rows(episode, month, signal, 'session', session);
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new OperationsError('schema');
    try {
      const row = record(rows[0], [
        'episode_id',
        'month',
        'session',
        'revision',
        'source_as_of',
        'stored_at',
        'summary',
        'payload',
      ]);
      const payload = parseOperations(row.payload);
      const meta = metadata(row);
      if (
        payload.recordType !== 'session' ||
        payload.episodeId !== episode ||
        payload.month !== month ||
        payload.session !== session ||
        row.episode_id !== episode ||
        row.month !== month ||
        row.session !== session ||
        time(payload.sourceAsOf) !== time(meta.sourceAsOf)
      )
        throw new Error();
      const summary = parseSummary(row.summary);
      {
        // jsonb key order is immaterial; compare canonical objects rather than serialized ordering.
        const canonical = (v: unknown): string =>
          JSON.stringify(v, (_key, child) =>
            child && typeof child === 'object' && !Array.isArray(child)
              ? Object.fromEntries(Object.entries(child).toSorted(([a], [b]) => a.localeCompare(b)))
              : child
          );
        if (
          canonical(summary) !==
          canonical({
            session: payload.session,
            counts: payload.counts,
            stages: payload.stages.map(({ id, status, evidenceAt, reasonCode }) => ({
              id,
              status,
              evidenceAt,
              reasonCode,
            })),
          })
        )
          throw new Error();
      }
      return { payload, ...meta };
    } catch {
      throw new OperationsError('schema');
    }
  }
}
export {
  SupabaseOperationsClient,
  OperationsError,
  type OperationsClient,
  type OperationsErrorKind,
  type Row,
  type SummaryRow,
  type SupabaseOperationsLike,
};
