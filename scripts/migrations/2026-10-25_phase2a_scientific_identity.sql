
-- ==========================================================
-- CorrosionAtlas Phase 2A
-- Stable scientific observation and specimen identities
--
-- Additive migration:
-- Does not delete or recreate existing observations.
-- Preserves the legacy observation identity constraint.
-- ==========================================================

BEGIN;

-- ----------------------------------------------------------
-- 1. Create physical specimen records
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.corrosion_specimens (

    specimen_uuid uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    site_fk bigint NOT NULL
        REFERENCES public.sites(id)
        ON DELETE RESTRICT,

    source_fk bigint NOT NULL
        REFERENCES public.sources(id)
        ON DELETE RESTRICT,

    -- Original source-reported specimen/coupon label.
    -- NULL means not established from the publication.
    source_specimen_label text,

    -- Optional study, campaign or exposure-series reference.
    campaign_ref text,

    material text,

    notes text NOT NULL DEFAULT '',

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Enables composite FK verification from observations.
    CONSTRAINT corrosion_specimens_scope_unique
        UNIQUE (specimen_uuid, site_fk, source_fk)
);


-- ----------------------------------------------------------
-- 2. Add permanent observation UUID
-- ----------------------------------------------------------

ALTER TABLE public.corrosion_observations
ADD COLUMN IF NOT EXISTS observation_uuid uuid;

-- Give every existing observation a permanent UUID.
-- Already assigned UUIDs are preserved on re-execution.

UPDATE public.corrosion_observations
SET observation_uuid = gen_random_uuid()
WHERE observation_uuid IS NULL;

-- Future INSERT operations automatically receive a UUID.

ALTER TABLE public.corrosion_observations
ALTER COLUMN observation_uuid
SET DEFAULT gen_random_uuid();

ALTER TABLE public.corrosion_observations
ALTER COLUMN observation_uuid
SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
    ca_corrosion_observation_uuid_unique
ON public.corrosion_observations (observation_uuid);


-- ----------------------------------------------------------
-- 3. Add specimen and source-identity references
-- ----------------------------------------------------------

ALTER TABLE public.corrosion_observations
ADD COLUMN IF NOT EXISTS specimen_uuid uuid;

ALTER TABLE public.corrosion_observations
ADD COLUMN IF NOT EXISTS source_record_key text;

ALTER TABLE public.corrosion_observations
ADD COLUMN IF NOT EXISTS source_locator text;

ALTER TABLE public.corrosion_observations
ADD COLUMN IF NOT EXISTS identity_notes text;


-- ----------------------------------------------------------
-- 4. Enforce matching Site and Source for specimen links
-- ----------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'ca_corrosion_observation_specimen_scope_fk'
          AND conrelid =
            'public.corrosion_observations'::regclass
    ) THEN

        ALTER TABLE public.corrosion_observations
        ADD CONSTRAINT
            ca_corrosion_observation_specimen_scope_fk

        FOREIGN KEY (
            specimen_uuid,
            site_fk,
            source_fk
        )

        REFERENCES public.corrosion_specimens (
            specimen_uuid,
            site_fk,
            source_fk
        )

        ON UPDATE RESTRICT
        ON DELETE RESTRICT;

    END IF;
END;
$$;


-- ----------------------------------------------------------
-- 5. Indexes for future identity-aware matching
-- ----------------------------------------------------------

CREATE INDEX IF NOT EXISTS
    ca_corrosion_observation_specimen_idx
ON public.corrosion_observations (specimen_uuid)
WHERE specimen_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS
    ca_corrosion_specimen_source_site_idx
ON public.corrosion_specimens (source_fk, site_fk);

CREATE INDEX IF NOT EXISTS
    ca_corrosion_specimen_reported_label_idx
ON public.corrosion_specimens (
    source_fk,
    site_fk,
    source_specimen_label
)
WHERE source_specimen_label IS NOT NULL;

-- source_record_key is a curated identifier unique
-- within an individual bibliographic source.
-- It must remain independent of editable dates/values.

CREATE UNIQUE INDEX IF NOT EXISTS
    ca_corrosion_source_record_key_unique
ON public.corrosion_observations (
    source_fk,
    lower(btrim(source_record_key))
)
WHERE source_record_key IS NOT NULL
  AND btrim(source_record_key) <> '';


-- ----------------------------------------------------------
-- 6. Prevent accidental permanent-identity changes
-- ----------------------------------------------------------

CREATE OR REPLACE FUNCTION
public.ca_protect_observation_uuid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.observation_uuid
       IS DISTINCT FROM OLD.observation_uuid THEN

        RAISE EXCEPTION
            'observation_uuid is immutable';

    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
    ca_protect_observation_uuid_trigger
ON public.corrosion_observations;

CREATE TRIGGER
    ca_protect_observation_uuid_trigger
BEFORE UPDATE OF observation_uuid
ON public.corrosion_observations
FOR EACH ROW
EXECUTE FUNCTION
    public.ca_protect_observation_uuid();


CREATE OR REPLACE FUNCTION
public.ca_protect_specimen_uuid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.specimen_uuid
       IS DISTINCT FROM OLD.specimen_uuid THEN

        RAISE EXCEPTION
            'specimen_uuid is immutable';

    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
    ca_protect_specimen_uuid_trigger
ON public.corrosion_specimens;

CREATE TRIGGER
    ca_protect_specimen_uuid_trigger
BEFORE UPDATE OF specimen_uuid
ON public.corrosion_specimens
FOR EACH ROW
EXECUTE FUNCTION
    public.ca_protect_specimen_uuid();


-- ----------------------------------------------------------
-- 7. Protect the new specimen table
-- ----------------------------------------------------------

ALTER TABLE public.corrosion_specimens
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.corrosion_specimens
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.corrosion_specimens
TO service_role;


-- ----------------------------------------------------------
-- 8. Documentation
-- ----------------------------------------------------------

COMMENT ON COLUMN
public.corrosion_observations.observation_uuid
IS 'Permanent scientific observation UUID, independent of editable measurement metadata.';

COMMENT ON COLUMN
public.corrosion_observations.specimen_uuid
IS 'Optional reference to an identifiable physical specimen. NULL when unknown.';

COMMENT ON COLUMN
public.corrosion_observations.source_record_key
IS 'Optional stable curator-assigned observation key, unique within one bibliographic source.';

COMMENT ON COLUMN
public.corrosion_observations.source_locator
IS 'Human-readable location of the observation in the original publication.';

COMMENT ON COLUMN
public.corrosion_observations.identity_notes
IS 'Notes about specimen or observation identity and identification provenance.';

COMMENT ON COLUMN
public.corrosion_specimens.source_specimen_label
IS 'Original specimen identifier as reported by the source, where available.';

COMMENT ON COLUMN
public.corrosion_specimens.campaign_ref
IS 'Optional source-reported exposure campaign or test-series reference.';

COMMIT;
