-- ============================================================
-- EuroWheelz Plansysteem — Supabase Schema
-- Uitvoeren in: Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- Extensies
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELLEN
-- ============================================================

CREATE TABLE IF NOT EXISTS monteurs (
  id          TEXT PRIMARY KEY,
  naam        TEXT NOT NULL,
  voornaam    TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  bus_capaciteit INTEGER DEFAULT 8,
  van_huis    BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opdrachten (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'ingepland',
  locatie         TEXT NOT NULL,
  adres           TEXT NOT NULL,
  postcode        TEXT NOT NULL,
  stad            TEXT NOT NULL,
  datum           DATE,
  prioriteit      INTEGER DEFAULT 3,
  urgent          BOOLEAN DEFAULT false,
  deadline        DATE,
  notitie         TEXT DEFAULT '',
  contactpersoon  TEXT,
  telefoon        TEXT,
  route_volgorde  INTEGER DEFAULT 1,
  monteur_id      TEXT REFERENCES monteurs(id),
  sleutel_ophalen BOOLEAN DEFAULT false,
  km_gereden      NUMERIC,
  tijd_start      TIME,
  tijd_eind       TIME,
  tijd_vastzetten BOOLEAN DEFAULT false,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voertuigen (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opdracht_id TEXT REFERENCES opdrachten(id) ON DELETE CASCADE,
  kenteken    TEXT NOT NULL,
  kleur       TEXT DEFAULT '#345022',
  probleem    TEXT
);

CREATE TABLE IF NOT EXISTS onderdelen (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  naam        TEXT NOT NULL,
  categorie   TEXT NOT NULL DEFAULT 'Algemeen',
  actief      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opdracht_onderdelen (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opdracht_id  TEXT REFERENCES opdrachten(id) ON DELETE CASCADE,
  onderdeel_id UUID REFERENCES onderdelen(id),
  kenteken     TEXT,
  aantal       INTEGER DEFAULT 1,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verplaats_verzoeken (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opdracht_id       TEXT REFERENCES opdrachten(id),
  monteur_id        TEXT REFERENCES monteurs(id),
  locatie           TEXT NOT NULL,
  neerzet_kenteken  TEXT,
  meeneem_kenteken  TEXT,
  meeneem_naar      TEXT,
  status            TEXT NOT NULL DEFAULT 'ingediend',
  notitie           TEXT DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS foto_meldingen (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opdracht_id               TEXT REFERENCES opdrachten(id),
  monteur_id                TEXT,
  locatie                   TEXT NOT NULL,
  foto_url                  TEXT,
  gedetecteerde_kentekens   TEXT[] DEFAULT '{}',
  bekende_kentekens         TEXT[] DEFAULT '{}',
  afwijkingen               TEXT[] DEFAULT '{}',
  status                    TEXT DEFAULT 'nieuw',
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pech_stops (
  id          TEXT PRIMARY KEY,
  opdracht_id TEXT REFERENCES opdrachten(id) ON DELETE CASCADE,
  adres       TEXT NOT NULL,
  lat         NUMERIC,
  lng         NUMERIC,
  pech_type   TEXT,
  notitie     TEXT DEFAULT '',
  kenteken    TEXT,
  gevonden    BOOLEAN
);

-- ============================================================
-- RLS UITGESCHAKELD (development — in productie policies toevoegen)
-- ============================================================

ALTER TABLE monteurs    DISABLE ROW LEVEL SECURITY;
ALTER TABLE opdrachten  DISABLE ROW LEVEL SECURITY;
ALTER TABLE voertuigen  DISABLE ROW LEVEL SECURITY;
ALTER TABLE pech_stops  DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- REALTIME INSCHAKELEN
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE opdrachten;
ALTER PUBLICATION supabase_realtime ADD TABLE voertuigen;

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO monteurs (id, naam, voornaam, email, bus_capaciteit, van_huis)
VALUES ('m1', 'Jan Bakker', 'Jan', 'jan@eurowheelz.nl', 8, true)
ON CONFLICT (id) DO NOTHING;

-- Opdracht 1: Onderhoud Strandhotel
INSERT INTO opdrachten (id, type, status, locatie, adres, postcode, stad, datum, prioriteit, urgent, notitie, contactpersoon, telefoon, route_volgorde, monteur_id)
VALUES ('OP-1055', 'onderhoud', 'ingepland', 'Strandhotel Scheveningen', 'Gevers Deynootplein 30', '2586 CK', 'Scheveningen', CURRENT_DATE, 3, false, 'Toegang via zij-ingang. Vraag naar Lisa bij receptie.', 'Lisa de Groot', '+31 6 1234 5678', 1, 'm1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO voertuigen (opdracht_id, kenteken, kleur) VALUES
  ('OP-1055', 'EW-0001-A', '#E63946'),
  ('OP-1055', 'EW-0001-B', '#2A9D8F'),
  ('OP-1055', 'EW-0001-C', '#264653'),
  ('OP-1055', 'EW-0001-D', '#E9C46A'),
  ('OP-1055', 'EW-0001-E', '#F4A261'),
  ('OP-1055', 'EW-0001-F', '#E63946'),
  ('OP-1055', 'EW-0001-G', '#2A9D8F'),
  ('OP-1055', 'EW-0001-H', '#264653');

-- Opdracht 2: Reparatie Vakantiepark
INSERT INTO opdrachten (id, type, status, locatie, adres, postcode, stad, datum, prioriteit, urgent, deadline, notitie, contactpersoon, telefoon, route_volgorde, monteur_id)
VALUES ('OP-1061', 'reparatie', 'ingepland', 'Vakantiepark De Koog', 'Rommelpot 8', '1796 AZ', 'De Koog', CURRENT_DATE, 2, true, 'EW-0002-C heeft kapot achterlicht na valpartij. Klant heeft ook een scheurende zitting gemeld.', 'Mark Visser', '+31 6 8765 4321', 2, 'm1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO voertuigen (opdracht_id, kenteken, kleur) VALUES
  ('OP-1061', 'EW-0002-C', '#E63946');

-- Opdracht 3: Accu Julianadorp
INSERT INTO opdrachten (id, type, status, locatie, adres, postcode, stad, datum, prioriteit, urgent, notitie, contactpersoon, telefoon, route_volgorde, monteur_id)
VALUES ('OP-1064', 'accu', 'ingepland', 'Hotelpark Julianadorp', 'Zandweg 22', '1787 PK', 'Julianadorp', CURRENT_DATE, 3, false, 'Upgrade van 8× 20Ah naar 6× 30Ah. Oude accu''s meenemen terug naar loods.', 'Petra van Dam', '+31 6 5555 1234', 3, 'm1')
ON CONFLICT (id) DO NOTHING;

-- Opdracht 4: Pechhulp Koksijde
INSERT INTO opdrachten (id, type, status, locatie, adres, postcode, stad, datum, prioriteit, urgent, notitie, contactpersoon, telefoon, route_volgorde, monteur_id, sleutel_ophalen)
VALUES ('OP-1063', 'pechhulp', 'ingepland', 'Camping Les Dunes', 'Duinweg 4', '8670', 'Koksijde (BE)', CURRENT_DATE, 1, true, 'Twee gestrande gasten. Sleutel ophalen op camping.', 'Camping reception', '+32 58 123 456', 4, 'm1', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pech_stops (id, opdracht_id, adres, lat, lng, pech_type, notitie) VALUES
  ('ps1', 'OP-1063', 'Duinpad 12, Koksijde', 51.1023, 2.6497, 'lege_accu', 'Gast staat bij het pad richting zee.'),
  ('ps2', 'OP-1063', 'Strandboulevard 88, Koksijde', 51.0989, 2.6521, 'lekke_band', 'Gast staat bij het strandhuis.');
