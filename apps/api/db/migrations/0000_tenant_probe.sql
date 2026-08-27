CREATE TABLE "tenant_probe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "tenant_probe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_probe" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_probe_isolation" ON "tenant_probe"
  USING (
    "institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid
  )
  WITH CHECK (
    "institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid
  );
