import { hashPassword } from '../src/auth.mjs';
import { transaction } from '../src/db.mjs';
import { hour, monthKey, channels, types, openStates } from '../src/domain.mjs';
import { addEvent, nextCounter } from '../src/tickets.mjs';

export const demoAccounts = [
  ...Array.from({length: 4}, (_, i) => ({id: 'agente' + (i + 1), name: 'Agente ' + (i + 1), role: 'agent'})),
  {id: 'coordinador', name: 'Coordinador', role: 'coordinator'}
];

export async function seed(pool, passwords, now = new Date()) {
  await transaction(pool, async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(70102)');
    const { rows: [current] } = await db.query('SELECT count(*)::int AS count FROM users');
    if (current.count) return;
    for (const account of demoAccounts) {
      const password = passwords[account.id];
      if (typeof password !== 'string' || password.length < 12) throw new Error('Falta una contraseña de prueba de al menos 12 caracteres para ' + account.id);
      await db.query('INSERT INTO users VALUES ($1,$2,$3,$4)', [account.id, account.name, account.role, await hashPassword(password)]);
    }
    await db.query(`INSERT INTO clients SELECT '990' || lpad(n::text,6,'0'),
      CASE WHEN n % 4=0 THEN 'Colegio Ficticio ' ELSE 'Empresa Ficticia ' END || n
      FROM generate_series(1,300) n`);
    const { rows: clients } = await db.query('SELECT * FROM clients ORDER BY nit');
    for (let i = 0; i < 600; i++) {
      const age = [4, 27, 39, 53, 65, 91][i % 6] + Math.floor(i / 6) * 0.003;
      const time = new Date(+now - age * hour);
      const month = monthKey(time);
      const seq = await nextCounter(db, 'ticket:' + month);
      const id = 'AUR-' + month + '-' + String(seq).padStart(4, '0');
      const agent = demoAccounts[i % 4].id;
      const client = clients[i % clients.length];
      const channel = channels[i % 3];
      const state = openStates[i % 4];
      const { rows: [ticket] } = await db.query(
        'INSERT INTO tickets(id,nit,client_name,channel,type,description,agent_id,state,received_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
        [id, client.nit, client.name, channel, types[i % types.length],
          'Solicitud ficticia para probar el seguimiento de atención.', agent, 'Nuevo', time]
      );
      await addEvent(db, ticket, agent, time, 'Radicación · ' + channel);
      if (i % 6 >= 4) {
        const hours = i % 6 === 4 ? 30 : 55;
        const resolvedAt = new Date(+time + hours * hour);
        await db.query(`UPDATE tickets SET state='Resuelto',resolved_at=$2,elapsed_hours=$3,within_sla=$4,
          response='Respuesta ficticia para el ejercicio.',version=2 WHERE id=$1`, [id, resolvedAt, hours, hours <= 48]);
        await addEvent(db, {...ticket, state: 'Resuelto'}, agent, resolvedAt, 'Resolución', ticket);
      } else if (state !== 'Nuevo') {
        await db.query('UPDATE tickets SET state=$2,version=2 WHERE id=$1', [id, state]);
        await addEvent(db, {...ticket, state}, agent, new Date(+time + hour), 'Cambio de estado', ticket);
      }
    }
  });
}
