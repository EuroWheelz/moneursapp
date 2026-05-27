// Finds and removes duplicate kentekens from voertuigen.
// Keep strategy: prefer record with relatie_id, then oldest created_at.

const SUPABASE_URL = 'https://cqtpscaefqxntopxyrnr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxdHBzY2FlZnF4bnRvcHh5cm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTc3MzcsImV4cCI6MjA5MjIzMzczN30.td6xhrq2ik59CGkceE13dVyikUAysNfD1Y1g2AyWxCQ';

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function fetchAll(path) {
  const PAGE = 1000;
  const all = [];
  let from = 0;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${path}&limit=${PAGE}&offset=${from}`,
      { headers }
    );
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function deleteIds(ids) {
  // Supabase REST: DELETE with in filter, batch of 500
  const BATCH = 500;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const inParam = `(${batch.map(id => `"${id}"`).join(',')})`;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/voertuigen?id=in.${inParam}`,
      { method: 'DELETE', headers }
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`DELETE fout (batch ${i}):`, body);
    }
  }
}

async function main() {
  console.log('Voertuigen ophalen...');
  const voertuigen = await fetchAll(
    'voertuigen?select=id,kenteken,relatie_id,created_at,model,barcode,meldcode,actief'
  );
  console.log(`${voertuigen.length} voertuigen geladen.`);

  // Group by kenteken
  const perKenteken = new Map();
  for (const v of voertuigen) {
    const key = v.kenteken?.trim().toUpperCase();
    if (!key) continue;
    if (!perKenteken.has(key)) perKenteken.set(key, []);
    perKenteken.get(key).push(v);
  }

  // Find duplicates
  const duplicaten = [...perKenteken.entries()].filter(([, rijen]) => rijen.length > 1);
  console.log(`\n${duplicaten.length} kentekens met duplicaten gevonden.\n`);

  if (duplicaten.length === 0) {
    console.log('Geen duplicaten — niets te doen.');
    return;
  }

  const teVerwijderen = [];

  for (const [kenteken, rijen] of duplicaten) {
    // Sort: records WITH relatie_id first, then by created_at ascending (oldest first)
    rijen.sort((a, b) => {
      const aHasRel = a.relatie_id != null ? 0 : 1;
      const bHasRel = b.relatie_id != null ? 0 : 1;
      if (aHasRel !== bHasRel) return aHasRel - bHasRel;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    const behouden = rijen[0];
    const verwijder = rijen.slice(1);

    console.log(`${kenteken} (${rijen.length}x):`);
    console.log(`  ✓ Behouden : id=${behouden.id} relatie=${behouden.relatie_id ?? '—'} aangemaakt=${behouden.created_at?.slice(0,10)}`);
    for (const v of verwijder) {
      console.log(`  ✗ Verwijder: id=${v.id} relatie=${v.relatie_id ?? '—'} aangemaakt=${v.created_at?.slice(0,10)}`);
      teVerwijderen.push(v.id);
    }
  }

  console.log(`\nTotaal te verwijderen: ${teVerwijderen.length} dubbele records.`);
  console.log('Verwijderen...');
  await deleteIds(teVerwijderen);
  console.log(`Klaar. ${teVerwijderen.length} duplicaten verwijderd.`);
}

main().catch(console.error);
