import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  'https://cqtpscaefqxntopxyrnr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxdHBzY2FlZnF4bnRvcHh5cm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTc3MzcsImV4cCI6MjA5MjIzMzczN30.td6xhrq2ik59CGkceE13dVyikUAysNfD1Y1g2AyWxCQ'
);

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(req: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const body = await req.json();
    const { base64, mediaType, locatie, bekende_kentekens, opdracht_id, monteur_id, foto_url } = body as {
      base64: string;
      mediaType: string;
      locatie: string;
      bekende_kentekens: string[];
      opdracht_id: string;
      monteur_id: string;
      foto_url?: string;
    };

    if (!base64 || !locatie) {
      return NextResponse.json({ error: 'base64 en locatie zijn verplicht' }, { status: 400, headers });
    }

    // Claude vision: detect kentekens in the photo
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: (mediaType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Je bent een expert in het herkennen van e-bike en e-chopper kentekens.
Analyseer deze foto en geef ALLEEN een JSON array terug met alle kentekens die zichtbaar zijn.
Kenteken formaat is meestal: EW-XXXX-X (bijv. EW-0001-A) maar kan ook anders zijn.
Als er geen kentekens zichtbaar zijn, geef dan een lege array terug.
Geef ALLEEN de JSON array terug, geen andere tekst.
Voorbeeld output: ["EW-0001-A", "EW-0002-B"]`,
            },
          ],
        },
      ],
    });

    let gedetecteerd: string[] = [];
    const rawText = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]';
    try {
      const match = rawText.match(/\[.*\]/s);
      gedetecteerd = match ? JSON.parse(match[0]) : [];
    } catch {
      gedetecteerd = [];
    }

    // Bereken afwijkingen: kentekens op foto die NIET bekend zijn bij deze locatie
    const bekendeSet = new Set(bekende_kentekens.map((k) => k.toUpperCase()));
    const afwijkingen = gedetecteerd.filter((k) => !bekendeSet.has(k.toUpperCase()));

    // Sla op in foto_meldingen (altijd, ook zonder afwijkingen)
    await supabase.from('foto_meldingen').insert({
      opdracht_id: opdracht_id || null,
      monteur_id: monteur_id || null,
      locatie,
      foto_url: foto_url || null,
      gedetecteerde_kentekens: gedetecteerd,
      bekende_kentekens,
      afwijkingen,
      status: afwijkingen.length > 0 ? 'afwijking' : 'ok',
    });

    return NextResponse.json({
      gedetecteerd,
      afwijkingen,
      heeftAfwijkingen: afwijkingen.length > 0,
    }, { headers });
  } catch (err: any) {
    console.error('[kenteken-detectie]', err);
    return NextResponse.json(
      { error: err.message ?? 'Analysefout', gedetecteerd: [], afwijkingen: [], heeftAfwijkingen: false },
      { status: 500, headers }
    );
  }
}
