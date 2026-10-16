import initialGuests from './invitados.demo.json' with { type: 'json' };

const demo = initialGuests.map((guest, i) => ({ ...guest, id: String(i + 1), cantidad_entregada: 0, entregado: false, fecha_entrega: null, entregado_por: null }));
const columns = 'id,nombre,adultos,ninos,cantidad_entregada,entregado,fecha_entrega,entregado_por';
const json = (code, body) => Response.json(body, { status: code, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
async function supabase(query, options = {}) {
  const key = process.env.SUPABASE_SECRET_KEY;
  const response = await fetch(`${new URL(process.env.SUPABASE_URL).origin}/rest/v1/invitados?${query}`, { ...options, signal: AbortSignal.timeout(15000), headers: { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json', Prefer: 'return=representation', ...options.headers } });
  if (!response.ok) throw new Error('No pudimos consultar Supabase. Revisa la conexión, la tabla y los permisos.');
  // Preserve int8 values before JSON.parse can round them.
  return JSON.parse((await response.text()).replace(/("id"\s*:\s*)(-?\d+)/g, '$1"$2"'));
}
export async function handleApi(req, { allowDemo = true } = {}) {
  try {
    const url = new URL(req.url);
    const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
    if (!configured && !allowDemo) return json(503, { error: 'Falta configurar Supabase en Netlify.' });
    if (url.pathname === '/api/config' && req.method === 'GET') return json(200, { demo: !configured });
    if (url.pathname === '/api/invitados' && req.method === 'GET') {
      if (!configured) return json(200, demo);
      const rows = [];
      for (let offset = 0; ; ) {
        const page = await supabase(`select=${columns}&order=id.asc&limit=500&offset=${offset}`);
        rows.push(...page);
        if (!page.length) break;
        offset += page.length;
      }
      return json(200, rows);
    }
    const match = url.pathname.match(/^\/api\/invitados\/(-?\d+)$/);
    if (req.method === 'PATCH' && match) {
      if (req.headers.get('origin') && req.headers.get('origin') !== url.origin) return json(403, { error: 'Origen no permitido.' });
      let raw = '';
      if (req.body) {
        const reader = req.body.getReader();
        const decoder = new TextDecoder();
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 4096) { await reader.cancel(); return json(413, { error: 'Solicitud demasiado grande.' }); }
          raw += decoder.decode(value, { stream: true });
        }
        raw += decoder.decode();
      }
      let body;
      try { body = JSON.parse(raw); } catch { return json(400, { error: 'Solicitud inválida.' }); }
      if (!body || !Number.isSafeInteger(body.cantidad_entregada) || body.cantidad_entregada < 0 || !Number.isSafeInteger(body.expected) || body.expected < 0) return json(400, { error: 'Estado inválido.' });
      const current = configured
        ? (await supabase(`id=eq.${match[1]}&select=${columns}`))[0]
        : demo.find(row => row.id === match[1]);
      if (!current) return json(404, { error: 'Grupo no encontrado.' });
      if (body.cantidad_entregada > current.adultos + current.ninos) return json(400, { error: 'La cantidad supera las personas del grupo.' });
      const patch = { cantidad_entregada: body.cantidad_entregada, entregado: body.cantidad_entregada === current.adultos + current.ninos, fecha_entrega: body.cantidad_entregada ? new Date().toISOString() : null, entregado_por: null };
      let updated;
      if (configured) {
        [updated] = await supabase(`id=eq.${match[1]}&cantidad_entregada=eq.${body.expected}&select=${columns}`, { method: 'PATCH', body: JSON.stringify(patch) });
      } else if (current.cantidad_entregada === body.expected) {
        updated = Object.assign(current, patch);
      }
      if (!updated) return json(409, { error: 'Esta entrega cambió. Actualiza la lista e inténtalo de nuevo.' });
      return json(200, updated);
    }
    return json(404, { error: 'Ruta no encontrada.' });
  } catch { return json(502, { error: 'No pudimos completar la operación. Revisa tu conexión y la configuración de Supabase.' }); }
}
