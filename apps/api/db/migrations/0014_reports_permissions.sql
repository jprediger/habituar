INSERT INTO permissions (key, sensitive) VALUES ('report.read', true), ('report.export', true) ON CONFLICT (key) DO UPDATE SET sensitive = true;--> statement-breakpoint
ALTER TABLE roles NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE role_permissions NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO role_permissions (institution_id, role_id, permission_key, scope)
SELECT r.institution_id, r.id, g.permission_key, g.scope::permission_scope
FROM roles r
JOIN (VALUES
  ('care-assigned', 'report.read', 'assigned'),
  ('care-assigned', 'report.export', 'assigned'),
  ('care-institution', 'report.read', 'institution'),
  ('care-institution', 'report.export', 'institution'),
  ('team-management', 'report.read', 'institution'),
  ('team-management', 'report.export', 'institution'),
  ('monitoring', 'report.read', 'assigned'),
  ('monitoring', 'report.export', 'assigned')
) AS g(template_key, permission_key, scope) ON r.template_key = g.template_key
WHERE r.is_system
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE roles FORCE ROW LEVEL SECURITY;
