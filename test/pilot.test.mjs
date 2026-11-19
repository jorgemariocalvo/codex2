import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { chromium } from 'playwright-core';
import { database } from '../src/db.mjs';
import { serve } from '../src/server.mjs';
import { deadline, hour, monthKey } from '../src/domain.mjs';
import { demoAccounts, seed } from '../scripts/seed.mjs';

const password = 'solo-pruebas-locales';
const accountIds = demoAccounts.map(({id}) => id);
const passwords = Object.fromEntries(accountIds.map((id) => [id, password]));
let time = new Date('2026-11-20T21:00:00.000Z');
let folder;
let first;
let base;

async function freePort() {
  const socket = createServer();
  await new Promise((done) => socket.listen(0, '127.0.0.1', done));
  const { port } = socket.address();
  await new Promise((done) => socket.close(done));
  return port;
}

async function cluster(path, initialize) {
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: path, user: 'postgres', password, port, persistent: true,
    onLog: () => {}, onError: console.error
  });
  if (initialize) await pg.initialise();
  await pg.start();
  const pool = database('postgresql://postgres:' + password + '@127.0.0.1:' + port + '/postgres');
  const connections = new Set();
  pool.on('connect', (client) => {
    const closed = new Promise((done) => client.once('end', done));
    connections.add(closed);
    void closed.then(() => connections.delete(closed));
  });
  async function stopDatabase() {
    await pool.end();
    await Promise.all(connections);
    await pg.stop();
  }
  let server;
  try {
    server = await serve(pool, {host: '127.0.0.1', port: 0, secure: false, clock: () => time});
  } catch (error) {
    await stopDatabase();
    throw error;
  }
  return {
    pool, url: 'http://127.0.0.1:' + server.address().port,
    async stop() {
      await new Promise((done) => server.close(done));
      await stopDatabase();
    }
  };
}

before(async () => {
  folder = await mkdtemp(join(tmpdir(), 'aurora-test-'));
  first = await cluster(join(folder, 'original'), true);
  base = first.url;
  await seed(first.pool, passwords, time);
});
after(async () => {
  if (first) await first.stop();
  if (folder) await rm(folder, { recursive: true, force: true });
});

async function request(path, {cookie, method = 'GET', body, url = base} = {}) {
  const response = await fetch(url + '/api' + path, {
    method, headers: {...(cookie ? { cookie } : {}), ...(body ? {'Content-Type': 'application/json'} : {})},
    ...(body ? {body: JSON.stringify(body)} : {})
  });
  return {status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0]};
}

async function login(id, url) {
  const response = await request('/login', {method: 'POST', body: {id, password}, url});
  assert.equal(response.status, 200);
  return response.cookie;
}

test('los umbrales son inclusivos y el plazo incluye el fin de semana', () => {
  const received = new Date('2026-11-20T21:00:00.000Z');
  const levels = [23.99, 24, 36, 48, 48.01].map((age) => deadline({received_at: received}, new Date(+received + age * hour)));
  assert.deepEqual(levels.map(({level}) => level), ['En plazo', 'Preventivo', 'Urgente', 'Urgente', 'Vencido']);
  assert.equal(levels[0].due_at.toISOString(), '2026-11-22T21:00:00.000Z');
  assert.equal(monthKey(new Date('2026-12-01T04:59:59Z')), '202611');
  assert.equal(monthKey(new Date('2026-12-01T05:00:00Z')), '202612');
});

