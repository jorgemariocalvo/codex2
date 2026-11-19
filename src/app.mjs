import express from 'express';
import { fileURLToPath } from 'node:url';
import { hashPassword, validPassword, newToken, tokenHash, sessionToken, sessionSeconds } from './auth.mjs';
import { channels, types, states, deadline } from './domain.mjs';
import { transaction } from './db.mjs';
import { HttpError, createTicket, readTicket, changeTicket } from './tickets.mjs';
import { importClients } from './imports.mjs';

const publicFiles = fileURLToPath(new URL('../public/', import.meta.url));
const timingHash = await hashPassword('placeholder');

export function createApp(pool, { clock = () => new Date(), secure = true, origin } = {}) {
  const app = express();
  app.disable('x-powered-by');
  const attempts = new Map();
  const cookie = { httpOnly: true, secure, sameSite: 'strict', path: '/' };

  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
    });
    next();
  });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (['POST', 'PATCH'].includes(req.method)) {
      const incoming = req.get('origin');
      const expected = origin || ((secure ? 'https://' : 'http://') + req.get('host'));
      if ((incoming && incoming !== expected) || req.get('sec-fetch-site') === 'cross-site') {
        return next(new HttpError(403, 'Origen de la solicitud no permitido.'));
      }
      if (!req.is('application/json')) return next(new HttpError(415, 'Se requiere JSON.'));
    }
    next();
  }, express.json({ limit: '1mb' }));

  app.post('/api/login', async (req, res) => {
    const { id, password } = req.body ?? {};
    if (typeof id !== 'string' || typeof password !== 'string' || id.length > 64 || password.length > 256) {
      throw new HttpError(400, 'Usuario o contraseña inválidos.');
    }
    const address = req.ip;
    const now = Date.now();
    for (const [key, value] of attempts) if (now >= value.expires) attempts.delete(key);
    const failed = attempts.get(address);
    if (failed?.count >= 25) throw new HttpError(429, 'Demasiados intentos. Intenta nuevamente en unos minutos.');
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE id=$1', [id.trim().toLowerCase()]);
    if (!(await validPassword(password, user?.password_hash ?? timingHash)) || !user) {
      const current = attempts.get(address);
      attempts.set(address, { count: (current?.count ?? 0) + 1, expires: current?.expires ?? now + 300_000 });
      throw new HttpError(401, 'Usuario o contraseña incorrectos.');
    }
    const token = newToken();
    await transaction(pool, async (db) => {
      await db.query('DELETE FROM sessions WHERE expires_at <= now() OR token=$1', [tokenHash(sessionToken(req) || '')]);
      await db.query("INSERT INTO sessions VALUES ($1,$2,now()+$3*interval '1 second')", [tokenHash(token), user.id, sessionSeconds]);
    });
    res.cookie('aurora_session', token, { ...cookie, maxAge: sessionSeconds * 1000 });
    res.json({ id: user.id, name: user.name, role: user.role });
  });

  app.use('/api', async (req, res, next) => {
    const token = sessionToken(req);
    if (!token) throw new HttpError(401, 'Inicia sesión para continuar.');
    req.session = tokenHash(token);
    const { rows: [user] } = await pool.query(
      'SELECT u.id,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>now()',
      [req.session]
    );
    if (!user) throw new HttpError(401, 'La sesión expiró. Inicia sesión nuevamente.');
    req.user = user;
    next();
  });

  function coordinator(req, res, next) {
    if (req.user.role !== 'coordinator') throw new HttpError(403, 'Acción reservada al coordinador.');
    next();
  }

  app.get('/api/me', async (req, res) => {
    const { rows: agents } = await pool.query("SELECT id,name FROM users WHERE role='agent' ORDER BY id");
    res.json({ user: req.user, agents, channels, types, states });
  });

  app.post('/api/logout', async (req, res) => {
    await pool.query('DELETE FROM sessions WHERE token=$1', [req.session]);
    res.clearCookie('aurora_session', cookie).json({ ok: true });
  });

  app.get('/api/clients', async (req, res) => {
    const { rows } = await pool.query(
      'SELECT nit,name FROM clients WHERE strpos(lower(nit),lower($1))>0 OR strpos(lower(name),lower($1))>0 ORDER BY name LIMIT 30',
      [String(req.query.q ?? '')]
    );
    res.json(rows);
  });

  app.post('/api/clients/import', coordinator, async (req, res) => {
    const result = await importClients(pool, req.body ?? {});
    res.status(result.errors.length ? 422 : 200).json(result);
  });

  app.get('/api/tickets', async (req, res) => {
    const all = req.user.role === 'coordinator';
    const { rows } = await pool.query(
      'SELECT t.*, u.name AS agent_name FROM tickets t JOIN users u ON u.id=t.agent_id WHERE ($1 OR t.agent_id=$2) ORDER BY received_at DESC,id DESC',
      [all, req.user.id]
    );
    const now = clock();
    const items = rows.map((row) => deadline(row, now));
    const { q = '', state, agent, level } = req.query;
    const query = String(q).trim().toLocaleLowerCase('es');
    const matches = items.filter((item) =>
      (!state || item.state === state) && (!agent || item.agent_id === agent) && (!level || item.level === level) &&
      [item.id, item.nit, item.client_name].some((value) => value.toLocaleLowerCase('es').includes(query)));
    const stats = {
      total: items.length,
      open: items.filter((item) => !item.resolved_at).length,
      risk: items.filter((item) => ['Preventivo', 'Urgente'].includes(item.level)).length,
      overdue: items.filter((item) => item.level === 'Vencido').length
    };
    if (all) {
      stats.resolved = items.filter((item) => item.resolved_at).length;
      stats.met = items.filter((item) => item.within_sla === true).length;
    }
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    res.json({ items: matches.slice((page - 1) * 15, page * 15), count: matches.length, page, pageSize: 15, stats });
  });

  app.post('/api/tickets', async (req, res) => {
    res.status(201).json(await createTicket(pool, req.body ?? {}, req.user.id, clock));
  });

  app.get('/api/tickets/:id', async (req, res) => {
    const result = await transaction(pool, async (db) => {
      const ticket = await readTicket(db, req.params.id, req.user);
      const { rows: events } = await db.query(
        'SELECT e.*,u.name AS actor_name FROM events e JOIN users u ON u.id=e.actor_id WHERE ticket_id=$1 ORDER BY e.id',
        [ticket.id]
      );
      return { ticket: deadline(ticket, clock()), events };
    }, 'ISOLATION LEVEL REPEATABLE READ READ ONLY');
    res.json(result);
  });

  app.patch('/api/tickets/:id', async (req, res) => {
    res.json(await changeTicket(pool, req.params.id, req.body ?? {}, req.user, clock));
  });

  app.get('/api/export', coordinator, async (req, res) => {
    const data = await transaction(pool, async (db) => ({
      clients: (await db.query('SELECT * FROM clients ORDER BY nit')).rows,
      tickets: (await db.query('SELECT * FROM tickets ORDER BY id')).rows,
      events: (await db.query('SELECT * FROM events ORDER BY id')).rows
    }), 'ISOLATION LEVEL REPEATABLE READ READ ONLY');
    res.attachment('aurora-piloto.json').json(data);
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no disponible.' }));
  app.use(express.static(publicFiles));
  app.get('/solicitudes/:id', (req, res) => res.sendFile('index.html', { root: publicFiles }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error.status === 400 || error.status === 413) return res.status(error.status).json({ error: 'Contenido de la solicitud inválido o demasiado grande.' });
    console.error(error);
    res.status(500).json({ error: 'No se pudo completar la operación.' });
  });
  return app;
}
