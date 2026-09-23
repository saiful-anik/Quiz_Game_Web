import crypto from 'node:crypto';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const app = new Hono();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

app.use('*', cors({ origin: '*', allowHeaders: ['Content-Type', 'Authorization'], allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));

function error(c, message, status = 400) { return c.json({ error: message }, status); }
function validText(value) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 500; }

function safeEqual(first, second) {
  const a = Buffer.from(first || ''); const b = Buffer.from(second || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sign(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.ADMIN_TOKEN_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function isAdmin(c) {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !process.env.ADMIN_TOKEN_SECRET) return false;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return false;
  const expected = crypto.createHmac('sha256', process.env.ADMIN_TOKEN_SECRET).update(encoded).digest('base64url');
  if (!safeEqual(signature, expected)) return false;
  try { return JSON.parse(Buffer.from(encoded, 'base64url').toString()).expiresAt > Date.now(); }
  catch { return false; }
}

app.get('/questions', async (c) => {
  const { rows } = await pool.query('SELECT id, question, option_one, option_two FROM questions ORDER BY random() LIMIT 10');
  return c.json(rows.map((row) => ({ id: row.id, question: row.question, options: [row.option_one, row.option_two] })));
});

app.post('/questions/:id/check', async (c) => {
  const id = Number(c.req.param('id')); const { option } = await c.req.json();
  if (!Number.isSafeInteger(id) || id < 1 || ![0, 1].includes(option)) return error(c, 'Invalid answer.');
  const { rows } = await pool.query('SELECT correct_option FROM questions WHERE id = $1', [id]);
  if (!rows.length) return error(c, 'Question not found.', 404);
  return c.json({ correct: rows[0].correct_option === option });
});

app.get('/scores/:playerId', async (c) => {
  const playerId = c.req.param('playerId');
  if (!uuidPattern.test(playerId)) return error(c, 'Invalid player.');
  const { rows } = await pool.query('SELECT best_score, best_total FROM player_scores WHERE player_id = $1', [playerId]);
  return c.json(rows.length ? { bestScore: rows[0].best_score, bestTotal: rows[0].best_total } : null);
});

app.post('/scores', async (c) => {
  const { playerId, score, total } = await c.req.json();
  if (!uuidPattern.test(playerId || '') || !Number.isInteger(score) || !Number.isInteger(total) || score < 0 || total < 1 || score > total) return error(c, 'Invalid score.');
  const { rows } = await pool.query(`INSERT INTO player_scores (player_id, best_score, best_total)
    VALUES ($1, $2, $3)
    ON CONFLICT (player_id) DO UPDATE SET
      best_score = GREATEST(player_scores.best_score, EXCLUDED.best_score),
      best_total = CASE WHEN EXCLUDED.best_score > player_scores.best_score THEN EXCLUDED.best_total ELSE player_scores.best_total END,
      updated_at = NOW()
    RETURNING best_score, best_total`, [playerId, score, total]);
  return c.json({ bestScore: rows[0].best_score, bestTotal: rows[0].best_total });
});

app.post('/admin/login', async (c) => {
  const { username, password } = await c.req.json();
  if (typeof username !== 'string' || typeof password !== 'string' || !safeEqual(username, process.env.ADMIN_USERNAME) || !safeEqual(password, process.env.ADMIN_PASSWORD) || !process.env.ADMIN_TOKEN_SECRET) return error(c, 'Incorrect username or password.', 401);
  return c.json({ token: sign({ expiresAt: Date.now() + 1000 * 60 * 60 * 8 }) });
});

app.post('/admin/questions', async (c) => {
  if (!isAdmin(c)) return error(c, 'Admin login required.', 401);
  const { question, optionOne, optionTwo, correctOption } = await c.req.json();
  const correct = Number(correctOption);
  if (![question, optionOne, optionTwo].every(validText) || ![0, 1].includes(correct)) return error(c, 'Enter a question, two options, and the correct option.');
  const { rows } = await pool.query('INSERT INTO questions (question, option_one, option_two, correct_option) VALUES ($1, $2, $3, $4) RETURNING id', [question.trim(), optionOne.trim(), optionTwo.trim(), correct]);
  return c.json({ id: rows[0].id }, 201);
});

app.get('/admin/questions', async (c) => {
  if (!isAdmin(c)) return error(c, 'Admin login required.', 401);
  const { rows } = await pool.query('SELECT id, question, option_one, option_two, correct_option FROM questions ORDER BY created_at DESC');
  return c.json(rows);
});

app.get('/admin/stats', async (c) => {
  if (!isAdmin(c)) return error(c, 'Admin login required.', 401);
  const { rows } = await pool.query('SELECT COUNT(*)::int AS total_players FROM player_scores');
  return c.json({ totalPlayers: rows[0].total_players });
});

app.patch('/admin/questions/:id', async (c) => {
  if (!isAdmin(c)) return error(c, 'Admin login required.', 401);
  const id = Number(c.req.param('id')); const { question, optionOne, optionTwo, correctOption } = await c.req.json(); const correct = Number(correctOption);
  if (!Number.isSafeInteger(id) || id < 1 || ![question, optionOne, optionTwo].every(validText) || ![0, 1].includes(correct)) return error(c, 'Enter a question, two options, and the correct option.');
  const { rowCount } = await pool.query('UPDATE questions SET question = $1, option_one = $2, option_two = $3, correct_option = $4 WHERE id = $5', [question.trim(), optionOne.trim(), optionTwo.trim(), correct, id]);
  if (!rowCount) return error(c, 'Question not found.', 404);
  return c.json({ ok: true });
});

app.delete('/admin/questions/:id', async (c) => {
  if (!isAdmin(c)) return error(c, 'Admin login required.', 401);
  const id = Number(c.req.param('id')); if (!Number.isSafeInteger(id) || id < 1) return error(c, 'Invalid question.');
  const { rowCount } = await pool.query('DELETE FROM questions WHERE id = $1', [id]);
  if (!rowCount) return error(c, 'Question not found.', 404);
  return c.json({ ok: true });
});

app.onError((err, c) => { console.error(err); return error(c, 'Something went wrong. Please try again.', 500); });
export default app;
