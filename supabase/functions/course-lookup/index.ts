// Course search and scorecards, looked up here so the course service's key never ships in the
// app. Only the two calls the app makes are passed through: a name search and one course by id.
// Answers are kept in course_cache, so a course is fetched once for everyone.
const BASE = 'https://api.golfcourseapi.com/v1';
const KEY = Deno.env.get('GOLF_COURSE_API_KEY') ?? '';

const DB = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const db = (path: string, init: RequestInit = {}) =>
  fetch(`${DB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...init.headers },
  });

// A course's card rarely changes; search results change as the service adds courses.
const FRESH_DAYS = { id: 180, q: 30 };

async function cached(key: string): Promise<{ body: unknown; age: number } | null> {
  if (!DB || !SERVICE) return null;
  const res = await db(`course_cache?key=eq.${encodeURIComponent(key)}&select=body,fetched_at`).catch(() => null);
  const rows = res?.ok ? ((await res.json()) as { body: unknown; fetched_at: string }[]) : [];
  return rows[0] ? { body: rows[0].body, age: (Date.now() - Date.parse(rows[0].fetched_at)) / 86_400_000 } : null;
}

async function keep(key: string, body: string) {
  if (!DB || !SERVICE) return;
  await db('course_cache', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key, body: JSON.parse(body), fetched_at: new Date().toISOString() }),
  }).catch(() => undefined);
}

const ALLOWED = ['https://break.conorfayard.com', 'https://break-nu.vercel.app'];

function cors(origin: string | null): Record<string, string> {
  const ok = !!origin && (ALLOWED.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin));
  return {
    'Access-Control-Allow-Origin': ok ? origin! : ALLOWED[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    Vary: 'Origin',
  };
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

  if (!KEY) return reply(503, { error: 'Course lookups are not set up.' });
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  const id = url.searchParams.get('id')?.trim();

  let path: string;
  let key: string;
  let kind: 'id' | 'q';
  if (id && /^[A-Za-z0-9_-]{1,40}$/.test(id)) [path, key, kind] = [`/courses/${id}`, `id:${id}`, 'id'];
  else if (q && q.length <= 100)
    [path, key, kind] = [`/search?search_query=${encodeURIComponent(q)}`, `q:${q.toLowerCase().replace(/\s+/g, ' ')}`, 'q'];
  else return reply(400, { error: 'Send q (a course name) or id (a course id).' });

  const hit = await cached(key);
  if (hit && hit.age < FRESH_DAYS[kind]) return reply(200, hit.body);

  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Key ${KEY}` } });
  const body = await res.text();
  if (res.ok) await keep(key, body);
  // Over the daily limit or down: an old answer beats none.
  else if (hit) return reply(200, hit.body);
  return new Response(body, { status: res.status, headers: { ...headers, 'Content-Type': 'application/json' } });
});
