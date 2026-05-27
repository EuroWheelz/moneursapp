-- ============================================================
-- EuroWheelz Plansysteem — Supabase Schema
-- Uitvoeren in: Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- Extensies
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELLEN (volgorde op basis van foreign key afhankelijkheden)
-- ============================================================

CREATE TABLE IF NOT EXISTS monteurs (
  id             TEXT PRIMARY KEY,
  naam           TEXT NOT NULL,
  voornaam       TEXT NOT NULL,
  email          TEXT UNIQUE NOT NULL,
  bus_capaciteit INTEGER DEFAULT 8,
  van_huis       BOOLEAN DEFAULT true,
  huisadres      TEXT DEFAULT '',
  huisadres_lat  NUMERIC,
  huisadres_lng  NUMERIC,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relaties (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crediteurnummer          TEXT UNIQUE,
  naam                     TEXT NOT NULL,
  type                     TEXT NOT NULL DEFAULT 'consignatie',
  status                   TEXT NOT NULL DEFAULT 'actief',
  land                     TEXT NOT NULL DEFAULT 'NL',
  adres                    TEXT DEFAULT '',
  postcode                 TEXT DEFAULT '',
  plaats                   TEXT DEFAULT '',
  lat                      NUMERIC,
  lng                      NUMERIC,
  telefoon                 TEXT DEFAULT '',
  email                    TEXT DEFAULT '',
  contactpersoon           TEXT DEFAULT '',
  echopers                 INTEGER DEFAULT 0,
  accus                    INTEGER DEFAULT 0,
  openingstijden           TEXT DEFAULT '',
  winterstalling_van       TEXT DEFAULT '',
  winterstalling_tot       TEXT DEFAULT '',
  mail_werkbon             BOOLEAN DEFAULT true,
  mail_afspraakbevestiging BOOLEAN DEFAULT true,
  mail_nieuwsbrief         BOOLEAN DEFAULT false,
  onvolledig               BOOLEAN DEFAULT false,
  notitie                  TEXT DEFAULT '',
  deleted_at               TIMESTAMPTZ DEFAULT NULL,
  gesloten_dagen           INTEGER[] DEFAULT '{}',
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contactpersonen (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relatie_id               UUID REFERENCES relaties(id) ON DELETE CASCADE,
  naam                     TEXT NOT NULL,
  functie                  TEXT DEFAULT '',
  email                    TEXT DEFAULT '',
  telefoon                 TEXT DEFAULT '',
  mail_werkbon             BOOLEAN DEFAULT true,
  mail_afspraakbevestiging BOOLEAN DEFAULT true,
  created_at               TIMESTAMPTZ DEFAULT NOW()
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
  monteur_id      TEXT REFERENCES monteurs(id) ON DELETE SET NULL,
  sleutel_ophalen BOOLEAN DEFAULT false,
  km_gereden      NUMERIC,
  tijd_start      TIME,
  tijd_eind       TIME,
  tijd_vastzetten      BOOLEAN DEFAULT false,
  vervolg_verzoek      BOOLEAN DEFAULT false,
  vervolg_beschrijving TEXT DEFAULT '',
  aantal_voertuigen    INTEGER DEFAULT 1,
  type_detail          TEXT DEFAULT '',
  crediteurnummer      TEXT DEFAULT '',
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voertuigen (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opdracht_id       TEXT REFERENCES opdrachten(id) ON DELETE CASCADE,
  relatie_id        UUID REFERENCES relaties(id),
  kenteken          TEXT NOT NULL,
  kleur             TEXT,
  model             TEXT DEFAULT '',
  uitvoering        TEXT DEFAULT '',
  tenaamstelling    TEXT DEFAULT '',
  barcode           TEXT DEFAULT '',
  meldcode          TEXT DEFAULT '',
  object_status     TEXT DEFAULT 'Operationeel',
  probleem          TEXT,
  gedaan            TEXT,
  laatste_onderhoud DATE,
  volgend_onderhoud DATE,
  opmerking         TEXT DEFAULT '',
  actief            BOOLEAN DEFAULT true,
  contract_type     TEXT DEFAULT '',
  begindatum        DATE,
  einddatum         DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS onderdelen (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  naam        TEXT NOT NULL,
  categorie   TEXT NOT NULL DEFAULT 'Algemeen',
  artikelcode TEXT DEFAULT '',
  prijs       NUMERIC,
  vestiging   TEXT DEFAULT '',
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
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opdracht_id      TEXT REFERENCES opdrachten(id),
  monteur_id       TEXT REFERENCES monteurs(id),
  locatie          TEXT NOT NULL,
  neerzet_kenteken TEXT,
  meeneem_kenteken TEXT,
  meeneem_naar     TEXT,
  status           TEXT NOT NULL DEFAULT 'ingediend',
  notitie          TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS foto_meldingen (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opdracht_id              TEXT REFERENCES opdrachten(id),
  monteur_id               TEXT,
  locatie                  TEXT NOT NULL,
  foto_url                 TEXT,
  gedetecteerde_kentekens  TEXT[] DEFAULT '{}',
  bekende_kentekens        TEXT[] DEFAULT '{}',
  afwijkingen              TEXT[] DEFAULT '{}',
  status                   TEXT DEFAULT 'nieuw',
  created_at               TIMESTAMPTZ DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS accu_inventaris (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relatie_id UUID REFERENCES relaties(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  aantal     INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(relatie_id, type)
);

CREATE TABLE IF NOT EXISTS promotiemateriaal (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relatie_id UUID REFERENCES relaties(id) ON DELETE CASCADE,
  naam       TEXT NOT NULL,
  aantal     INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MIGRATIES — veilig herhalen op bestaande DB
-- ============================================================

ALTER TABLE voertuigen ADD COLUMN IF NOT EXISTS relatie_id        UUID REFERENCES relaties(id);
ALTER TABLE voertuigen ADD COLUMN IF NOT EXISTS model             TEXT DEFAULT '';
ALTER TABLE voertuigen ADD COLUMN IF NOT EXISTS uitvoering        TEXT DEFAULT '';
ALTER TABLE voertuigen ADD COLUMN IF NOT EXISTS tenaamstelling    TEXT DEFAULT '';
ALTER TABLE voertuigen ADD COLUMN IF NOT EXISTS barcode           TEXT DEFAULT '';
ALTER TABLE voertuigen ADD COLUMN IF NOT EXISTS meldcode          TEXT DEFAULT '';
ALTER TABLE voertuigen ADD COLUMN IF NOT EXISTS object_status     TEXT DEFAULT 'Operationeel';
ALTER TABLE voertuigen ADD COLUMN IF NOT EXISTS gedaan            TEXT;
ALTER TABLE voertuigen ADD COLUMN IF NOT EXISTS laatste_onderhoud DATE;
ALTER TABLE voertuigen ADD COLUMN IF NOT EXISTS volgend_onderhoud DATE;
ALTER TABLE voertuigen ADD COLUMN IF NOT EXISTS opmerking         TEXT DEFAULT '';
ALTER TABLE voertuigen ADD COLUMN IF NOT EXISTS actief            BOOLEAN DEFAULT true;
ALTER TABLE voertuigen ADD COLUMN IF NOT EXISTS contract_type     TEXT DEFAULT '';
ALTER TABLE voertuigen ADD COLUMN IF NOT EXISTS begindatum        DATE;
ALTER TABLE voertuigen ADD COLUMN IF NOT EXISTS einddatum         DATE;
ALTER TABLE voertuigen ADD COLUMN IF NOT EXISTS created_at        TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE onderdelen ADD COLUMN IF NOT EXISTS artikelcode TEXT DEFAULT '';
ALTER TABLE onderdelen ADD COLUMN IF NOT EXISTS prijs       NUMERIC;
ALTER TABLE onderdelen ADD COLUMN IF NOT EXISTS vestiging   TEXT DEFAULT '';

ALTER TABLE relaties ADD COLUMN IF NOT EXISTS onvolledig     BOOLEAN DEFAULT false;
ALTER TABLE relaties ADD COLUMN IF NOT EXISTS notitie        TEXT DEFAULT '';
ALTER TABLE relaties ADD COLUMN IF NOT EXISTS deleted_at     TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE relaties ADD COLUMN IF NOT EXISTS gesloten_dagen INTEGER[] DEFAULT '{}';

ALTER TABLE monteurs   ADD COLUMN IF NOT EXISTS huisadres     TEXT DEFAULT '';
ALTER TABLE monteurs   ADD COLUMN IF NOT EXISTS huisadres_lat NUMERIC;
ALTER TABLE monteurs   ADD COLUMN IF NOT EXISTS huisadres_lng NUMERIC;

ALTER TABLE opdrachten ADD COLUMN IF NOT EXISTS vervolg_verzoek      BOOLEAN DEFAULT false;
ALTER TABLE opdrachten ADD COLUMN IF NOT EXISTS vervolg_beschrijving TEXT DEFAULT '';
ALTER TABLE opdrachten ADD COLUMN IF NOT EXISTS aantal_voertuigen    INTEGER DEFAULT 1;
ALTER TABLE opdrachten ADD COLUMN IF NOT EXISTS type_detail          TEXT DEFAULT '';
ALTER TABLE opdrachten ADD COLUMN IF NOT EXISTS crediteurnummer      TEXT DEFAULT '';

-- ============================================================
-- RLS UITGESCHAKELD (development — in productie policies toevoegen)
-- ============================================================

ALTER TABLE monteurs          DISABLE ROW LEVEL SECURITY;
ALTER TABLE relaties          DISABLE ROW LEVEL SECURITY;
ALTER TABLE contactpersonen   DISABLE ROW LEVEL SECURITY;
ALTER TABLE opdrachten        DISABLE ROW LEVEL SECURITY;
ALTER TABLE voertuigen        DISABLE ROW LEVEL SECURITY;
ALTER TABLE onderdelen        DISABLE ROW LEVEL SECURITY;
ALTER TABLE opdracht_onderdelen DISABLE ROW LEVEL SECURITY;
ALTER TABLE verplaats_verzoeken DISABLE ROW LEVEL SECURITY;
ALTER TABLE foto_meldingen    DISABLE ROW LEVEL SECURITY;
ALTER TABLE pech_stops        DISABLE ROW LEVEL SECURITY;
ALTER TABLE accu_inventaris   DISABLE ROW LEVEL SECURITY;
ALTER TABLE promotiemateriaal DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- REALTIME INSCHAKELEN
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'opdrachten'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE opdrachten;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'voertuigen'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE voertuigen;
  END IF;
END $$;

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO monteurs (id, naam, voornaam, email, bus_capaciteit, van_huis)
VALUES ('m1', 'Jan Bakker', 'Jan', 'jan@eurowheelz.nl', 8, true)
ON CONFLICT (id) DO NOTHING;

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

INSERT INTO opdrachten (id, type, status, locatie, adres, postcode, stad, datum, prioriteit, urgent, notitie, contactpersoon, telefoon, route_volgorde, monteur_id)
VALUES ('OP-1061', 'reparatie', 'ingepland', 'Vakantiepark De Koog', 'Rommelpot 8', '1796 AZ', 'De Koog', CURRENT_DATE, 2, true, 'EW-0002-C heeft kapot achterlicht na valpartij.', 'Mark Visser', '+31 6 8765 4321', 2, 'm1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO voertuigen (opdracht_id, kenteken, kleur) VALUES
  ('OP-1061', 'EW-0002-C', '#E63946');

INSERT INTO opdrachten (id, type, status, locatie, adres, postcode, stad, datum, prioriteit, urgent, notitie, contactpersoon, telefoon, route_volgorde, monteur_id)
VALUES ('OP-1064', 'accu', 'ingepland', 'Hotelpark Julianadorp', 'Zandweg 22', '1787 PK', 'Julianadorp', CURRENT_DATE, 3, false, 'Upgrade van 8× 20Ah naar 6× 30Ah. Oude accu''s meenemen terug naar loods.', 'Petra van Dam', '+31 6 5555 1234', 3, 'm1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO opdrachten (id, type, status, locatie, adres, postcode, stad, datum, prioriteit, urgent, notitie, contactpersoon, telefoon, route_volgorde, monteur_id, sleutel_ophalen)
VALUES ('OP-1063', 'pechhulp', 'ingepland', 'Camping Les Dunes', 'Duinweg 4', '8670', 'Koksijde (BE)', CURRENT_DATE, 1, true, 'Twee gestrande gasten. Sleutel ophalen op camping.', 'Camping reception', '+32 58 123 456', 4, 'm1', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pech_stops (id, opdracht_id, adres, lat, lng, pech_type, notitie) VALUES
  ('ps1', 'OP-1063', 'Duinpad 12, Koksijde', 51.1023, 2.6497, 'lege_accu', 'Gast staat bij het pad richting zee.'),
  ('ps2', 'OP-1063', 'Strandboulevard 88, Koksijde', 51.0989, 2.6521, 'lekke_band', 'Gast staat bij het strandhuis.')
ON CONFLICT (id) DO NOTHING;
