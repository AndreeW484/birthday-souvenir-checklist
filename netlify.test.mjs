import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from './netlify/functions/api.mjs';

test('Netlify: configuración, HTTPS, entregas y conflictos sin modificar Supabase', async () => {
  const oldUrl = process.env.SUPABASE_URL, oldKey = process.env.SUPABASE_SECRET_KEY;
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SECRET_KEY;
    assert.equal((await handler(new Request('https://fiesta.netlify.app/api/invitados'))).status, 503);
    process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_SECRET_KEY = 'test-secret';
    let row = { id: '9223372036854775806', nombre: 'Familia de prueba', adultos: 2, ninos: 1, cantidad_entregada: 0, adultos_entregados: 0, ninos_entregados: 0, entregado: false };
    globalThis.fetch = async (input, options) => {
      const url = new URL(input);
      assert.equal(options.headers.apikey, 'test-secret');
      if (options.method === 'PATCH') {
        assert.equal(url.searchParams.get('id'), 'eq.' + row.id);
        if (url.searchParams.get('adultos_entregados') !== 'eq.' + row.adultos_entregados || url.searchParams.get('ninos_entregados') !== 'eq.' + row.ninos_entregados) return Response.json([]);
        row = { ...row, ...JSON.parse(options.body) };
      }
      const result = url.searchParams.get('offset') === '1' ? [] : [row];
      return new Response(JSON.stringify(result).replace('"9223372036854775806"', '9223372036854775806'));
    };
    const list = await (await handler(new Request('https://fiesta.netlify.app/api/invitados'))).json();
    assert.equal(list[0].id, row.id);
    const patch = (body, origin = 'https://fiesta.netlify.app') => handler(new Request('https://fiesta.netlify.app/api/invitados/' + row.id, { method: 'PATCH', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
    assert.equal((await patch({tipo:'adultos', cantidad:1,expected_adultos:0, expected_ninos:0}, 'https://other.example')).status,403);
    assert.equal((await patch(null)).status,400);
    assert.equal((await patch({text:'x'.repeat(5000)})).status,413);
    const delivered = await (await patch({tipo:'adultos', cantidad:1,expected_adultos:0, expected_ninos:0})).json();
    assert.equal(delivered.cantidad_entregada,1);
    assert.equal(delivered.entregado,false);
    assert.equal(delivered.ninos_entregados,0);
    assert.equal((await patch({tipo:'adultos', cantidad:2,expected_adultos:0, expected_ninos:0})).status,409);
    assert.equal((await patch({tipo:'adultos', cantidad:4,expected_adultos:1, expected_ninos:0})).status,400);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});