test('cinco sesiones, radicación concurrente, permisos, historial y SLA', async () => {
  const [a1, a2, a3, a4, coordinator] = await Promise.all(accountIds.map((id) => login(id)));
  const agents = {agente1: a1, agente2: a2, agente3: a3, agente4: a4};
  assert.equal((await request('/tickets')).status, 401);
  await assert.rejects(first.pool.query("INSERT INTO clients VALUES ('990000001','Duplicado')"), {code: '23505'});
  const seeded = await request('/export', {cookie: coordinator});
  assert.equal(seeded.data.clients.length, 300);
  assert.equal(seeded.data.tickets.length, 600);
  assert(seeded.data.tickets.every(({nit}) => seeded.data.clients.some((client) => client.nit === nit)));
  const levels = await Promise.all(['En plazo', 'Preventivo', 'Urgente', 'Vencido', 'Atendido']
    .map((level) => request('/tickets?level=' + encodeURIComponent(level), {cookie: coordinator})));
  assert(levels.every(({data}) => data.count > 0));
  const input = {nit: '990000001', channel: 'Teléfono', type: 'Estado de pedido', description: 'Verificación del pedido ficticio.'};
  const create = (cookie, body = input) => request('/tickets', {cookie, body, method: 'POST'});
  assert.equal((await create(a1, {...input, description: 'corta'})).status, 400);
  assert.equal((await request('/tickets', {cookie: coordinator})).data.stats.total, 600);
  const results = await Promise.all(Object.values(agents).map((cookie) => create(cookie)));
  assert(results.every(({status}) => status === 201));
  assert.equal(new Set(results.map(({data}) => data.id)).size, 4);
  assert.equal(new Set(results.map(({data}) => data.agent_id)).size, 4);
  const ticket = results.find(({data}) => data.agent_id === 'agente1').data;
  const path = '/tickets/' + ticket.id;
  const update = (cookie, body) => request(path, {cookie, body, method: 'PATCH'});
  assert.equal((await request(path, {cookie: a2})).status, 404);
  assert.equal((await update(a2, {action: 'state', state: 'En proceso', version: 1})).status, 404);
  assert.equal((await update(coordinator, {action: 'state', state: 'Cerrado', version: 1})).status, 400);
  assert.equal((await update(coordinator, {action: 'assign', agent_id: 'agente2', version: 1})).status, 200);
  assert.equal((await request(path, {cookie: a1})).status, 404);
  const race = await Promise.all(['En proceso', 'Pendiente de logística'].map((state) =>
    update(a2, {action: 'state', version: 2, state})));
  assert.deepEqual(race.map(({status}) => status).sort(), [200, 409]);
  time = new Date(+new Date(ticket.received_at) + 48 * hour);
  assert.equal((await update(a2, {action: 'state', version: 3, state: 'Resuelto'})).status, 400);
  const resolved = await update(a2, {action: 'state', version: 3, state: 'Resuelto', response: 'Pedido confirmado.'});
  assert.equal(resolved.data.elapsed_hours, 48);
  assert.equal(resolved.data.within_sla, true);
  assert.equal(resolved.data.level, 'Atendido');
  assert.equal((await update(coordinator, {action: 'state', state: 'Cerrado', version: 4})).data.within_sla, true);
  const other = results.find(({data}) => data.id !== ticket.id).data;
  time = new Date(+new Date(other.received_at) + 48 * hour + 1000);
  const late = await request('/tickets/' + other.id, {
    cookie: agents[other.agent_id], method: 'PATCH',
    body: {action: 'state', version: 1, state: 'Resuelto', response: 'Atención posterior al plazo.'}
  });
  assert.equal(late.data.within_sla, false);
  const detail = await request(path, {cookie: coordinator});
  assert.deepEqual(detail.data.events.map(({action}) => action),
    ['Radicación · Teléfono', 'Reasignación', 'Cambio de estado', 'Resolución', 'Cierre']);
  const filtered = await request('/tickets?q=' + ticket.nit + '&agent=agente2&state=Cerrado&level=Atendido', {cookie: coordinator});
  assert.deepEqual(filtered.data.items.map(({id}) => id), [ticket.id]);
  assert.equal(filtered.data.stats.resolved, 202);
  assert.equal(filtered.data.stats.met, 101);
  time = new Date('2026-12-01T05:00:00Z');
  assert.equal((await create(a1)).data.id, 'AUR-202612-0001');
  assert.equal((await request('/logout', {cookie: coordinator, method: 'POST', body: {}})).status, 200);
  assert.equal((await request('/tickets', {cookie: coordinator})).status, 401);
  assert.equal((await request(path, {cookie: await login('coordinador')})).data.ticket.state, 'Cerrado');
});

test('importación con confirmación y exportación sin credenciales', async () => {
  const cookie = await login('coordinador');
  const agent = await login('agente1');
  const ingest = (format, content, confirm, session = cookie) =>
    request('/clients/import', {cookie: session, method: 'POST', body: {format, content, confirm}});
  const csv = 'nit,razon_social\n001122,"Colegio, sede norte"';
  assert.equal((await ingest('csv', csv, false, agent)).status, 403);
  assert.equal((await ingest('csv', csv, false)).data.imported, false);
  assert.equal((await request('/clients?q=001122', {cookie})).data.length, 0);
  assert.equal((await ingest('csv', csv, true)).data.imported, true);
  const invalid = '[{"nit":"008","name":"Prueba"},{"nit":"008","name":"Prueba 2"},{"nit":"001122","name":""}]';
  const rejection = await ingest('json', invalid, true);
  assert.equal(rejection.status, 422);
  assert.deepEqual(rejection.data.errors.map(({line}) => line), [1, 2, 3, 3]);
  assert.equal((await request('/clients?q=008', {cookie})).data.some(({nit}) => nit === '008'), false);
  assert.equal((await ingest('json', '[{"nit":"009","razon_social":"Cliente ficticio"}]', true)).data.imported, true);
  const exported = await request('/export', {cookie});
  assert.equal(exported.data.clients.find(({nit}) => nit === '001122').name, 'Colegio, sede norte');
  assert.deepEqual(Object.keys(exported.data), ['clients', 'tickets', 'events']);
  assert(!JSON.stringify(exported.data).includes(password));
  assert.equal((await request('/export', {cookie: agent})).status, 403);
});

