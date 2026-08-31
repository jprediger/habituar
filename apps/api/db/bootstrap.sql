-- Só para desenvolvimento local e CI. As senhas literais abaixo são aceitáveis nesses
-- dois ambientes e inaceitáveis fora deles; produção provisiona roles por outro caminho.
create role habituar_owner login password 'habituar_owner';
create role habituar_app login password 'habituar_app';

revoke all on schema public from public;
grant usage on schema public to habituar_app, habituar_owner;
grant create on schema public to habituar_owner;
grant create on database habituar to habituar_owner;

-- Tabelas futuras criadas pelo dono já nascem acessíveis ao role da aplicação.
alter default privileges for role habituar_owner in schema public
  grant select, insert, update, delete on tables to habituar_app;

-- Irrelevante enquanto os identificadores são uuid, e por isso vale fazer agora: a
-- primeira coluna de identidade do M1 falharia com permissão negada num ponto distante
-- desta causa.
alter default privileges for role habituar_owner in schema public
  grant usage, select on sequences to habituar_app;
