const $ = id => document.getElementById(id);
let guests = [], filter = 'all', loading = false;
const busy = new Set();
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json' } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No pudimos completar la operación.');
  return data;
}
function render() {
  const total = guests.reduce((sum, g) => sum + g.adultos + g.ninos, 0);
  const done = guests.reduce((sum, g) => sum + g.cantidad_entregada, 0);
  $('people').textContent = `${guests.length} grupos · ${guests.reduce((sum,g)=>sum+g.adultos,0)} adultos · ${guests.reduce((sum,g)=>sum+g.ninos,0)} niños`;
  $('total').textContent = total; $('done').textContent = done; $('pending').textContent = total - done;
  const percent = total ? Math.round(done / total * 100) : 0;
  $('percentage').textContent = `${percent}%`; $('progress').value = percent;
  const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const visible = guests.filter(g => normalize(g.nombre).includes(normalize($('search').value)) && (filter === 'all' || (filter === 'done' ? g.entregado : filter === 'partial' ? g.cantidad_entregada > 0 && !g.entregado : !g.entregado))).sort((a,b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  $('list').replaceChildren();
  for (const guest of visible) {
    const row = document.createElement('div'); row.className = 'guest';
    const avatar = document.createElement('span'); avatar.className = 'avatar'; avatar.setAttribute('aria-hidden', 'true'); avatar.textContent = (guest.nombre || '?').split(/\s+/).slice(0,2).map(s => s[0]).join('').toUpperCase();
    const info = document.createElement('div'); info.className = 'guest-info';
    const name = document.createElement('div'); name.className = 'guest-name'; name.textContent = guest.nombre || 'Sin nombre';
    const detail = document.createElement('small');
    detail.textContent = guest.entregado ? '¡Todo entregado! ♡' : `${guest.adultos + guest.ninos - guest.cantidad_entregada} recuerdos pendientes`;
    row.classList.toggle('is-complete', guest.entregado);
    const composition = document.createElement('small');
    composition.textContent = `${guest.adultos} adultos · ${guest.ninos} niños · ${guest.cantidad_entregada}/${guest.adultos + guest.ninos} recuerdos entregados`;
    info.append(name, composition, detail);
    const actions = document.createElement('div'); actions.className = 'delivery-actions';
    const total = guest.adultos + guest.ninos;
    for (const [label, quantity] of [['+1 recuerdo', guest.cantidad_entregada + 1], ['Completar', total], ['−1 recuerdo', guest.cantidad_entregada - 1]]) {
      const button = document.createElement('button'); button.className = 'delivery' + (label === '+1 recuerdo' ? ' primary' : label === '−1 recuerdo' ? ' correction' : '');
      button.textContent = busy.has(guest.id) ? 'Guardando…' : label;
      button.setAttribute('aria-label', label + ' para ' + guest.nombre);
      button.disabled = busy.size > 0 || loading || quantity < 0 || quantity > total || quantity === guest.cantidad_entregada;
      button.addEventListener('click', () => toggle(guest, quantity));
      actions.append(button);
    }
    row.append(avatar, info, actions); $('list').append(row);
  }
  if (!visible.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = loading ? 'Cargando grupos…' : guests.length ? 'No hay grupos con este filtro.' : 'Todavía no hay grupos en la lista.'; $('list').append(empty); }
  $('result-count').textContent = `${visible.length} de ${guests.length} grupos`;
}
async function refresh() {
  if (loading || busy.size) return;
  loading = true; $('refresh').disabled = true; $('message').textContent = 'Cargando grupos…'; render();
  try { guests = await api('/api/invitados'); $('message').textContent = ''; }
  catch (error) { $('message').textContent = error.message; }
  finally { loading = false; $('refresh').disabled = false; render(); }
}
async function toggle(guest, quantity) {
  if (quantity < guest.cantidad_entregada && !confirm(`¿Reducir la entrega de ${guest.nombre} a ${quantity} recuerdos?`)) return;
  busy.add(guest.id); render(); $('message').textContent = '';
  try {
    const updated = await api(`/api/invitados/${guest.id}`, { method: 'PATCH', body: JSON.stringify({ cantidad_entregada: quantity, expected: guest.cantidad_entregada }) });
    guests = guests.map(g => g.id === guest.id ? updated : g);
    $('message').textContent = `${guest.nombre}: ${updated.cantidad_entregada} de ${updated.adultos + updated.ninos} recuerdos entregados.`;
  } catch (error) { $('message').textContent = error.message; }
  finally { busy.delete(guest.id); render(); }
}
$('search').addEventListener('input', render);
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); render(); }));
$('refresh').addEventListener('click', refresh);
(async () => { try { const config = await api('/api/config'); $('demo').hidden = !config.demo; await refresh(); } catch { $('message').textContent = 'No pudimos conectar. Usa Actualizar para reintentar.'; } })();
