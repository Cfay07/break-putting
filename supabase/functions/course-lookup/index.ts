// Course search and scorecards, looked up here so the course service's key never ships in the
// app. Only the two calls the app makes are passed through: a name search and one course by id.
const BASE = 'https://api.golfcourseapi.com/v1';
const KEY = Deno.env.get('GOLF_COURSE_API_KEY') ?? '';

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
  if (id && /^[A-Za-z0-9_-]{1,40}$/.test(id)) path = `/courses/${id}`;
  else if (q && q.length <= 100) path = `/search?search_query=${encodeURIComponent(q)}`;
  else return reply(400, { error: 'Send q (a course name) or id (a course id).' });

  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Key ${KEY}` } });
  const body = await res.text();
  return new Response(body, { status: res.status, headers: { ...headers, 'Content-Type': 'application/json' } });
});
