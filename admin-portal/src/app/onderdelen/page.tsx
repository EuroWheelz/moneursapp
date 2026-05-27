'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import type { DbOnderdeel, DbVerplaatsVerzoek } from '@/lib/supabase';
import {
  Plus, Trash2, Package, ArrowLeftRight, CheckCircle, XCircle, X, Upload, Pencil, Save, Loader2,
} from 'lucide-react';
import ImportOnderdelenModal from '@/components/ImportOnderdelenModal';


const CATEGORIEEN = ['Remmen', 'Verlichting', 'Accu', 'Aandrijving', 'Banden', 'Frame', 'Elektrisch', 'Algemeen'];

export default function OnderdelenPage() {
  const [tab, setTab] = useState<'onderdelen' | 'verzoeken'>('onderdelen');
  const [onderdelen, setOnderdelen] = useState<DbOnderdeel[]>([]);
  const [verzoeken, setVerzoeken] = useState<DbVerplaatsVerzoek[]>([]);
  const [monteurMap, setMonteurMap] = useState<Record<string, string>>({});
  const [laden, setLaden] = useState(true);
  const [showToevoegen, setShowToevoegen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [nieuwNaam, setNieuwNaam] = useState('');
  const [nieuwCategorie, setNieuwCategorie] = useState('Algemeen');
  const [opslaan, setOpslaan] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<DbOnderdeel>>({});
  const [editBezig, setEditBezig] = useState(false);

  useEffect(() => {
    supabase.from('monteurs').select('id, naam, voornaam').then(({ data }) => {
      const map: Record<string, string> = {};
      (data ?? []).forEach((m: any) => { map[m.id] = `${m.voornaam} ${m.naam}`; });
      setMonteurMap(map);
    });
  }, []);

  useEffect(() => {
    laadData();
  }, [tab]);

  async function laadData() {
    setLaden(true);
    if (tab === 'onderdelen') {
      const { data } = await supabase
        .from('onderdelen')
        .select('*')
        .order('categorie')
        .order('naam');
      setOnderdelen((data ?? []) as DbOnderdeel[]);
    } else {
      const { data } = await supabase
        .from('verplaats_verzoeken')
        .select('*')
        .order('created_at', { ascending: false });
      setVerzoeken((data ?? []) as DbVerplaatsVerzoek[]);
    }
    setLaden(false);
  }

  async function voegToe() {
    if (!nieuwNaam.trim()) return;
    setOpslaan(true);
    const { data } = await supabase
      .from('onderdelen')
      .insert({ naam: nieuwNaam.trim(), categorie: nieuwCategorie })
      .select()
      .single();
    if (data) {
      setOnderdelen((p) => [...p, data as DbOnderdeel].sort((a, b) =>
        a.categorie.localeCompare(b.categorie) || a.naam.localeCompare(b.naam)
      ));
      setNieuwNaam('');
      setShowToevoegen(false);
    }
    setOpslaan(false);
  }

  async function toggleActief(id: string, actief: boolean) {
    await supabase.from('onderdelen').update({ actief: !actief }).eq('id', id);
    setOnderdelen((p) => p.map((o) => o.id === id ? { ...o, actief: !actief } : o));
  }

  async function verwijder(id: string) {
    await supabase.from('onderdelen').delete().eq('id', id);
    setOnderdelen((p) => p.filter((o) => o.id !== id));
  }

  function startEdit(o: DbOnderdeel) {
    setEditId(o.id);
    setEditData({ naam: o.naam, artikelcode: o.artikelcode ?? '', prijs: o.prijs, vestiging: o.vestiging ?? '', categorie: o.categorie, actief: o.actief });
  }

  async function slaOpEdit() {
    if (!editId) return;
    setEditBezig(true);
    const updates = {
      naam: editData.naam?.trim() || '',
      artikelcode: editData.artikelcode?.trim() ?? '',
      prijs: editData.prijs ?? null,
      vestiging: editData.vestiging?.trim() ?? '',
      categorie: editData.categorie ?? 'Algemeen',
      actief: editData.actief ?? true,
    };
    const { error } = await supabase.from('onderdelen').update(updates).eq('id', editId);
    if (!error) {
      setOnderdelen((p) =>
        p.map((o) => o.id === editId ? { ...o, ...updates } : o)
          .sort((a, b) => a.categorie.localeCompare(b.categorie) || a.naam.localeCompare(b.naam))
      );
      setEditId(null);
    }
    setEditBezig(false);
  }

  async function behandelVerzoek(id: string, status: 'goedgekeurd' | 'afgewezen') {
    await supabase.from('verplaats_verzoeken').update({ status }).eq('id', id);
    setVerzoeken((p) => p.map((v) => v.id === id ? { ...v, status } : v));
  }

  const groepenMap: Record<string, DbOnderdeel[]> = {};
  onderdelen.forEach((o) => {
    if (!groepenMap[o.categorie]) groepenMap[o.categorie] = [];
    groepenMap[o.categorie].push(o);
  });

  const aantalIngediend = verzoeken.filter((v) => v.status === 'ingediend').length;

  return (
    <DashboardLayout title="Onderdelen & Verzoeken">
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('onderdelen')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === 'onderdelen' ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Package className="w-4 h-4" />
          Onderdelen
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'onderdelen' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
            {onderdelen.length}
          </span>
        </button>
        <button
          onClick={() => setTab('verzoeken')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === 'verzoeken' ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          Verplaats verzoeken
          {aantalIngediend > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              tab === 'verzoeken' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
            }`}>
              {aantalIngediend}
            </span>
          )}
        </button>
      </div>

      {tab === 'onderdelen' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <p className="text-sm font-bold text-gray-800">Onderdelen catalogus</p>
              <p className="text-xs text-gray-400 mt-0.5">Beschikbaar voor monteurs bij het afwikkelen van opdrachten</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm"
              >
                <Upload className="w-3.5 h-3.5 text-gray-400" />
                Importeren
              </button>
              <button
                onClick={() => setShowToevoegen(!showToevoegen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Toevoegen
              </button>
            </div>
          </div>

          {/* Toevoegen formulier */}
          {showToevoegen && (
            <div className="px-5 py-4 bg-amber-50/60 border-b border-amber-100 flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Naam *</label>
                <input
                  type="text"
                  value={nieuwNaam}
                  onChange={(e) => setNieuwNaam(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') voegToe(); }}
                  placeholder="bijv. Remblok voor"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </div>
              <div className="w-44">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Categorie</label>
                <select
                  value={nieuwCategorie}
                  onChange={(e) => setNieuwCategorie(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none"
                >
                  {CATEGORIEEN.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button
                onClick={voegToe}
                disabled={opslaan || !nieuwNaam.trim()}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {opslaan ? '...' : 'Opslaan'}
              </button>
              <button
                onClick={() => { setShowToevoegen(false); setNieuwNaam(''); }}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          )}

          {/* Lijst */}
          {laden ? (
            <div className="py-16 text-center text-sm text-gray-400">Laden...</div>
          ) : onderdelen.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400">Nog geen onderdelen toegevoegd</p>
              <p className="text-xs text-gray-300 mt-1">Klik op &quot;Toevoegen&quot; om te beginnen</p>
            </div>
          ) : (
            <div>
              {Object.entries(groepenMap).map(([categorie, items]) => (
                <div key={categorie}>
                  <div className="px-5 py-2 bg-gray-50/70 border-b border-t border-gray-100">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{categorie}</p>
                  </div>
                  {items.map((o) => (
                    <div key={o.id} className="border-b border-gray-50">
                      {editId === o.id ? (
                        /* ── Bewerkregel ── */
                        <div className="px-5 py-3 bg-primary/5 border-l-2 border-primary space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Naam *</label>
                              <input
                                autoFocus
                                value={editData.naam ?? ''}
                                onChange={(e) => setEditData((p) => ({ ...p, naam: e.target.value }))}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Artikelcode</label>
                              <input
                                value={editData.artikelcode ?? ''}
                                onChange={(e) => setEditData((p) => ({ ...p, artikelcode: e.target.value }))}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Prijs (€)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editData.prijs ?? ''}
                                onChange={(e) => setEditData((p) => ({ ...p, prijs: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Vestiging</label>
                              <input
                                value={editData.vestiging ?? ''}
                                onChange={(e) => setEditData((p) => ({ ...p, vestiging: e.target.value }))}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Categorie</label>
                              <select
                                value={editData.categorie ?? 'Algemeen'}
                                onChange={(e) => setEditData((p) => ({ ...p, categorie: e.target.value }))}
                                className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none bg-white"
                              >
                                {CATEGORIEEN.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer mt-4">
                              <input
                                type="checkbox"
                                checked={editData.actief ?? true}
                                onChange={(e) => setEditData((p) => ({ ...p, actief: e.target.checked }))}
                                className="w-4 h-4 accent-primary"
                              />
                              <span className="text-sm text-gray-600">Actief</span>
                            </label>
                            <div className="flex gap-2 mt-4 ml-auto">
                              <button
                                onClick={() => setEditId(null)}
                                className="px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                              >
                                Annuleren
                              </button>
                              <button
                                onClick={slaOpEdit}
                                disabled={editBezig || !editData.naam?.trim()}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
                              >
                                {editBezig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Opslaan
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* ── Normale rij ── */
                        <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 group transition-colors">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${o.actief ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className={`flex-1 text-sm font-medium ${o.actief ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                            {o.naam}
                          </span>
                          {o.artikelcode && (
                            <span className="font-mono text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{o.artikelcode}</span>
                          )}
                          {o.prijs != null && (
                            <span className="text-xs text-gray-500 w-16 text-right">€ {Number(o.prijs).toFixed(2)}</span>
                          )}
                          {o.vestiging && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{o.vestiging}</span>
                          )}
                          <button
                            onClick={() => startEdit(o)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-primary/10 rounded-lg transition-all"
                            title="Bewerken"
                          >
                            <Pencil className="w-3.5 h-3.5 text-primary" />
                          </button>
                          <button
                            onClick={() => verwijder(o.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded-lg transition-all"
                            title="Verwijderen"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Verplaats verzoeken tab ─── */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-800">Verplaats verzoeken</p>
            <p className="text-xs text-gray-400 mt-0.5">Ingediend door monteurs — keur goed of wijs af</p>
          </div>

          {laden ? (
            <div className="py-16 text-center text-sm text-gray-400">Laden...</div>
          ) : verzoeken.length === 0 ? (
            <div className="py-16 text-center">
              <ArrowLeftRight className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400">Geen verplaats verzoeken</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {verzoeken.map((v) => (
                <div key={v.id} className="px-5 py-4 flex items-start gap-4">
                  <div className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    v.status === 'ingediend' ? 'bg-amber-400' :
                    v.status === 'goedgekeurd' ? 'bg-green-500' : 'bg-red-400'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{v.locatie}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        v.status === 'ingediend' ? 'bg-amber-100 text-amber-700' :
                        v.status === 'goedgekeurd' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      {v.neerzet_kenteken && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Neerzetten</span>
                          <span className="text-[11px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded font-mono font-semibold">
                            {v.neerzet_kenteken}
                          </span>
                        </div>
                      )}
                      {v.meeneem_kenteken && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Meenemen</span>
                          <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-mono font-semibold">
                            {v.meeneem_kenteken}
                          </span>
                          {v.meeneem_naar && (
                            <>
                              <ArrowLeftRight className="w-3 h-3 text-gray-400" />
                              <span className="text-[11px] text-gray-600 font-medium">{v.meeneem_naar}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                      <span className="font-medium text-gray-500">
                        {v.monteur_id ? (monteurMap[v.monteur_id] ?? v.monteur_id) : '—'}
                      </span>
                      <span>·</span>
                      <span>{new Date(v.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      {v.opdracht_id && (
                        <>
                          <span>·</span>
                          <span className="font-mono">{v.opdracht_id}</span>
                        </>
                      )}
                    </div>
                    {v.notitie && (
                      <p className="text-xs text-gray-500 mt-1.5 italic bg-gray-50 rounded px-2 py-1">{v.notitie}</p>
                    )}
                  </div>

                  {v.status === 'ingediend' && (
                    <div className="flex gap-2 flex-shrink-0 pt-0.5">
                      <button
                        onClick={() => behandelVerzoek(v.id, 'goedgekeurd')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Goedkeuren
                      </button>
                      <button
                        onClick={() => behandelVerzoek(v.id, 'afgewezen')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Afwijzen
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {showImport && (
        <ImportOnderdelenModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); laadData(); }}
        />
      )}
    </DashboardLayout>
  );
}
