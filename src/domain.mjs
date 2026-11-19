export const channels = ['Teléfono', 'Correo', 'Mensajería'];
export const types = ['Consulta de stock', 'Estado de pedido', 'Inconformidad de envío', 'Facturación o cobro', 'Devolución'];
export const openStates = ['Nuevo', 'En proceso', 'Pendiente de logística', 'Pendiente de ventas'];
export const states = [...openStates, 'Resuelto', 'Cerrado'];
export const hour = 3_600_000;
const colombianMonth = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota', year: 'numeric', month: '2-digit'
});

export function monthKey(date) {
  const parts = Object.fromEntries(colombianMonth.formatToParts(date).map(({type, value}) => [type, value]));
  return parts.year + parts.month;
}

export function deadline(ticket, now) {
  const due = new Date(+ticket.received_at + 48 * hour);
  const elapsed = (now - ticket.received_at) / hour;
  const level = ticket.resolved_at ? 'Atendido' :
    elapsed > 48 ? 'Vencido' : elapsed >= 36 ? 'Urgente' : elapsed >= 24 ? 'Preventivo' : 'En plazo';
  return { ...ticket, due_at: due, level };
}

export function resolution(receivedAt, now) {
  const hours = (now - receivedAt) / hour;
  return { hours, withinSla: hours <= 48 };
}
