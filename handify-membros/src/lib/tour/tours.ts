export interface TourStep {
  targetId: string; // string vazia = overlay completo sem spotlight
  text: string;
}

export const SECTION_TOURS: Record<string, TourStep[]> = {
  // ── Cursos ───────────────────────────────────────────────────────────────────
  cursos: [
    // 1–3: conteúdo da página (onde a aluna está)
    {
      targetId: "tour-cursos-meus-cursos",
      text: "Seus cursos matriculados. Toque para continuar de onde parou.",
    },
    {
      targetId: "tour-cursos-materiais",
      text: "E-books e apostilas incluídos na sua compra.",
    },
    {
      targetId: "tour-cursos-outros",
      text: "Cursos disponíveis para comprar e ampliar seu conhecimento.",
    },
    // 4–6: outras seções da plataforma
    {
      targetId: "tour-nav-inspiracoes",
      text: "Fotos, receitas e dicas da comunidade.",
    },
    {
      targetId: "tour-nav-comunidade",
      text: "Novidades e lançamentos da Handify.",
    },
    {
      targetId: "tour-nav-ferramentas",
      text: "Calculadoras, fornecedores e recursos gratuitos para o seu artesanato.",
    },
    // 7–8: navegação e perfil
    {
      targetId: "tour-nav-menu",
      text: "Acesse todas as seções da plataforma.",
    },
    {
      targetId: "tour-nav-perfil",
      text: "Seu perfil: dados, certificados, notificações e senha.",
    },
  ],

  // ── Dashboard — sem tour (DiscoveryCard cobre a descoberta) ──────────────────
  dashboard: [],

  // ── Aulas ────────────────────────────────────────────────────────────────────
  aulas: [
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
      targetId: "tour-feed-curtir",
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
      targetId: "tour-forum-novo-post",
      text: "Clique em 'Novo post' para compartilhar. Passa por aprovação antes de aparecer.",
    },
    {
      targetId: "tour-forum-acoes",
      text: "Em cada post: ♡ curtir e 💬 comentar.",
    },
  ],

  // ── Inspirações ──────────────────────────────────────────────────────────────
  inspiracoes: [
    {
      targetId: "tour-inspiracoes-filtros",
      text: "Filtre por tipo de conteúdo ou categoria de artesanato.",
    },
    {
      targetId: "tour-inspiracoes-acoes",
      text: "♡ curtir, 💬 comentar e 🔖 salvar para depois.",
    },
    {
      targetId: "tour-inspiracoes-salvos",
      text: "Tudo que você salvou fica aqui — acesse quando quiser.",
    },
  ],

  // ── Ferramentas ──────────────────────────────────────────────────────────────
  ferramentas: [
    {
      targetId: "tour-ferramentas-nicho",
      text: "Seus artesanatos aparecem aqui, pelos cursos que você tem — as ferramentas se adaptam a eles.",
    },
    {
      targetId: "tour-ferramentas-busca",
      text: "Busque uma ferramenta pelo nome — os resultados aparecem na hora.",
    },
  ],

};
