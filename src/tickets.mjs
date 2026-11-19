import { channels, types, openStates, deadline, monthKey, resolution } from './domain.mjs';
import { transaction } from './db.mjs';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function nextCounter(db, key) {
  const { rows } = await db.query(
    'INSERT INTO counters VALUES ($1,1) ON CONFLICT (key) DO UPDATE SET value=counters.value+1 RETURNING value', [key]
  );
  return rows[0].value;
}

export async function addEvent(db, ticket, actor, now, action, previous = {}, comments = null) {
  await db.query(
    'INSERT INTO events(ticket_id,actor_id,at,action,old_state,new_state,old_agent,new_agent,comments) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [ticket.id, actor, now, action, previous.state, ticket.state,
      previous.agent_id, previous.agent_id !== ticket.agent_id ? ticket.agent_id : null, comments]
  );
}

export async function createTicket(pool, body, actor, clock) {
  const { nit, channel, type, description, order_id } = body;
  if (typeof nit !== 'string' || !nit.trim()) throw new HttpError(400, 'Selecciona un cliente.');
  if (!channels.includes(channel)) throw new HttpError(400, 'Selecciona un canal válido.');
  if (!types.includes(type)) throw new HttpError(400, 'Selecciona un tipo válido.');
  if (typeof description !== 'string' || [...description.trim()].length < 10) {
    throw new HttpError(400, 'Escribe una descripción de al menos 10 caracteres.');
  }
  if (order_id != null && typeof order_id !== 'string') throw new HttpError(400, 'Pedido inválido.');
  return transaction(pool, async (db) => {
    const { rows: [client] } = await db.query('SELECT * FROM clients WHERE nit=$1', [nit]);
    if (!client) throw new HttpError(400, 'El cliente no existe.');
    const { rows: agents } = await db.query("SELECT id,name FROM users WHERE role='agent' ORDER BY id");
    if (!agents.length) throw new HttpError(503, 'No hay agentes habilitados.');
    const turn = await nextCounter(db, 'rotation');
    const now = clock();
    const month = monthKey(now);
    const seq = await nextCounter(db, 'ticket:' + month);
    if (seq > 9999) throw new HttpError(409, 'Se agotaron los consecutivos de este mes.');
    const agent = agents[(turn - 1) % agents.length];
    const id = 'AUR-' + month + '-' + String(seq).padStart(4, '0');
    const { rows: [ticket] } = await db.query(
      `INSERT INTO tickets(id,nit,client_name,channel,type,description,order_id,agent_id,state,received_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Nuevo',$9) RETURNING *`,
      [id, nit, client.name, channel, type, description.trim(), order_id?.trim() || null, agent.id, now]
    );
    await addEvent(db, ticket, actor, now, 'Radicación · ' + channel);
    return deadline({ ...ticket, agent_name: agent.name }, now);
  });
}

export async function readTicket(db, id, user, lock = false) {
  const { rows: [ticket] } = await db.query(
    `SELECT t.*, u.name AS agent_name FROM tickets t JOIN users u ON u.id=t.agent_id
     WHERE t.id=$1 AND ($2 OR t.agent_id=$3)${lock ? ' FOR UPDATE OF t' : ''}`,
    [id, user.role === 'coordinator', user.id]
  );
  if (!ticket) throw new HttpError(404, 'Solicitud no disponible.');
  return ticket;
}

export async function changeTicket(pool, id, body, user, clock) {
  return transaction(pool, async (db) => {
    const ticket = await readTicket(db, id, user, true);
    if (body.version !== ticket.version) throw new HttpError(409, 'El caso cambió. Vuelve a abrirlo antes de guardar.');
    const now = clock();
    let updated;
    let action;
    const comments = typeof body.comments === 'string' ? body.comments.trim() || null : null;
    if (body.action === 'assign') {
      if (user.role !== 'coordinator') throw new HttpError(403, 'Acción reservada al coordinador.');
      const { rows: [agent] } = await db.query("SELECT id FROM users WHERE id=$1 AND role='agent'", [body.agent_id]);
      if (!agent || agent.id === ticket.agent_id || !openStates.includes(ticket.state)) {
        throw new HttpError(400, 'Selecciona otro agente para un caso abierto.');
      }
      ({ rows: [updated] } = await db.query('UPDATE tickets SET agent_id=$2,version=version+1 WHERE id=$1 RETURNING *', [id, agent.id]));
      action = 'Reasignación';
    } else if (body.action === 'state') {
      const target = body.state;
      if (target === 'Cerrado') {
        if (user.role !== 'coordinator') throw new HttpError(403, 'Solo el coordinador puede cerrar.');
        if (ticket.state !== 'Resuelto') throw new HttpError(400, 'Primero se debe resolver la solicitud.');
      } else {
        if (ticket.agent_id !== user.id) throw new HttpError(403, 'Solo el agente asignado puede actualizar el caso.');
        if (!openStates.includes(ticket.state) || target === ticket.state ||
            ![...openStates, 'Resuelto'].includes(target)) throw new HttpError(400, 'Cambio de estado inválido.');
      }
      const resolved = target === 'Resuelto';
      const response = typeof body.response === 'string' ? body.response.trim() : '';
      if (resolved && !response) throw new HttpError(400, 'Registra la respuesta de fondo.');
      const timing = resolved ? resolution(ticket.received_at, now) : null;
      ({ rows: [updated] } = await db.query(
        `UPDATE tickets SET state=$2,version=version+1,resolved_at=COALESCE($3,resolved_at),
         response=COALESCE($4,response),elapsed_hours=COALESCE($5,elapsed_hours),within_sla=COALESCE($6,within_sla)
         WHERE id=$1 RETURNING *`,
        [id, target, resolved ? now : null, resolved ? response : null, timing?.hours, timing?.withinSla]
      ));
      action = resolved ? 'Resolución' : target === 'Cerrado' ? 'Cierre' : 'Cambio de estado';
    } else {
      throw new HttpError(400, 'Acción inválida.');
    }
    await addEvent(db, updated, user.id, now, action, ticket, comments);
    return deadline(updated, now);
  });
}
