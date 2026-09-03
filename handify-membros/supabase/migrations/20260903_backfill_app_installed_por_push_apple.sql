-- Marca como "ja instalou o app" quem tem inscricao de push da Apple.
--
-- Por que so a Apple: no iPhone o Web Push **exige** que o app esteja na tela
-- inicial — Safari nao entrega push para site comum. Uma inscricao em
-- `web.push.apple.com` e, portanto, prova de instalacao.
--
-- Por que NAO fazemos o mesmo com os outros servicos: no Chrome (`fcm`), no
-- Edge (`notify.windows.com`) e no Firefox (`mozilla`) o push funciona sem
-- instalar nada, entao a inscricao nao prova instalacao. Alem disso esses
-- navegadores nao disparam `beforeinstallprompt` quando o app ja esta
-- instalado, ou seja, eles ja se detectam sozinhos e nao precisam da coluna.
-- Marcar esse grupo seria inferencia errada e esconderia o convite de quem
-- nunca instalou. Na pratica eram 810 alunas no `fcm` contra 13 na Apple.
--
-- A data usada e a da primeira inscricao de push, nao `now()`: e mais ou menos
-- quando ela passou a ter o app, e nao mente sobre o momento da constatacao.
--
-- Idempotente: o `is null` faz a migration nao sobrescrever registro posterior
-- (abertura pelo icone da tela inicial, `appinstalled` ou "Ja instalei o app").
with apple as (
  select user_id, min(created_at) as primeira_inscricao
  from public.push_subscriptions
  where endpoint like 'https://web.push.apple.com/%'
  group by user_id
)
update public.profiles p
set app_installed_at = a.primeira_inscricao
from apple a
where p.id = a.user_id
  and p.app_installed_at is null;
