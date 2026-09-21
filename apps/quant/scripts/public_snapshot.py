"""Exact public snapshot contract shared by publication boundary checks."""

TOP_LEVEL_KEYS = {
    'schemaVersion', 'mode', 'episodeId', 'month', 'label', 'currency', 'status',
    'startedAt', 'asOf', 'exportedAt', 'source', 'baselineKind', 'summary',
    'holdings', 'history', 'fills', 'notes',
}
SUMMARY_KEYS = {
    'startingNav', 'currentNav', 'cash', 'netContributions', 'profit', 'returnPct',
    'returnMethod',
}
HOLDING_KEYS = {
    'symbol', 'quantity', 'averageCost', 'markPrice', 'markAsOf', 'marketValue',
    'unrealizedPnl', 'returnPct',
}
HISTORY_KEYS = {'at', 'nav', 'profit', 'returnPct'}
FILL_KEYS = {'id', 'at', 'symbol', 'side', 'quantity', 'price', 'commission'}


def _exact_object(value, keys):
    return isinstance(value, dict) and set(value) == keys


def is_public_snapshot(snapshot):
    if not _exact_object(snapshot, TOP_LEVEL_KEYS):
        return False
    if not _exact_object(snapshot['summary'], SUMMARY_KEYS):
        return False
    collections = (
        ('holdings', HOLDING_KEYS), ('history', HISTORY_KEYS), ('fills', FILL_KEYS),
    )
    if any(not isinstance(snapshot[name], list)
           or any(not _exact_object(item, keys) for item in snapshot[name])
           for name, keys in collections):
        return False
    return (isinstance(snapshot['notes'], list)
            and all(isinstance(note, str) for note in snapshot['notes']))