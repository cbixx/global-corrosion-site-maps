drop table if exists site_sources;
drop table if exists sources;
drop table if exists sites;

create table sites (
    id integer primary key autoincrement,
    site_id text unique not null,
    site_label text not null,
    site_type text,
    latitude real not null,
    longitude real not null,
    modern_country_location text,
    administering_country text,
    former_entity text,
    region_category text,
    exposure_period text,
    metal text,
    notes text,
    created_at text default current_timestamp,
    updated_at text default current_timestamp
);

create table sources (
    id integer primary key autoincrement,
    source_code text unique not null,
    source_kind text,
    source_type text,
    source_title text,
    authors_or_organization text,
    publication_year text,
    doi text,
    public_url text,
    display_citation text,
    public_notes text,
    programme text,
    metals text,
    exposure_periods text,
    local_file_name text,
    source_url text,
    private_pdf_object_key text,
    notes text,
    created_at text default current_timestamp
);

create table site_sources (
    id integer primary key autoincrement,
    site_fk integer not null,
    source_fk integer not null,
    source_order integer default 1,
    metals text,
    exposure_periods text,
    notes text,
    foreign key (site_fk) references sites(id) on delete cascade,
    foreign key (source_fk) references sources(id) on delete cascade,
    unique(site_fk, source_fk)
);

create table if not exists metadata_options (
    id integer primary key autoincrement,
    category text not null,
    value text not null,
    created_at text default current_timestamp,
    unique(category, value)
);

create index idx_sites_site_id on sites(site_id);
create index idx_sites_label on sites(site_label);
create index idx_sources_code on sources(source_code);
create index idx_site_sources_site on site_sources(site_fk);
create index idx_site_sources_source on site_sources(source_fk);