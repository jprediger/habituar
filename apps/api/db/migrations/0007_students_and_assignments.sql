-- FORCE RLS esconde registros legados do dono sem tenant; a falha do preflight reverte esta suspensão na transação.
ALTER TABLE students NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM students) THEN
    RAISE EXCEPTION 'Stage 3 requires auditing legacy student rows before migration';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE students FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE students ALTER COLUMN user_id DROP NOT NULL;--> statement-breakpoint
ALTER TABLE students ALTER COLUMN age_range DROP NOT NULL;--> statement-breakpoint
ALTER TABLE students ADD COLUMN full_name text NOT NULL;--> statement-breakpoint
ALTER TABLE students ADD COLUMN social_name text;--> statement-breakpoint
ALTER TABLE students ADD COLUMN birth_date date NOT NULL;--> statement-breakpoint
ALTER TABLE students ADD COLUMN archived_at timestamptz;--> statement-breakpoint
ALTER TABLE students ADD COLUMN archived_by_user_id uuid REFERENCES users(id);--> statement-breakpoint
ALTER TABLE students ADD COLUMN created_by_user_id uuid REFERENCES users(id);--> statement-breakpoint
ALTER TABLE students ADD COLUMN version integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE students ADD CONSTRAINT students_id_institution_unique UNIQUE (id, institution_id);--> statement-breakpoint
CREATE UNIQUE INDEX students_institution_user_id_unique ON students (institution_id, user_id) WHERE user_id IS NOT NULL;--> statement-breakpoint

ALTER TABLE guardians ALTER COLUMN user_id DROP NOT NULL;--> statement-breakpoint
ALTER TABLE guardians ALTER COLUMN student_id DROP NOT NULL;--> statement-breakpoint
ALTER TABLE guardians ADD COLUMN full_name text;--> statement-breakpoint
ALTER TABLE guardians ADD COLUMN email text;--> statement-breakpoint
ALTER TABLE guardians ADD COLUMN phone text;--> statement-breakpoint
ALTER TABLE guardians ADD COLUMN created_by_user_id uuid REFERENCES users(id);--> statement-breakpoint
CREATE UNIQUE INDEX guardians_institution_user_id_unique ON guardians (institution_id, user_id) WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX guardians_institution_email_unique ON guardians (institution_id, lower(email)) WHERE email IS NOT NULL;--> statement-breakpoint
ALTER TABLE guardians ADD CONSTRAINT guardians_id_institution_unique UNIQUE (id, institution_id);--> statement-breakpoint
CREATE TABLE student_guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  guardian_id uuid NOT NULL,
  relationship text NOT NULL CHECK (relationship IN ('mother', 'father', 'grandparent', 'legal-guardian', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, guardian_id),
  FOREIGN KEY (student_id, institution_id) REFERENCES students(id, institution_id) ON DELETE CASCADE,
  FOREIGN KEY (guardian_id, institution_id) REFERENCES guardians(id, institution_id) ON DELETE CASCADE
);--> statement-breakpoint

ALTER TABLE assignments ADD COLUMN membership_id uuid;--> statement-breakpoint
UPDATE assignments a SET membership_id = m.id FROM memberships m WHERE m.user_id = a.staff_user_id AND m.institution_id = a.institution_id AND m.removed_at IS NULL;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM assignments WHERE membership_id IS NULL) THEN
    RAISE EXCEPTION 'Legacy assignments without an active membership must be reconciled';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE assignments ALTER COLUMN membership_id SET NOT NULL;--> statement-breakpoint
ALTER TABLE assignments ADD CONSTRAINT assignments_membership_institution_fk FOREIGN KEY (membership_id, institution_id) REFERENCES memberships(id, institution_id) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE assignments ADD CONSTRAINT assignments_student_institution_fk FOREIGN KEY (student_id, institution_id) REFERENCES students(id, institution_id) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE assignments ADD CONSTRAINT assignments_membership_student_unique UNIQUE (membership_id, student_id);--> statement-breakpoint
CREATE FUNCTION enforce_assignment_eligibility() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM memberships m JOIN students s ON s.id = NEW.student_id AND s.institution_id = NEW.institution_id
    WHERE m.id = NEW.membership_id AND m.institution_id = NEW.institution_id
      AND m.removed_at IS NULL AND m.environment IN ('professional', 'monitor') AND s.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'assignment target is not eligible';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER assignments_require_active_membership BEFORE INSERT OR UPDATE ON assignments
