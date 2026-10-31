"""Exercise real additive SQL in an isolated PGLite, never a network DB."""
import json
import os
from pathlib import Path
import subprocess
import unittest

from test_operations import month_fixture, session_fixture


class OperationsMigrationTests(unittest.TestCase):
    def test_real_sql_cas_rls_and_exact_contract(self):
        app = Path(__file__).parent.parent
        result = subprocess.run(['node', 'scripts/verify-operations-db.mjs'],
            input=json.dumps({'month':month_fixture(),'session':session_fixture()}), text=True,
            cwd=app, capture_output=True, timeout=90, env=os.environ.copy(), check=False)
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        self.assertIn('operations SQL PASS', result.stdout)


if __name__ == '__main__':
    unittest.main()
