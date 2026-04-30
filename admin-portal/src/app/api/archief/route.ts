import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export async function POST(req: NextRequest) {
  const { opdracht } = await req.json();

  const now = new Date();
  const mapNaam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dir = join(process.cwd(), 'archief', mapNaam);
  mkdirSync(dir, { recursive: true });

  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const bestandsnaam = `opdracht-${opdracht.id}-${timestamp}.json`;
  const pad = join(dir, bestandsnaam);

  writeFileSync(pad, JSON.stringify(opdracht, null, 2), 'utf-8');

  return NextResponse.json({ ok: true, bestand: `archief/${mapNaam}/${bestandsnaam}` });
}
