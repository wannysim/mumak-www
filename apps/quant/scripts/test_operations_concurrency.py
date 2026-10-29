"""Required disposable PostgreSQL acceptance in the normal test:paper path.

CI uses its installed PostgreSQL binaries (pg_config --bindir). Local callers may
point QUANT_TEST_PG_BIN / QUANT_TEST_PG_LIBRARY_DIR at user-extracted binaries.
Missing prerequisites fail, never silently skip or replace real concurrency with
PGlite's single connection queue. No external database URL is accepted.
"""
import os
from pathlib import Path
import shutil
import subprocess

import verify_operations_concurrency as acceptance


class OperationsConcurrencyTests(acceptance.ConcurrencyAcceptance):
    @classmethod
    def setUpClass(cls):
        bindir = os.environ.get('QUANT_TEST_PG_BIN')
        if not bindir:
            pg_config = shutil.which('pg_config')
            if not pg_config:
                raise RuntimeError('PostgreSQL required: install PostgreSQL or set QUANT_TEST_PG_BIN')
            bindir = subprocess.check_output([pg_config, '--bindir'], text=True, timeout=10).strip()
        for name in ('initdb', 'pg_ctl', 'psql'):
            if not (Path(bindir) / name).is_file():
                raise RuntimeError(f'PostgreSQL test binary missing: {name}')
        cls.db = acceptance.IsolatedPostgres(bindir, os.environ.get('QUANT_TEST_PG_LIBRARY_DIR'))
        cls.addClassCleanup(cls.db.close)
        cls.db.start()
        fixture = acceptance.PublishTests()
        fixture.setUp()
        cls.db.sql('SELECT public.publish_paper_snapshot(' +
                   acceptance.literal(acceptance.json.dumps(fixture.doc)) + '::jsonb);')
