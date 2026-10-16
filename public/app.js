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
  for (const tipo of ['adultos', 'ninos']) {
    const needed = guests.reduce((sum, g) => sum + g[tipo], 0);
    const delivered = guests.reduce((sum, g) => sum + g[tipo + '_entregados'], 0);
    $(tipo + '-total').textContent = needed;
    $(tipo + '-detail').textContent = `${delivered} entregados · ${needed - delivered} pendientes`;
  }
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
    const deliveries = document.createElement('div'); deliveries.className = 'gift-types';
    for (const [tipo, title] of [['adultos', 'Adultos'], ['ninos', 'Niños']]) {
      const panel = document.createElement('section'); panel.className = 'gift-type ' + tipo;
      panel.setAttribute('aria-label', 'Regalos para ' + title.toLowerCase() + ' de ' + guest.nombre);
      const heading = document.createElement('strong'); heading.textContent = 'Regalos para ' + title.toLowerCase();
      const count = document.createElement('p'); count.className = 'type-count';
      const delivered = guest[tipo + '_entregados'];
      count.textContent = guest[tipo] ? delivered + ' de ' + guest[tipo] + ' entregados · Faltan ' + (guest[tipo] - delivered) : 'No hay ' + title.toLowerCase() + ' en este grupo';
      panel.append(heading, count);
      if (guest[tipo] > 0) {
        const actions = document.createElement('div'); actions.className = 'delivery-actions';
        for (const [label, quantity] of [['+1 regalo', delivered + 1], ['Completar', guest[tipo]], ['−1 regalo', delivered - 1]]) {
          const button = document.createElement('button'); button.className = 'delivery' + (label === '+1 regalo' ? ' primary' : label === '−1 regalo' ? ' correction' : '');
          button.textContent = busy.has(guest.id) ? 'Guardando…' : label;
          button.setAttribute('aria-label', label + ' para ' + title.toLowerCase() + ' de ' + guest.nombre);
          button.disabled = busy.size > 0 || loading || quantity < 0 || quantity > guest[tipo] || quantity === delivered;
          button.addEventListener('click', () => toggle(guest, tipo, quantity));
          actions.append(button);
        }
        panel.append(actions);
      }
      deliveries.append(panel);
    }
    row.append(avatar, info, deliveries); $('list').append(row);
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
$('search').addEventListener('input', render);
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); render(); }));
$('refresh').addEventListener('click', refresh);
(async () => { try { const config = await api('/api/config'); $('demo').hidden = !config.demo; await refresh(); } catch { $('message').textContent = 'No pudimos conectar. Usa Actualizar para reintentar.'; } })();