FOR EACH ROW EXECUTE FUNCTION enforce_assignment_eligibility();--> statement-breakpoint
CREATE FUNCTION close_removed_membership_assignments() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL THEN
    DELETE FROM assignments WHERE membership_id = NEW.id AND institution_id = NEW.institution_id;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER memberships_close_assignments AFTER UPDATE OF removed_at ON memberships
FOR EACH ROW EXECUTE FUNCTION close_removed_membership_assignments();--> statement-breakpoint

CREATE TABLE student_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('institution-record', 'guardian-confirmation')),
  term_version text NOT NULL,
  guardian_id uuid,
  guardian_name_snapshot text,
  guardian_relationship_snapshot text,
  signed_on date,
  recorded_by_user_id uuid NOT NULL REFERENCES users(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by_user_id uuid REFERENCES users(id),
  FOREIGN KEY (student_id, institution_id) REFERENCES students(id, institution_id) ON DELETE CASCADE,
  FOREIGN KEY (guardian_id, institution_id) REFERENCES guardians(id, institution_id) ON DELETE RESTRICT
);--> statement-breakpoint
ALTER TABLE invitations ADD COLUMN student_id uuid;--> statement-breakpoint
ALTER TABLE invitations ADD COLUMN guardian_id uuid;--> statement-breakpoint
ALTER TABLE invitations ADD COLUMN target_kind text;--> statement-breakpoint
ALTER TABLE invitations ADD CONSTRAINT invitations_student_target_fk FOREIGN KEY (student_id, institution_id) REFERENCES students(id, institution_id);--> statement-breakpoint
ALTER TABLE invitations ADD CONSTRAINT invitations_guardian_target_fk FOREIGN KEY (guardian_id, institution_id) REFERENCES guardians(id, institution_id);--> statement-breakpoint
ALTER TABLE invitations ADD CONSTRAINT invitations_student_target_check CHECK ((environment = 'student' AND student_id IS NOT NULL AND target_kind IS NOT NULL AND ((target_kind = 'student' AND guardian_id IS NULL) OR (target_kind = 'guardian' AND guardian_id IS NOT NULL))) OR (environment <> 'student' AND student_id IS NULL AND guardian_id IS NULL AND target_kind IS NULL));--> statement-breakpoint
ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE student_guardians FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY student_guardians_isolation ON student_guardians USING (institution_id = current_setting('app.institution_id', true)::uuid) WITH CHECK (institution_id = current_setting('app.institution_id', true)::uuid);--> statement-breakpoint
ALTER TABLE student_consents ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE student_consents FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY student_consents_isolation ON student_consents USING (institution_id = current_setting('app.institution_id', true)::uuid) WITH CHECK (institution_id = current_setting('app.institution_id', true)::uuid);--> statement-breakpoint

INSERT INTO permissions (key) VALUES ('assignment.manage'), ('student.create'), ('guardian.unlink') ON CONFLICT DO NOTHING;--> statement-breakpoint
-- O dono precisa ler os templates de todas as instituições e inserir suas concessões.
-- A janela sem FORCE permanece dentro da transação da migração.
ALTER TABLE roles NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE role_permissions NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO roles (institution_id, name, template_key, environment, is_system)
SELECT i.id, 'guardian', 'guardian', 'student', true FROM institutions i
ON CONFLICT (institution_id, template_key) DO NOTHING;--> statement-breakpoint
INSERT INTO role_permissions (institution_id, role_id, permission_key, scope)
SELECT r.institution_id, r.id, 'student.read', 'own' FROM roles r WHERE r.is_system AND r.template_key = 'guardian'
ON CONFLICT (role_id, permission_key, scope) DO NOTHING;--> statement-breakpoint
INSERT INTO role_permissions (institution_id, role_id, permission_key, scope)
SELECT r.institution_id, r.id, g.permission_key, g.scope::permission_scope
FROM roles r CROSS JOIN (VALUES
  ('care-assigned', 'guardian.unlink', 'assigned'),
  ('care-institution', 'student.create', 'institution'),
  ('care-institution', 'guardian.unlink', 'institution'),
  ('care-institution', 'assignment.manage', 'institution'),
  ('team-management', 'assignment.manage', 'institution')
) AS g(template_key, permission_key, scope)
WHERE r.is_system AND r.template_key = g.template_key
ON CONFLICT (role_id, permission_key, scope) DO NOTHING;--> statement-breakpoint
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE roles FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- As permissões e os acompanhamentos existentes permanecem intactos nesta etapa; a limpeza em duas fases será feita em uma entrega posterior.
