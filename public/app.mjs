const $ = (selector, root = document) => root.querySelector(selector);
const mainForm = $('#ticket-form');
const filters = $('#filters');
const dialogs = [...document.querySelectorAll('dialog')];
const date = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota'
});
let context;
let page = 1;
let listRequest = 0;
let clientRequest = 0;
let detailRequest = 0;
let noticeTimer;
let importFile;
const text = (tag, value) => Object.assign(document.createElement(tag), { textContent: value });
const formValues = (form) => Object.fromEntries(new FormData(form));

async function api(path, method = 'GET', body) {
  const response = await fetch('/api' + path, {
    method, ...(body === undefined ? {} : { headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) })
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && context) signedOut();
    throw Object.assign(new Error(data.error || 'Revisa los datos enviados.'), { status: response.status, data });
  }
  return data;
}

function notice(message) {
  const node = $('#notice');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { node.hidden = true; }, 5500);
}

function signedOut() {
  context = undefined;
  ++listRequest;
  ++clientRequest;
  ++detailRequest;
  dialogs.forEach((dialog) => dialog.close());
  $('#rows').replaceChildren();
  $('#stats').replaceChildren();
  $('#detail').replaceChildren();
  $('#notice').hidden = true;
  $('#account').hidden = true;
  $('#work').hidden = true;
  $('#login').hidden = false;
}

function options(select, entries, placeholder) {
  select.replaceChildren(new Option(placeholder, ''));
  for (const [value, label] of entries) select.add(new Option(label, value));
}

async function enter() {
  context = await api('/me');
  const { user, agents, states, channels, types } = context;
  const coordinator = user.role === 'coordinator';
  $('#identity').textContent = user.name + ' · ' + (coordinator ? 'Coordinación' : 'Atención');
  $('#data-button').hidden = !coordinator;
  $('#login').hidden = true;
  $('#account').hidden = false;
  $('#work').hidden = false;
  filters.reset();
  options(filters.elements.agent, agents.map(({id, name}) => [id, name]), 'Todos');
  options(filters.elements.state, states.map((value) => [value, value]), 'Todos');
  options(mainForm.elements.channel, channels.map((value) => [value, value]), 'Selecciona un canal');
  options(mainForm.elements.type, types.map((value) => [value, value]), 'Selecciona un tipo');
  page = 1;
  await refresh();
  if (location.pathname.startsWith('/solicitudes/')) await showDetail(location.pathname.split('/').at(-1));
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = $('#login-error');
  error.textContent = '';
  try {
    await api('/login', 'POST', formValues(event.currentTarget));
    $('#login-form').reset();
    await enter();
  } catch (failure) {
    error.textContent = failure.message;
  }
});

$('#logout').addEventListener('click', async () => {
  try {
    await api('/logout', 'POST', {});
    signedOut();
  } catch (error) { notice(error.message); }
});

function renderStats(stats) {
  const values = [['Registradas', stats.total], ['Abiertas', stats.open], ['En alerta', stats.risk], ['Vencidas', stats.overdue]];
  if (stats.resolved !== undefined) {
    values.push(['Cumplimiento 48 h', stats.resolved ? Math.round(100 * stats.met / stats.resolved) + ' %' : 'Sin resueltas']);
  }
  $('#stats').replaceChildren(...values.map(([label, value]) => {
    const card = document.createElement('div');
    card.className = 'stat';
    card.append(text('strong', value), text('span', label));
    return card;
  }));
}

function renderRows(items) {
  const rows = items.map((ticket) => {
    const row = document.createElement('tr');
    const link = text('a', ticket.id);
    link.href = '/solicitudes/' + ticket.id;
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      history.pushState(null, '', link.href);
      void showDetail(ticket.id);
    });
    row.insertCell().append(link, text('small', ticket.client_name));
    row.insertCell().textContent = ticket.type;
    row.insertCell().textContent = ticket.agent_name;
    row.insertCell().textContent = ticket.state;
    const badge = text('span', ticket.level);
    badge.className = 'pill';
    badge.dataset.level = ticket.level;
    row.insertCell().append(badge, text('small', date.format(new Date(ticket.due_at))));
    return row;
  });
  if (!rows.length) {
    const row = document.createElement('tr');
    const cell = row.insertCell();
    cell.colSpan = 5;
    cell.textContent = 'No hay solicitudes que coincidan con los filtros.';
    rows.push(row);
  }
  $('#rows').replaceChildren(...rows);
}

