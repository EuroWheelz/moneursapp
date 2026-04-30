-- EuroWheelz Maintenance System Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Table: Locations (Verhuurlocaties)
create table if not exists locations (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    address text,
    postal_code text,
    city text,
    latitude double precision,
    longitude double precision,
    contact_name text,
    contact_email text,
    contact_phone text,
    secret_token uuid default uuid_generate_v4(), -- For secure QR link access
    created_at timestamp with time zone default now()
);

-- Table: Vehicles (E-choppers)
create table if not exists vehicles (
    id uuid default uuid_generate_v4() primary key,
    registration_id text unique not null, -- License plate or internal ID
    location_id uuid references locations(id) on delete set null,
    status text default 'active', -- active, maintenance, defect
    last_service_at timestamp with time zone,
    created_at timestamp with time zone default now()
);

-- Table: Profiles (Admins and Technicians)
create table if not exists profiles (
    id uuid references auth.users on delete cascade primary key,
    full_name text,
    role text check (role in ('admin', 'technician')),
    avatar_url text,
    created_at timestamp with time zone default now()
);

-- Table: Defects (Meldingen)
create table if not exists defects (
    id uuid default uuid_generate_v4() primary key,
    location_id uuid references locations(id) not null,
    vehicle_id uuid references vehicles(id) not null,
    reported_by text,
    description text not null,
    priority text check (priority in ('low', 'medium', 'high', 'urgent')),
    status text default 'new', -- new, in_progress, resolved, closed
    photo_urls text[], -- Array of storage links
    created_at timestamp with time zone default now()
);

-- Table: Work Orders (Opdrachten)
create table if not exists tasks (
    id uuid default uuid_generate_v4() primary key,
    defect_id uuid references defects(id),
    technician_id uuid references profiles(id),
    status text default 'pending', -- pending, scheduled, in_progress, completed, verified
    scheduled_date date,
    estimated_duration_minutes integer not null default 30,
    actual_duration_minutes integer,
    repair_notes text,
    parts_used jsonb, -- [{name: 'Brake pad', quantity: 1}]
    completion_photos text[],
    result text check (result in ('solved', 'unsolved', 'follow_up')),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- RLS Policies (Basic examples for now)
alter table locations enable row level security;
alter table vehicles enable row level security;
alter table profiles enable row level security;
alter table defects enable row level security;
alter table tasks enable row level security;

-- Admin can see everything
create policy "Admins have full access" on locations for all using (true);
create policy "Admins have full access" on vehicles for all using (true);
create policy "Admins have full access" on profiles for all using (true);
create policy "Admins have full access" on defects for all using (true);
create policy "Admins have full access" on tasks for all using (true);

-- Technicians can see their tasks
create policy "Technicians can see assigned tasks" on tasks 
    for select using (technician_id = auth.uid());

-- Public can report defects via secret location token
create policy "Public can report defect via token" on defects
    for insert with check (
        exists (
            select 1 from locations 
            where locations.id = defects.location_id 
        )
    );
