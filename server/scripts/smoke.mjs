// End-to-end API smoke test against a running server and real Mongo.
// Usage: BASE=http://localhost:5050 npm run smoke --workspace server
const BASE = process.env.BASE || 'http://localhost:5050';
let pass = 0, fail = 0;
const ok = (cond, msg, extra) => { if (cond) { pass++; console.log('  ok  ', msg); } else { fail++; console.log('  FAIL', msg, extra ?? ''); } };

function client() {
  const jar = {};
  return async function call(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'content-type': 'application/json', cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';'); const i = kv.indexOf('=');
      jar[kv.slice(0, i)] = kv.slice(i + 1);
    }
    let json = null; try { json = await res.json(); } catch {}
    return { status: res.status, body: json };
  };
}

const tag = Date.now().toString(36);
const A = client(), B = client(), P = client(), X = client();

console.log('auth');
let r = await A('POST', '/api/auth/register', { name: 'Test Owner', email: `owner.${tag}@test.dev`, password: 'secret123' });
ok(r.status === 201, 'register owner', r.body);
r = await A('POST', '/api/auth/register', { name: 'Dup', email: `owner.${tag}@test.dev`, password: 'secret123' });
ok(r.status === 409, 'duplicate email -> 409');
r = await A('POST', '/api/auth/register', { name: 'x', email: 'bad', password: '1' });
ok(r.status === 400 && r.body.error.fields, 'invalid register -> 400 with fields');
r = await X('POST', '/api/auth/login', { email: `owner.${tag}@test.dev`, password: 'wrongpass' });
ok(r.status === 401, 'wrong password -> 401');
r = await X('GET', '/api/circles/abc/overview');
ok(r.status === 401, 'no session -> 401');

console.log('circle');
r = await A('POST', '/api/circles', { parent: { name: 'Kamla Devi', callName: 'Amma', city: 'Pune' }, schedule: { windowStart: '07:00', windowEnd: '07:10' } });
ok(r.status === 400 && /30 minutes/.test(r.body.error.message), 'tiny window rejected', r.body);
r = await A('POST', '/api/circles', { parent: { name: 'Kamla Devi', callName: 'Amma', city: 'Pune' }, schedule: { windowStart: '07:00', windowEnd: '10:00' }, relation: 'Son' });
ok(r.status === 201, 'create circle', r.body);
const cid = r.body.circle.id;
r = await A('GET', `/api/circles/${cid}/overview`);
ok(r.status === 200 && r.body.me.role === 'owner' && r.body.history.length === 14, 'overview loads');

console.log('invite + membership');
await B('POST', '/api/auth/register', { name: 'Test Sister', email: `sis.${tag}@test.dev`, password: 'secret123' });
r = await B('GET', `/api/circles/${cid}/overview`);
ok(r.status === 404, 'non-member gets 404');
r = await A('POST', `/api/circles/${cid}/invites`, { relation: 'Daughter' });
ok(r.status === 201 && r.body.token, 'owner creates invite');
const token = r.body.token;
r = await X('GET', `/api/invites/${token}`);
ok(r.status === 200 && r.body.callName === 'Amma', 'public invite preview');
r = await B('POST', `/api/invites/${token}/accept`);
ok(r.status === 200, 'sister accepts', r.body);
r = await B('POST', `/api/invites/${token}/accept`);
ok(r.status === 410 || r.status === 409, 'reused invite rejected', r.status);
r = await B('POST', `/api/circles/${cid}/invites`, {});
ok(r.status === 403, 'member cannot invite');
r = await B('GET', `/api/circles/${cid}/members`);
ok(r.status === 200 && r.body.members.length === 2, 'two members');

console.log('pairing');
r = await A('POST', `/api/circles/${cid}/pairing-code`);
ok(r.status === 201 && /^\d{6}$/.test(r.body.code), 'pairing code');
const code = r.body.code;
r = await P('GET', '/api/parent/today');
ok(r.status === 401, 'unpaired phone -> 401');
r = await P('POST', '/api/parent/pair', { code: '000000' === code ? '111111' : '000000' });
ok(r.status === 400, 'wrong code -> 400');
r = await P('POST', '/api/parent/pair', { code: code.slice(0, 3) + ' ' + code.slice(3) });
ok(r.status === 201, 'pair with spaced code');
r = await X('POST', '/api/parent/pair', { code });
ok(r.status === 400, 'code is single use');
r = await P('GET', '/api/parent/today');
ok(r.status === 200 && r.body.parent.callName === 'Amma', 'parent today', r.body);