async function refresh() {
  if (!context) return;
  const sequence = ++listRequest;
  const params = new URLSearchParams({...formValues(filters), page});
  try {
    const data = await api('/tickets?' + params);
    if (sequence !== listRequest) return;
    if (page > 1 && !data.items.length) { page = 1; return refresh(); }
    renderStats(data.stats);
    renderRows(data.items);
    $('#results').textContent = data.count ? ((page - 1) * data.pageSize + 1) + '–' + ((page - 1) * data.pageSize + data.items.length) + ' de ' + data.count : '0 solicitudes';
    $('#previous').disabled = page === 1;
    $('#next').disabled = page * data.pageSize >= data.count;
  } catch (error) { if (sequence === listRequest) notice(error.message); }
}

function debounce(fn, delay) {
  let timer;
  return () => { clearTimeout(timer); timer = setTimeout(fn, delay); };
}
const filter = () => { page = 1; void refresh(); };
filters.addEventListener('submit', (event) => { event.preventDefault(); filter(); });
filters.addEventListener('change', filter);
filters.elements.q.addEventListener('input', debounce(filter, 180));
$('#refresh').addEventListener('click', refresh);
$('#previous').addEventListener('click', () => { --page; void refresh(); });
$('#next').addEventListener('click', () => { ++page; void refresh(); });
setInterval(refresh, 30_000);

for (const dialog of dialogs) $('.close', dialog).addEventListener('click', () => dialog.close());

async function searchClients() {
  const sequence = ++clientRequest;
  const select = mainForm.elements.nit;
  try {
    const rows = await api('/clients?' + new URLSearchParams({q: $('#client-query').value}));
    if (sequence !== clientRequest) return;
    const previous = select.value;
    options(select, rows.map(({nit, name}) => [nit, name + ' · ' + nit]), rows.length ? 'Selecciona un cliente' : 'Sin coincidencias');
    if (rows.some(({nit}) => nit === previous)) select.value = previous;
    else if (rows.length === 1 && $('#client-query').value) select.value = rows[0].nit;
  } catch (error) { $('.error', mainForm).textContent = error.message; }
}

$('#new-button').addEventListener('click', () => {
  mainForm.reset();
  $('.error', mainForm).textContent = '';
  $('#new-dialog').showModal();
  void searchClients();
});
$('#client-query').addEventListener('input', debounce(searchClients, 150));
mainForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('button.primary', mainForm);
  button.disabled = true;
  $('.error', mainForm).textContent = '';
  try {
    const ticket = await api('/tickets', 'POST', formValues(mainForm));
    $('#new-dialog').close();
    notice(ticket.id + ' asignado a ' + ticket.agent_name + '.');
    await refresh();
  } catch (error) { $('.error', mainForm).textContent = error.message; }
  finally { button.disabled = false; }
});

function detailForm(ticket, action, label) {
  const form = document.createElement('form');
  const field = (labelText, control) => {
    const node = text('label', labelText);
    node.append(control);
    form.append(node);
  };
  if (action === 'assign') {
    const select = document.createElement('select');
    select.name = 'agent_id';
    select.required = true;
    options(select, context.agents.filter(({id}) => id !== ticket.agent_id).map(({id, name}) => [id, name]), 'Selecciona otro agente');
    field('Nuevo responsable', select);
  } else if (action === 'state') {
    const select = document.createElement('select');
    select.name = 'state';
    select.required = true;
    options(select, context.states.filter((value) => value !== 'Cerrado' && value !== ticket.state).map((value) => [value, value]), 'Selecciona un estado');
    field('Nuevo estado', select);
    const response = document.createElement('textarea');
    response.name = 'response';
    field('Respuesta de fondo', response);
    response.parentElement.hidden = true;
    select.addEventListener('change', () => {
      response.required = select.value === 'Resuelto';
      response.parentElement.hidden = !response.required;
    });
  }
  const comments = document.createElement('input');
  comments.name = 'comments';
  field('Comentario (opcional)', comments);
  const error = text('p', '');
  error.className = 'error';
  error.setAttribute('role', 'alert');
  const button = text('button', label);
  button.className = 'primary';
  form.append(error, button);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    button.disabled = true;
    try {
      await api('/tickets/' + ticket.id, 'PATCH', {...formValues(form), version: ticket.version,
        action: action === 'close' ? 'state' : action, ...(action === 'close' ? {state: 'Cerrado'} : {})});
      await showDetail(ticket.id);
      await refresh();
    } catch (failure) { error.textContent = failure.message; }
    finally { button.disabled = false; }
  });
  return form;
}

