-- Trilha de auditoria (D11). As escritas são capturadas por trigger, então nenhum caminho
-- de código — serviço, seed, job ou SQL manual — consegue escrever sem deixar rastro. A
-- leitura sensível passa por uma função: ator, sessão e instituição vêm dos GUCs que o
-- wrapper de transação instala, nunca de um argumento que o chamador possa forjar.

-- GUC malformado não pode derrubar a escrita que está sendo auditada: vira null e o evento
-- fica visível como "sem ator".
CREATE FUNCTION audit_setting_uuid(setting_name text) RETURNS uuid
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public AS $$
DECLARE
  raw text := nullif(current_setting(setting_name, true), '');
BEGIN
  IF raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN raw::uuid;
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE TABLE "audit_write_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- Sem FK de propósito: a trilha precisa sobreviver à exclusão da instituição, do usuário
  -- e da linha auditada.
  "institution_id" uuid,
  "actor_user_id" uuid,
  "session_id" text,
  "table_name" text NOT NULL,
  "row_id" text,
  "operation" text NOT NULL,
  "before" jsonb,
  "after" jsonb,
  "occurred_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "audit_write_events_operation" CHECK ("operation" IN ('insert', 'update', 'delete'))
);--> statement-breakpoint
CREATE INDEX "audit_write_events_institution" ON "audit_write_events" ("institution_id", "occurred_at");--> statement-breakpoint
CREATE INDEX "audit_write_events_row" ON "audit_write_events" ("table_name", "row_id", "occurred_at");--> statement-breakpoint
CREATE INDEX "audit_write_events_actor" ON "audit_write_events" ("actor_user_id", "occurred_at");--> statement-breakpoint

-- Segredos e o documento assinado não entram no diff: a trilha registra que mudaram, não o
-- valor. Um hash de senha ou de token copiado para a auditoria seria um segundo lugar a vazar.
CREATE FUNCTION audit_redact(row_data jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS $$
  SELECT coalesce(jsonb_object_agg(entry.key,
    CASE WHEN entry.key IN ('password_hash', 'token_hash', 'document_base64') AND entry.value <> 'null'::jsonb
      THEN '"[redacted]"'::jsonb ELSE entry.value END), '{}'::jsonb)
  FROM jsonb_each(row_data) AS entry
$$;--> statement-breakpoint

-- SECURITY DEFINER: grava como dono da tabela, então o papel da aplicação não precisa (nem
-- recebe) INSERT direto em `audit_write_events`.
CREATE FUNCTION audit_row_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  old_data jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN audit_redact(to_jsonb(OLD)) END;
  new_data jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN audit_redact(to_jsonb(NEW)) END;
  subject jsonb := coalesce(new_data, old_data);
  changed_before jsonb;
  changed_after jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(entry.key, old_data -> entry.key), jsonb_object_agg(entry.key, entry.value)
      INTO changed_before, changed_after
      FROM jsonb_each(new_data) AS entry
      WHERE entry.value IS DISTINCT FROM old_data -> entry.key;
    -- Update que não muda nada não é evento.
    IF changed_after IS NULL THEN
      RETURN NULL;
    END IF;
    old_data := changed_before;
    new_data := changed_after;
  END IF;

  INSERT INTO audit_write_events (institution_id, actor_user_id, session_id, table_name, row_id, operation, before, after)
  VALUES (
    CASE WHEN TG_TABLE_NAME = 'institutions' THEN (subject ->> 'id')::uuid
      ELSE coalesce((subject ->> 'institution_id')::uuid, audit_setting_uuid('app.institution_id')) END,
    audit_setting_uuid('app.actor_id'),
    nullif(current_setting('app.session_id', true), ''),
    TG_TABLE_NAME,
    subject ->> 'id',
    lower(TG_OP),
    old_data,
    new_data
  );
  RETURN NULL;
END;
$$;--> statement-breakpoint

DO $$
DECLARE
  audited text;
BEGIN
  -- Fora: `tenant_probe` (fixture de isolamento), `permissions` (catálogo versionado por
  -- migração) e `sessions` (cada login e renovação viraria evento, sem dado de aluno).
  FOREACH audited IN ARRAY ARRAY[
    'institutions', 'users', 'roles', 'role_permissions', 'memberships', 'membership_roles',
    'invitations', 'invitation_roles', 'students', 'classes', 'class_enrollments',
    'class_staff_members', 'guardians', 'student_guardians', 'student_consents', 'assignments',
    'student_profile_revisions', 'student_observations', 'student_consultations', 'appointments',
    'appointment_cancelled_occurrences', 'tasks', 'task_occurrences', 'task_occurrence_photos',
    'task_occurrence_evaluations'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_row_change()',
      audited || '_audit', audited
    );
  END LOOP;
END;
$$;--> statement-breakpoint

-- Leitura de dado do Art. 11 da LGPD. Particionada por mês para que a retenção seja
-- `DROP` de partição, não `DELETE` em massa.
CREATE TABLE "audit_read_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL,
  "actor_user_id" uuid,
  "session_id" text,
  "permission" text NOT NULL,
  "purpose" text NOT NULL,
  "subject_type" text NOT NULL,
  "subject_id" uuid NOT NULL,
  -- Quem teve dado servido: responde "quem viu o registro deste aluno" também quando a
  -- leitura foi um relatório de turma ou da instituição.
  "student_ids" uuid[] NOT NULL,
  "occurred_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id", "occurred_at"),
  CONSTRAINT "audit_read_events_subject_type" CHECK ("subject_type" IN ('student', 'class', 'institution'))
) PARTITION BY RANGE ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_read_events_institution" ON "audit_read_events" ("institution_id", "occurred_at");--> statement-breakpoint
CREATE INDEX "audit_read_events_students" ON "audit_read_events" USING gin ("student_ids");--> statement-breakpoint

