create role habituar_owner login password 'habituar_owner';
create role habituar_app login password 'habituar_app';

revoke all on schema public from public;
grant usage on schema public to habituar_app, habituar_owner;
grant create on schema public to habituar_owner;
grant create on database habituar to habituar_owner;

-- Tabelas futuras criadas pelo dono já nascem acessíveis ao role da aplicação.
alter default privileges for role habituar_owner in schema public
  grant select, insert, update, delete on tables to habituar_app;