test('cinco navegadores y restauración aislada', {timeout: 60_000}, async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox']});
  const signIn = async (url, id) => {
    const page = await browser.newPage();
    await page.goto(url);
    await page.getByLabel('Usuario').fill(id);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', {name: 'Ingresar'}).click();
    await page.getByRole('heading', {name: 'Bandeja de solicitudes'}).waitFor();
    return page;
  };
  let restored;
  try {
    const pages = await Promise.all(accountIds.map((id) => signIn(base, id)));
    const coordinator = pages.at(-1);
    const start = performance.now();
    const refreshResponse = coordinator.waitForResponse((response) =>
      new URL(response.url()).pathname === '/api/tickets' && response.ok());
    await coordinator.getByRole('button', {name: 'Actualizar'}).click();
    await (await refreshResponse).finished();
    await coordinator.locator('#rows a').first().waitFor();
    const load = performance.now() - start;
    const createStart = performance.now();
    const agent = pages[0];
    await agent.getByRole('button', {name: /Nueva solicitud/}).click();
    await agent.getByLabel('Buscar cliente por NIT o razón social').fill('990000001');
    await agent.locator('#ticket-form select[name=nit]').selectOption('990000001');
    await agent.getByLabel('Canal', {exact: true}).selectOption('Teléfono');
    await agent.getByLabel('Tipo', {exact: true}).selectOption('Estado de pedido');
    await agent.getByLabel('Descripción', {exact: true}).fill('Radicación de prueba desde una sesión independiente.');
    await agent.getByRole('button', {name: 'Guardar radicación'}).click();
    await agent.locator('#notice').waitFor({state: 'visible'});
    const capture = performance.now() - createStart;
    const id = (await agent.locator('#notice').textContent()).match(/AUR-\d{6}-\d{4}/)[0];
    const searchStart = performance.now();
    await coordinator.getByRole('searchbox', {name: 'Buscar'}).fill(id);
    await coordinator.getByRole('link', {name: id, exact: true}).waitFor();
    const search = performance.now() - searchStart;
    console.log('Chromium, cinco sesiones: bandeja %d ms, búsqueda %d ms, radicación automatizada %d ms',
      Math.round(load), Math.round(search), Math.round(capture));
    assert(load <= 1500 && search <= 1500 && capture < 30_000);
    await coordinator.getByRole('link', {name: id, exact: true}).click();
    await coordinator.getByRole('heading', {name: 'Historial'}).waitFor();
    await first.stop();
    first = undefined;
    // Physical backup is taken only after a clean stop and restored into a second directory.
    await cp(join(folder, 'original'), join(folder, 'restored'), {recursive: true});
    restored = await cluster(join(folder, 'restored'), false);
    const recoveredPage = await signIn(restored.url, 'coordinador');
    await recoveredPage.getByRole('searchbox', {name: 'Buscar'}).fill(id);
    await recoveredPage.getByRole('link', {name: id, exact: true}).click();
    await recoveredPage.getByRole('heading', {name: 'Historial'}).waitFor();
    assert.match(await recoveredPage.locator('#detail').textContent(), /Empresa Ficticia 1.*Agente [1-4].*Nuevo.*Radicación/s);
    const initial = await request('/tickets/' + id, {cookie: await login('coordinador', restored.url), url: restored.url});
    const nextAgent = initial.data.ticket.agent_id === 'agente4' ? 'agente3' : 'agente4';
    await recoveredPage.locator('select[name=agent_id]').selectOption(nextAgent);
    await recoveredPage.getByRole('button', {name: 'Reasignar', exact: true}).click();
    await recoveredPage.locator('#detail li').filter({hasText: 'Reasignación'}).waitFor();
    const newOwner = await signIn(restored.url, nextAgent);
    await newOwner.getByRole('searchbox', {name: 'Buscar'}).fill(id);
    await newOwner.getByRole('link', {name: id, exact: true}).click();
    await newOwner.locator('#detail select[name=state]').selectOption('Resuelto');
    await newOwner.getByLabel('Respuesta de fondo').fill('Solicitud verificada en el piloto.');
    await newOwner.getByRole('button', {name: 'Actualizar estado'}).click();
    await newOwner.getByRole('heading', {name: 'Respuesta de fondo'}).waitFor();
    await recoveredPage.reload();
    await recoveredPage.getByRole('button', {name: 'Cerrar solicitud'}).click();
    await recoveredPage.locator('#detail li').filter({hasText: 'Cierre'}).waitFor();
    await recoveredPage.getByRole('button', {name: 'Cerrar', exact: true}).click();
    await recoveredPage.getByRole('button', {name: 'Datos del piloto'}).click();
    const download = recoveredPage.waitForEvent('download');
    await recoveredPage.getByRole('link', {name: 'Descargar datos del piloto en JSON'}).click();
    assert.equal((await download).suggestedFilename(), 'aurora-piloto.json');
  } finally {
    await browser.close();
    if (restored) await restored.stop();
  }
});