-- Retenção da leitura sensível: cinco anos, alinhado ao prazo prescricional geral de
-- reparação civil. Mudar o prazo é decisão de produto e entra por migração.
CREATE FUNCTION audit_read_retention() RETURNS interval
LANGUAGE sql IMMUTABLE AS $$ SELECT interval '60 months' $$;--> statement-breakpoint

-- Papéis que não são donos e têm acesso concedido à tabela. Os privilégios padrão do
-- bootstrap concedem escrita a toda tabela nova; a trilha precisa retirar isso sem depender
-- do nome do papel da aplicação, que muda fora do desenvolvimento.
CREATE FUNCTION audit_grantees(relation regclass) RETURNS SETOF regrole
LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT DISTINCT acl.grantee::regrole
  FROM pg_class, aclexplode(pg_class.relacl) AS acl
  WHERE pg_class.oid = relation AND acl.grantee <> pg_class.relowner AND acl.grantee <> 0
$$;--> statement-breakpoint

-- Cria a partição do mês sob demanda e, uma vez por mês novo, descarta as vencidas. O lock
-- consultivo serializa a criação concorrente; partição existente é o caminho rápido. Sem
-- privilégio próprio, a partição só é alcançável pela tabela-mãe, que tem a RLS.
CREATE FUNCTION audit_ensure_read_partition(at timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  month_start timestamptz := date_trunc('month', at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  partition_name text := 'audit_read_events_' || to_char(month_start AT TIME ZONE 'UTC', 'YYYY_MM');
  oldest_kept text := 'audit_read_events_' || to_char((month_start - audit_read_retention()) AT TIME ZONE 'UTC', 'YYYY_MM');
  grantee regrole;
  expired record;
BEGIN
  IF to_regclass('public.' || quote_ident(partition_name)) IS NOT NULL THEN
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('audit_read_events_partitions'));
  IF to_regclass('public.' || quote_ident(partition_name)) IS NOT NULL THEN
    RETURN;
  END IF;
  EXECUTE format(
    'CREATE TABLE public.%I PARTITION OF public.audit_read_events FOR VALUES FROM (%L) TO (%L)',
    partition_name, month_start, month_start + interval '1 month'
  );
  FOR grantee IN SELECT audit_grantees(('public.' || quote_ident(partition_name))::regclass) LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM %s', partition_name, grantee);
  END LOOP;
  -- Nome no formato fixo `_YYYY_MM` ordena como data.
  FOR expired IN
    SELECT child.relname
    FROM pg_inherits
    JOIN pg_class child ON child.oid = pg_inherits.inhrelid
    WHERE pg_inherits.inhparent = 'audit_read_events'::regclass
      AND child.relname < oldest_kept
  LOOP
    EXECUTE format('DROP TABLE public.%I', expired.relname);
  END LOOP;
END;
$$;--> statement-breakpoint

CREATE FUNCTION audit_record_sensitive_read(permission text, purpose text, subject_type text, subject_id uuid, student_ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  institution uuid := audit_setting_uuid('app.institution_id');
BEGIN
  -- Leitura sensível fora de tenant é bug, não evento a registrar pela metade.
  IF institution IS NULL THEN
    RAISE EXCEPTION 'Sensitive read requires a tenant context';
  END IF;
  PERFORM audit_ensure_read_partition(now());
  INSERT INTO audit_read_events (institution_id, actor_user_id, session_id, permission, purpose, subject_type, subject_id, student_ids)
  VALUES (institution, audit_setting_uuid('app.actor_id'), nullif(current_setting('app.session_id', true), ''), permission, purpose, subject_type, subject_id, student_ids);
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION audit_ensure_read_partition(timestamptz) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION audit_row_change() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION audit_record_sensitive_read(text, text, text, uuid, uuid[]) FROM PUBLIC;--> statement-breakpoint
SELECT audit_ensure_read_partition(now());--> statement-breakpoint
SELECT audit_ensure_read_partition(now() + interval '1 month');--> statement-breakpoint

-- Somente inclusão: quem tinha acesso por privilégio padrão fica só com leitura, e só da
-- própria instituição. Sem FORCE, para que as funções SECURITY DEFINER (donas da tabela)
-- gravem sem política de INSERT. Quem lê a trilha também pode registrar leitura sensível.
DO $$
DECLARE
  grantee regrole;
BEGIN
  FOR grantee IN SELECT audit_grantees('audit_write_events'::regclass) LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON audit_write_events FROM %s', grantee);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON audit_read_events FROM %s', grantee);
    EXECUTE format('GRANT EXECUTE ON FUNCTION audit_record_sensitive_read(text, text, text, uuid, uuid[]) TO %s', grantee);
  END LOOP;
END;
$$;--> statement-breakpoint
ALTER TABLE "audit_write_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "audit_write_events_tenant_read" ON "audit_write_events" FOR SELECT
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "audit_read_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "audit_read_events_tenant_read" ON "audit_read_events" FOR SELECT
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);
