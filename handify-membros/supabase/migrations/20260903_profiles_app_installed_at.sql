-- Registra que a aluna ja tem o app instalado.
--
-- No Android o proprio Chrome resolve: ele nao dispara `beforeinstallprompt`
-- quando o app ja esta instalado, entao a tarja de convite nunca aparece para
-- quem instalou. No iPhone nao existe evento nem API equivalente — o Safari
-- nao tem como dizer se o app esta na tela inicial.
--
-- A saida e registrar do lado do servidor: quando a aluna abre pelo icone da
-- tela inicial, o navegador reporta `display-mode: standalone`, e gravamos a
-- data aqui (ela tambem pode dizer "Ja instalei" na tarja). Dai em diante a
-- tarja nao aparece mais para essa conta, em nenhum navegador ou aparelho.
alter table public.profiles
  add column if not exists app_installed_at timestamptz;

comment on column public.profiles.app_installed_at is
  'Quando se constatou que a aluna tem o app instalado — ou porque abriu pelo icone da tela inicial (display-mode: standalone), ou porque informou na tarja. Null = ainda nao instalou.';
