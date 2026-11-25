import type { BrowserContext } from '@playwright/test';
import { apiAs } from './api';
import type { UserKey } from './env';

/**
 * The deleted_ids table comes from supabase/migrations/20261125130000_deleted_ids.sql. Until it is applied to the
 * project, these tests serve /rest/v1/deleted_ids from one in-memory store shared by every context of the test, so the
 * client wiring is exercised either way. Once applied, the real table is used.
 */
export async function tombstoneBackend(user: UserKey) {
  const { db, userId } = apiAs(user);
  const probe = await db.from('deleted_ids').select('id').limit(1);
  const real = !probe.error;
  const store = new Set<string>();
  const parseIn = (v: string | null) =>
    v && v.startsWith('in.(') ? v.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, '')) : null;

  return {
    real,
    async attach(context: BrowserContext) {
      if (real) return;
      await context.route('**/rest/v1/deleted_ids**', async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        const ids = parseIn(url.searchParams.get('id'));
        if (req.method() === 'GET') {
          const out = [...store].filter((id) => !ids || ids.includes(id)).map((id) => ({ id }));
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
        }
        if (req.method() === 'POST') {
          const rows = (req.postDataJSON() ?? []) as { id: string }[];
          for (const r of Array.isArray(rows) ? rows : [rows]) store.add(r.id);
          return route.fulfill({ status: 201, body: '' });
        }
        if (req.method() === 'DELETE') {
          if (ids) ids.forEach((id) => store.delete(id));
          else store.clear();
          return route.fulfill({ status: 204, body: '' });
        }
        return route.fulfill({ status: 405, body: '' });
      });
    },
    async ids(): Promise<string[]> {
      if (!real) return [...store];
      const { data } = await db.from('deleted_ids').select('id').eq('user_id', userId).eq('table_name', 'transactions');
      return (data ?? []).map((r) => r.id as string);
    },
  };
}
