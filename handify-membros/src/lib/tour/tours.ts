export interface TourStep {
  targetId: string; // string vazia = overlay completo sem spotlight
  text: string;
}

export const SECTION_TOURS: Record<string, TourStep[]> = {
  // ── Cursos ───────────────────────────────────────────────────────────────────
  cursos: [
    {
      targetId: "tour-cursos-meus-cursos",
      text: "Meus Cursos — seus cursos matriculados. Toque para continuar de onde parou.",
    },
    {
      targetId: "tour-cursos-materiais",
      text: "Meus Materiais Didáticos — e-books e apostilas incluídos na sua compra.",
    },
    {
      targetId: "tour-cursos-outros",
      text: "Outros Cursos — conteúdos disponíveis para comprar e ampliar seu conhecimento.",
    },
    {
      targetId: "tour-nav-perfil",
      text: "Sua foto de perfil. Toque aqui para acessar seus certificados, editar dados e alterar senha.",
    },
    {
      targetId: "tour-nav-cursos",
      text: "📚 Cursos — sua biblioteca de cursos.",
    },
    {
      targetId: "tour-nav-inspiracoes",
      text: "✨ Inspirações — fotos, receitas e dicas da comunidade.",
    },
    {
      targetId: "tour-nav-comunidade",
      text: "🔔 Avisos — novidades e comunicados da Handify.",
    },
    {
      targetId: "tour-nav-ferramentas",
      text: "🔧 Ferramentas — calculadoras gratuitas para o seu artesanato.",
    },
    {
      targetId: "tour-nav-menu",
      text: "☰ Menu — acesso a todas as outras opções de navegação.",
    },
  ],

  // ── Primeiro acesso — visão geral da plataforma ──────────────────────────────
  dashboard: [
    {
      targetId: "tour-dash-cursos",
      text: "Sua jornada — cursos em andamento. Toque para retomar de onde parou.",
    },
    {
      targetId: "tour-nav-cursos",
      text: "Cursos — sua biblioteca e novos para comprar.",
    },
    {
      targetId: "tour-nav-inspiracoes",
      text: "Inspirações — fotos, receitas e dicas da comunidade.",
    },
    {
      targetId: "tour-nav-comunidade",
      text: "Avisos — novidades e lançamentos da Handify.",
    },
    {
      targetId: "tour-nav-ferramentas",
      text: "Ferramentas — calculadoras e recursos gratuitos para o seu artesanato.",
    },
    {
      targetId: "tour-nav-perfil",
      text: "Seu perfil: dados, certificados, notificações e senha.",
    },
  ],

  // ── Aulas ────────────────────────────────────────────────────────────────────
  aulas: [
    {
      targetId: "tour-aulas-player",
      text: "Player de vídeo. Pause, volte e avance à vontade — o progresso é salvo automaticamente.",
    },
    {
      targetId: "tour-aulas-concluir",
      text: "Concluiu? Marque aqui para salvar o progresso e chegar mais perto do certificado.",
    },
    {
      targetId: "tour-aulas-nav",
      text: "← Anterior e Próxima → para navegar entre as aulas do curso.",
    },
    {
      targetId: "tour-aulas-materiais",
      text: "Materiais da aula — clique em Baixar para salvar no seu dispositivo.",
    },
    {
      targetId: "tour-aulas-menu",
      text: "Menu do curso — veja todos os módulos e pule para qualquer aula.",
    },
    {
      targetId: "tour-aulas-sidebar",
      text: "Lista completa de aulas por módulo. Aulas concluídas ficam marcadas.",
    },
  ],

  // ── Perfil ───────────────────────────────────────────────────────────────────
  perfil: [
    {
      targetId: "tour-perfil-edit",
      text: "Clique no ✏️ para editar nome, bio e foto de perfil.",
    },
    {
      targetId: "tour-perfil-senha",
      text: "Clique em 'Alterar senha' para trocar sua senha.",
    },
    {
      targetId: "tour-perfil-certs",
      text: "Certificados dos cursos concluídos — baixe o PDF ou compartilhe o link.",
    },
    {
      targetId: "tour-perfil-notif",
      text: "Ative as notificações para receber avisos da Handify no celular.",
    },
  ],

  // ── Feed de avisos ───────────────────────────────────────────────────────────
  feed: [
    {
      targetId: "tour-feed-posts",
      text: "Novidades, avisos e lançamentos da Handify. Confira sempre para não perder nada!",
    },
    {
      targetId: "",
      text: "Curta com ♡ para demonstrar que viu. Fique de olho para saber de novos cursos em primeira mão.",
    },
  ],

  // ── Fórum — lista de fóruns ──────────────────────────────────────────────────
  forum: [
    {
      targetId: "tour-forum-list",
      text: "Fóruns dos seus cursos — espaço para dúvidas e projetos. Clique para entrar.",
    },
  ],

  // ── Fórum interno ────────────────────────────────────────────────────────────
  "forum-interno": [
    {
      targetId: "tour-forum-posts",
      text: "Posts do fórum — dúvidas, projetos e ideias. Clique para ver os comentários.",
    },
    {
      targetId: "tour-forum-novo-post",
      text: "Clique em 'Novo post' para compartilhar. Passa por aprovação antes de aparecer.",
    },
    {
      targetId: "",
      text: "Em cada post: ♡ curtir e 💬 comentar.",
    },
  ],

  // ── Inspirações ──────────────────────────────────────────────────────────────
  inspiracoes: [
    {
      targetId: "tour-inspiracoes-feed",
      text: "Role para explorar fotos, receitas e dicas de artesanato.",
    },
    {
      targetId: "tour-inspiracoes-filtros",
      text: "Filtre por tipo de conteúdo ou categoria de artesanato.",
    },
    {
      targetId: "",
      text: "♡ curtir, 🔖 salvar para depois, e 'Ver salvos' no topo para ver sua lista.",
    },
  ],

  // ── Ferramentas ──────────────────────────────────────────────────────────────
  ferramentas: [
    {
      targetId: "tour-ferramentas-hub",
      text: "Ferramentas gratuitas para precificar, calcular e planejar seu artesanato.",
    },
    {
      targetId: "tour-ferramentas-nicho",
      text: "Selecione seu tipo de artesanato para ver as ferramentas disponíveis.",
    },
    {
      targetId: "tour-ferramentas-busca",
      text: "Busque uma ferramenta pelo nome — os resultados aparecem na hora.",
    },
  ],

  // ── Notificações ─────────────────────────────────────────────────────────────
  notificacoes: [
    {
      targetId: "tour-notificacoes-list",
      text: "Seus avisos chegam aqui — respostas, novidades e conquistas. Clique para ver.",
    },
  ],
};
