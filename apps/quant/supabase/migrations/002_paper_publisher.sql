-- Apply after 001_dashboard.sql. This RPC is never callable by browsers.
-- Monotonic replacement prevents a slow exporter from overwriting newer data.
CREATE OR REPLACE FUNCTION public.paper_json_has_exact_keys(value jsonb, allowed text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    pg_catalog.jsonb_typeof(value) = 'object'
    AND value ?& allowed
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_object_keys(value) AS actual(key)
      WHERE NOT (actual.key = ANY(allowed))
    ), false
  )
$$;

REVOKE ALL ON FUNCTION public.paper_json_has_exact_keys(jsonb, text[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.publish_paper_snapshot(snapshot jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed integer;
BEGIN
  IF NOT coalesce(
    public.paper_json_has_exact_keys(snapshot, ARRAY[
      'schemaVersion', 'mode', 'episodeId', 'month', 'label', 'currency', 'status',
      'startedAt', 'asOf', 'exportedAt', 'source', 'baselineKind', 'summary',
      'holdings', 'history', 'fills', 'notes'
    ])
    AND snapshot->>'mode' = 'paper'
    AND snapshot->>'schemaVersion' = '1'
    AND snapshot->>'source' = 'forward-paper-ledger'
    AND snapshot->>'currency' = 'USD'
    AND snapshot->>'episodeId' ~ '^[a-zA-Z0-9_-]{1,80}$'
    AND snapshot->>'month' ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    AND public.paper_json_has_exact_keys(snapshot->'summary', ARRAY[
      'startingNav', 'currentNav', 'cash', 'netContributions', 'profit', 'returnPct',
      'returnMethod'
    ])
    AND jsonb_typeof(snapshot->'holdings') = 'array'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(snapshot->'holdings') item
      WHERE NOT public.paper_json_has_exact_keys(item, ARRAY[
        'symbol', 'quantity', 'averageCost', 'markPrice', 'markAsOf', 'marketValue',
        'unrealizedPnl', 'returnPct'
      ])
    )
    AND jsonb_typeof(snapshot->'history') = 'array'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(snapshot->'history') item
      WHERE NOT public.paper_json_has_exact_keys(item, ARRAY['at', 'nav', 'profit', 'returnPct'])
    )
    AND jsonb_typeof(snapshot->'fills') = 'array'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(snapshot->'fills') item
      WHERE NOT public.paper_json_has_exact_keys(item, ARRAY[
        'id', 'at', 'symbol', 'side', 'quantity', 'price', 'commission'
      ])
    )
    AND jsonb_typeof(snapshot->'notes') = 'array'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(snapshot->'notes') note
      WHERE jsonb_typeof(note) <> 'string'
    )
    AND snapshot->>'asOf' IS NOT NULL,
    false
  ) THEN
    RAISE EXCEPTION 'Invalid paper projection';
  END IF;

  INSERT INTO public.paper_snapshots AS current_snapshot (episode_id, month, as_of, payload)
  VALUES (snapshot->>'episodeId', snapshot->>'month', (snapshot->>'asOf')::timestamptz, snapshot)
  ON CONFLICT (episode_id, month) DO UPDATE
  SET as_of = EXCLUDED.as_of, payload = EXCLUDED.payload
  WHERE current_snapshot.as_of < EXCLUDED.as_of
    OR (current_snapshot.as_of = EXCLUDED.as_of
      AND (current_snapshot.payload - 'exportedAt') = (EXCLUDED.payload - 'exportedAt'));
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_paper_snapshot(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_paper_snapshot(jsonb) TO service_role;
GRANT SELECT ON public.paper_snapshots TO service_role;