console.log('medicines');
r = await A('POST', `/api/circles/${cid}/medicines`, { name: 'Amlodipine 5', times: ['08:00', '21:00', '08:00'] });
ok(r.status === 201 && r.body.medicine.times.length === 2, 'medicine created, times deduped');
const medId = r.body.medicine.id;
r = await P('POST', '/api/parent/doses', { medicineId: medId, time: '08:00' });
ok(r.status === 200 && r.body.doses.find((d) => d.time === '08:00').status === 'taken', 'parent marks dose');
r = await P('POST', '/api/parent/doses', { medicineId: medId, time: '08:00' });
ok(r.status === 200, 'double tap dose is fine');
r = await P('POST', '/api/parent/doses', { medicineId: medId, time: '09:00' });
ok(r.status === 400, 'unscheduled dose rejected');

console.log('tasks (claim race)');
r = await A('POST', `/api/circles/${cid}/tasks`, { title: 'Book cardiologist', category: 'doctor' });
ok(r.status === 201, 'task created');
const tid = r.body.task.id;
const [c1, c2] = await Promise.all([A('POST', `/api/circles/${cid}/tasks/${tid}/claim`), B('POST', `/api/circles/${cid}/tasks/${tid}/claim`)]);
ok([c1.status, c2.status].sort().join() === '200,409', 'exactly one claim wins', [c1.status, c2.status]);
const loser = c1.status === 409 ? c1 : c2;
ok(/already taken/.test(loser.body.error.message), 'loser told who took it', loser.body.error.message);
const winner = c1.status === 200 ? A : B;
const other = c1.status === 200 ? B : A;
r = await other('POST', `/api/circles/${cid}/tasks/${tid}/release`);
ok(r.status === 409, 'non-claimer cannot release');
r = await winner('POST', `/api/circles/${cid}/tasks/${tid}/complete`);
ok(r.status === 200 && r.body.task.status === 'done', 'claimer completes');

console.log('check-in idempotency');
const [k1, k2] = await Promise.all([P('POST', '/api/parent/checkin', { mood: 'good' }), P('POST', '/api/parent/checkin', { mood: 'good' })]);
ok([k1.status, k2.status].sort().join() === '200,201', 'double tap -> one check-in', [k1.status, k2.status]);
r = await P('PATCH', '/api/parent/mood', { mood: 'unwell' });
ok(r.status === 200 && r.body.mood === 'unwell', 'mood changed to unwell');
r = await B('GET', '/api/me/notifications');
ok(r.body.items.some((n) => n.kind === 'unwell'), 'sister got unwell notification');
r = await A('POST', `/api/circles/${cid}/today/resolve`, { note: 'Called her' });
ok(r.status === 409, 'cannot resolve after check-in');

console.log('demo + escalation ladder');
const D = client();
r = await D('POST', '/api/demo');
ok(r.status === 201 && r.body.circleId, 'demo created');
const did = r.body.circleId;
r = await D('GET', `/api/circles/${did}/overview`);
ok(r.status === 200 && r.body.today.status === 'waiting', 'demo starts waiting', r.body.today?.status);
ok(r.body.history.filter((h) => h.status === 'checked_in').length >= 10, 'demo history filled');
ok(r.body.medicines.adherence.percent > 50, 'demo adherence computed', r.body.medicines.adherence.percent);
for (const lvl of [1, 2, 3]) {
  r = await D('POST', `/api/circles/${did}/demo/fast-forward`);
  ok(r.status === 200 && r.body.result.toLevel === lvl && r.body.result.moved, `fast-forward -> level ${lvl}`, r.body);
}
r = await D('POST', `/api/circles/${did}/demo/fast-forward`);
ok(r.status === 400, 'cannot go past level 3');
r = await D('GET', `/api/circles/${did}/overview`);
ok(r.body.today.status === 'overdue' && r.body.today.day.escalations.length === 3, 'overview shows 3 escalations');
r = await D('GET', '/api/me/notifications');
ok(r.body.items.some((n) => n.kind === 'ladder_primary') && r.body.items.some((n) => n.kind === 'ladder_circle'), 'owner got primary + circle alerts');
r = await D('POST', `/api/circles/${did}/today/resolve`, { note: 'Spoke to Maa, all fine' });
ok(r.status === 200, 'resolve');
r = await D('POST', `/api/circles/${did}/today/resolve`, { note: 'again' });
ok(r.status === 409, 'second resolve -> 409');
r = await D('POST', `/api/circles/${did}/demo/reset`);
ok(r.status === 200, 'reset demo morning');
r = await D('GET', `/api/circles/${did}/overview`);
ok(r.body.today.status === 'waiting', 'back to waiting');

console.log('cron');
r = await X('POST', '/api/cron/tick');
ok(r.status === 401, 'cron without secret -> 401');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
