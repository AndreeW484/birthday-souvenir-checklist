const $ = id => document.getElementById(id);
let guests = [], filter = 'all', activeType = 'adultos', loading = false;
const busy = new Set();
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json' } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No pudimos completar la operación.');
  return data;
}
function render() {
  const label = activeType === 'adultos' ? 'adultos' : 'niños';
  const groups = guests.filter(g => g[activeType] > 0);
  const total = groups.reduce((sum, g) => sum + g[activeType], 0);
  const done = groups.reduce((sum, g) => sum + g[activeType + '_entregados'], 0);
  $('people').textContent = groups.length + ' grupos con ' + label;
  $('total').textContent = total; $('done').textContent = done; $('pending').textContent = total - done;
  $('category-heading').textContent = 'Regalos para ' + label;
  $('total-label').textContent = activeType === 'adultos' ? 'Adultos' : 'Niños';
  $('gift-panel').setAttribute('aria-labelledby', 'tab-' + activeType);
  $('gift-panel').dataset.type = activeType;
  for (const tipo of ['adultos', 'ninos']) {
    $(tipo + '-count').textContent = guests.reduce((sum, g) => sum + g[tipo], 0);
    const selected = tipo === activeType;
    $('tab-' + tipo).setAttribute('aria-selected', String(selected));
    $('tab-' + tipo).tabIndex = selected ? 0 : -1;
  }
  const percent = total ? Math.round(done / total * 100) : 0;
  $('percentage').textContent = `${percent}%`; $('progress').value = percent;
  const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const visible = groups.filter(g => normalize(g.nombre).includes(normalize($('search').value)) && (filter === 'all' || (filter === 'done' ? g[activeType + '_entregados'] === g[activeType] : filter === 'partial' ? g[activeType + '_entregados'] > 0 && g[activeType + '_entregados'] < g[activeType] : g[activeType + '_entregados'] < g[activeType]))).sort((a,b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  $('list').replaceChildren();
  for (const guest of visible) {
    const row = document.createElement('div'); row.className = 'guest';
    const avatar = document.createElement('span'); avatar.className = 'avatar'; avatar.setAttribute('aria-hidden', 'true'); avatar.textContent = (guest.nombre || '?').split(/\s+/).slice(0,2).map(s => s[0]).join('').toUpperCase();
    const info = document.createElement('div'); info.className = 'guest-info';
    const name = document.createElement('div'); name.className = 'guest-name'; name.textContent = guest.nombre || 'Sin nombre';
    const detail = document.createElement('small');
    const delivered = guest[activeType + '_entregados'];
    const complete = delivered === guest[activeType];
    detail.textContent = complete ? '¡Todo entregado! ♡' : `${guest[activeType] - delivered} regalos pendientes`;
    row.classList.toggle('is-complete', complete);
    const composition = document.createElement('small');
    composition.textContent = `${delivered} de ${guest[activeType]} regalos para ${label} entregados`;
    info.append(name, composition, detail);
    const tipo = activeType;
    const actions = document.createElement('div'); actions.className = 'delivery-actions';
    for (const [text, quantity] of [['+1 regalo', delivered + 1], ['Completar', guest[tipo]], ['−1 regalo', delivered - 1]]) {
      const button = document.createElement('button'); button.className = 'delivery' + (text === '+1 regalo' ? ' primary' : text === '−1 regalo' ? ' correction' : '');
      button.textContent = busy.has(guest.id) ? 'Guardando…' : text;
      button.setAttribute('aria-label', text + ' para ' + label + ' de ' + guest.nombre);
      button.disabled = busy.size > 0 || loading || quantity < 0 || quantity > guest[tipo] || quantity === delivered;
      button.addEventListener('click', () => toggle(guest, tipo, quantity));
      actions.append(button);
    }
    row.append(avatar, info, actions); $('list').append(row);
  }
  if (!visible.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = loading ? 'Cargando grupos…' : guests.length ? 'No hay grupos con este filtro.' : 'Todavía no hay grupos en la lista.'; $('list').append(empty); }
  $('result-count').textContent = `${visible.length} de ${groups.length} grupos con ${label}`;
}
async function refresh() {
  if (loading || busy.size) return;
  loading = true; $('refresh').disabled = true; $('message').textContent = 'Cargando grupos…'; render();
  try { guests = await api('/api/invitados'); $('message').textContent = ''; }
  catch (error) { $('message').textContent = error.message; }
  finally { loading = false; $('refresh').disabled = false; render(); }
}
async function toggle(guest, tipo, quantity) {
  if (quantity < guest[tipo + '_entregados'] && !confirm(`¿Reducir los regalos para ${tipo === 'adultos' ? 'adultos' : 'niños'} de ${guest.nombre} a ${quantity}?`)) return;
  busy.add(guest.id); render(); $('message').textContent = '';
  try {
    const updated = await api(`/api/invitados/${guest.id}`, { method: 'PATCH', body: JSON.stringify({ tipo, cantidad: quantity, expected_adultos: guest.adultos_entregados, expected_ninos: guest.ninos_entregados }) });
    guests = guests.map(g => g.id === guest.id ? updated : g);
    $('message').textContent = `${guest.nombre}: ${updated[tipo + '_entregados']} de ${updated[tipo]} regalos para ${tipo === 'adultos' ? 'adultos' : 'niños'} entregados.`;
  } catch (error) { $('message').textContent = error.message; }
  finally { busy.delete(guest.id); render(); }
}
function selectType(tipo) {
  activeType = tipo; filter = 'all'; $('search').value = ''; $('message').textContent = '';
  document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === 'all')));
  render();
}
for (const tipo of ['adultos', 'ninos']) {
  const tab = $('tab-' + tipo);
  tab.addEventListener('click', () => selectType(tipo));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'adultos' : event.key === 'End' ? 'ninos' : tipo === 'adultos' ? 'ninos' : 'adultos';
    selectType(next); $('tab-' + next).focus();
  });
}
$('search').addEventListener('input', render);
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); render(); }));
$('refresh').addEventListener('click', refresh);
(async () => { try { const config = await api('/api/config'); $('demo').hidden = !config.demo; await refresh(); } catch { $('message').textContent = 'No pudimos conectar. Usa Actualizar para reintentar.'; } })();
