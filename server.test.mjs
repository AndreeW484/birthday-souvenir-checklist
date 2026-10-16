import { test } from 'node:test';
import assert from 'node:assert/strict';

test('demo: entrega, conflicto, deshacer y archivos privados', async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  const { server } = await import('./server.mjs');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const guests = await (await fetch(`${base}/api/invitados`)).json();
    assert.equal(guests.length, 4);
    assert.equal(guests.reduce((s,g)=>s+g.adultos,0), 7);
    assert.equal(guests.reduce((s,g)=>s+g.ninos,0), 2);
    const patch = data => fetch(`${base}/api/invitados/1`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    assert.equal((await patch({ cantidad_entregada: 1 })).status, 400);
    const delivered = await (await patch({ cantidad_entregada: 1, expected: 0 })).json();
    assert.equal(delivered.entregado_por, null);
    assert.equal(delivered.entregado, true);
    assert.ok(Date.parse(delivered.fecha_entrega));
    assert.equal((await patch({ cantidad_entregada: 1, expected: 0, entregado_por: 'Otra persona' })).status, 409);
    const undone = await (await patch({ cantidad_entregada: 0, expected: 1 })).json();
    assert.equal(undone.fecha_entrega, null);
    assert.equal(undone.entregado_por, null);
    assert.equal((await fetch(`${base}/.env`)).status, 404);
    assert.equal((await fetch(`${base}/server.mjs`)).status, 404);
    assert.equal((await fetch(base)).status, 200);
    const groupPatch = data => fetch(base + '/api/invitados/4', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    assert.equal((await groupPatch({cantidad_entregada:4,expected:0})).status,400);
    assert.equal((await groupPatch({cantidad_entregada:-1,expected:0})).status,400);
    assert.equal((await groupPatch({cantidad_entregada:1.5,expected:0})).status,400);
    const partial = await (await groupPatch({cantidad_entregada:1,expected:0})).json();
    assert.equal(partial.entregado,false);
    assert.equal(partial.cantidad_entregada,1);
    assert.equal(partial.adultos + partial.ninos,3);
    assert.equal((await groupPatch({cantidad_entregada:3,expected:0})).status,409);
    const complete = await (await groupPatch({cantidad_entregada:3,expected:1})).json();
    assert.equal(complete.entregado,true);
    const corrected = await (await groupPatch({cantidad_entregada:2,expected:3})).json();
    assert.equal(corrected.entregado,false);
    assert.equal(corrected.cantidad_entregada,2);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