async function showDetail(id) {
  const sequence = ++detailRequest;
  const dialog = $('#detail-dialog');
  const content = $('#detail');
  if (!dialog.open) dialog.showModal();
  $('#detail-title').textContent = id;
  content.replaceChildren(text('p', 'Cargando solicitud…'));
  try {
    const {ticket, events} = await api('/tickets/' + encodeURIComponent(id));
    if (sequence !== detailRequest || !dialog.open) return;
    const facts = document.createElement('dl');
    facts.className = 'facts';
    const entries = [
      ['Cliente', ticket.client_name + ' · ' + ticket.nit], ['Responsable', ticket.agent_name],
      ['Estado', ticket.state], ['Canal', ticket.channel], ['Tipo', ticket.type],
      ['Recepción', date.format(new Date(ticket.received_at))], ['Plazo', date.format(new Date(ticket.due_at))],
      ['Seguimiento', ticket.resolved_at ? (ticket.within_sla ? 'Cumplido' : 'Fuera de plazo') : ticket.level]
    ];
    if (ticket.order_id) entries.push(['Pedido', ticket.order_id]);
    if (ticket.resolved_at) entries.push(['Resolución', date.format(new Date(ticket.resolved_at))], ['Tiempo de atención', ticket.elapsed_hours.toFixed(2) + ' h']);
    for (const [key, value] of entries) {
      const item = document.createElement('div');
      item.append(text('dt', key), text('dd', value));
      facts.append(item);
    }
    content.replaceChildren(facts, text('h3', 'Descripción'), text('p', ticket.description));
    if (ticket.response) content.append(text('h3', 'Respuesta de fondo'), text('p', ticket.response));
    const history = document.createElement('ol');
    for (const entry of events) {
      const state = entry.old_state !== entry.new_state ? [entry.old_state, entry.new_state].filter(Boolean).join(' → ') : '';
      const agent = entry.new_agent ? [entry.old_agent, entry.new_agent].filter(Boolean).join(' → ') : '';
      history.append(text('li', [entry.action, entry.actor_name, date.format(new Date(entry.at)), state, agent, entry.comments].filter(Boolean).join(' · ')));
    }
    content.append(text('h3', 'Historial'), history);
    if (context.user.role === 'coordinator' && !ticket.resolved_at) content.append(detailForm(ticket, 'assign', 'Reasignar'));
    if (context.user.role === 'coordinator' && ticket.state === 'Resuelto') content.append(detailForm(ticket, 'close', 'Cerrar solicitud'));
    if (context.user.id === ticket.agent_id && !ticket.resolved_at) content.append(detailForm(ticket, 'state', 'Actualizar estado'));
  } catch (error) {
    if (sequence === detailRequest) content.replaceChildren(text('p', error.message));
  }
}
$('#detail-dialog').addEventListener('close', () => {
  ++detailRequest;
  if (location.pathname.startsWith('/solicitudes/')) history.replaceState(null, '', '/');
});
window.addEventListener('popstate', () => {
  if (context && location.pathname.startsWith('/solicitudes/')) void showDetail(location.pathname.split('/').at(-1));
  else $('#detail-dialog').close();
});

const importForm = $('#import-form');
const confirmImport = $('#confirm-import');
const importResult = $('#import-result');
function clearImport() {
  importFile = undefined;
  confirmImport.hidden = true;
  importResult.replaceChildren();
}
$('#data-button').addEventListener('click', () => {
  importForm.reset();
  clearImport();
  $('#data-dialog').showModal();
});
importForm.elements.file.addEventListener('change', clearImport);

async function sendImport(confirm, file) {
  const result = await api('/clients/import', 'POST', {...file, confirm}).catch((error) => {
    if (error.status === 422) return error.data;
    throw error;
  });
  if (file !== importFile) return;
  importResult.replaceChildren();
  if (result.errors.length) {
    const list = document.createElement('ul');
    for (const item of result.errors) list.append(text('li', 'Fila o entrada ' + item.line + ' · ' + item.message));
    importResult.append(text('p', 'Corrige los errores antes de importar.'), list);
    confirmImport.hidden = true;
  } else {
    importResult.append(text('p', result.count + (confirm ? ' clientes importados.' : ' clientes válidos, listos para importar.')));
    confirmImport.hidden = confirm;
  }
}
importForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearImport();
  const file = importForm.elements.file.files[0];
  try {
    if (file.size > 600_000) throw new Error('Selecciona un archivo de hasta 600 KB.');
    const content = await file.text();
    if (file !== importForm.elements.file.files[0]) return;
    importFile = {format: file.name.split('.').at(-1).toLowerCase(), content};
    await sendImport(false, importFile);
  } catch (error) { importResult.textContent = error.message; }
});
confirmImport.addEventListener('click', async () => {
  confirmImport.disabled = true;
  try { await sendImport(true, importFile); }
  catch (error) { importResult.textContent = error.message; }
  finally { confirmImport.disabled = false; }
});

enter().catch((error) => {
  signedOut();
  if (error.status !== 401) $('#login-error').textContent = error.message;
});
