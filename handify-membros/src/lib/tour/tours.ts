export interface TourStep {
  targetId: string; // string vazia = overlay completo sem spotlight
  text: string;
}

export const SECTION_TOURS: Record<string, TourStep[]> = {
  // ── Primeiro acesso — visão geral da plataforma ──────────────────────────────
  dashboard: [
    {
      targetId: "tour-dash-cursos",
      text: "Bem-vinda! Esta é sua Jornada — aqui ficam os cursos que você já está fazendo. Retome de onde parou com um toque!",
    },
    {
      targetId: "tour-nav-cursos",
      text: "Aqui você acessa seus cursos e também descobre novos para comprar. É a sua biblioteca de aprendizado!",
    },
    {
      targetId: "tour-nav-inspiracoes",
      text: "Aqui ficam as Inspirações: fotos, receitas e dicas do universo do artesanato compartilhadas pela comunidade.",
    },
    {
      targetId: "tour-nav-comunidade",
      text: "Aqui você vê os Avisos da Handify — novidades, lançamentos e dicas publicadas diretamente pela nossa equipe.",
    },
    {
      targetId: "tour-nav-ferramentas",
      text: "Aqui ficam suas Ferramentas: calculadoras de custo, precificação e listas de fornecedores para o seu artesanato!",
    },
    {
      targetId: "tour-nav-perfil",
      text: "Este botão abre o seu Perfil. Lá você edita seus dados, vê seus certificados, ativa notificações e altera sua senha.",
    },
  ],

  // ── Aulas ────────────────────────────────────────────────────────────────────
  aulas: [
    {
      targetId: "tour-aulas-player",
      text: "Este é o player de vídeo. Dê play e assista no seu ritmo — pause, volte e avance quando quiser. Seu progresso é salvo automaticamente!",
    },
    {
      targetId: "tour-aulas-concluir",
      text: "Ao terminar a aula, clique aqui para marcá-la como concluída. Isso salva seu progresso e te aproxima do certificado do curso!",
    },
    {
      targetId: "tour-aulas-nav",
      text: "Use esses botões para navegar entre as aulas: ← Anterior volta para a aula de antes, e Próxima → avança para a seguinte.",
    },
    {
      targetId: "tour-aulas-materiais",
      text: "Aqui ficam os materiais da aula — PDFs, apostilas e arquivos. Clique em 'Baixar' para salvar no seu dispositivo!",
    },
    {
      targetId: "tour-aulas-menu",
      text: "Este botão abre o menu completo do curso com todos os módulos e aulas. Use para navegar diretamente para qualquer aula!",
    },
    {
      targetId: "tour-aulas-sidebar",
      text: "Aqui ficam todas as aulas organizadas por módulo. Aulas concluídas aparecem marcadas — clique em qualquer título para ir direto!",
    },
  ],

  // ── Perfil ───────────────────────────────────────────────────────────────────
  perfil: [
    {
      targetId: "tour-perfil-edit",
      text: "Esta é sua área de perfil. Clique no ícone de lápis ✏️ para editar seu nome, bio e foto de perfil quando quiser!",
    },
    {
      targetId: "tour-perfil-senha",
      text: "Precisa mudar sua senha? Clique em 'Alterar senha' aqui. Sem precisar sair da conta — leva apenas alguns segundos!",
    },
    {
      targetId: "tour-perfil-certs",
      text: "Seus certificados aparecem aqui quando você conclui um curso. Baixe o PDF ou compartilhe o link de verificação com quem quiser!",
    },
    {
      targetId: "tour-perfil-notif",
      text: "Ative as notificações push para receber avisos da Handify no seu celular, mesmo com o navegador fechado!",
    },
  ],

  // ── Feed de avisos ───────────────────────────────────────────────────────────
  feed: [
    {
      targetId: "tour-feed-posts",
      text: "Aqui você vê as novidades, avisos e lançamentos publicados pela equipe Handify. Confira sempre para não perder nada!",
    },
    {
      targetId: "",
      text: "Você pode ♡ curtir qualquer post para demonstrar que viu e gostou! Fique de olho aqui para saber de novos cursos e novidades em primeira mão.",
    },
  ],

  // ── Fórum — lista de fóruns ──────────────────────────────────────────────────
  forum: [
    {
      targetId: "tour-forum-list",
      text: "Estes são os fóruns dos seus cursos. Cada fórum é o espaço de discussão de um curso em que você está matriculada. Clique para entrar!",
    },
  ],

  // ── Fórum interno ────────────────────────────────────────────────────────────
  "forum-interno": [
    {
      targetId: "tour-forum-posts",
      text: "Aqui ficam os posts do fórum — dúvidas, projetos e ideias das alunas. Clique em qualquer post para ver os comentários!",
    },
    {
      targetId: "tour-forum-novo-post",
      text: "Quer compartilhar algo? Clique em 'Novo post' para criar sua publicação. Ela passa por aprovação antes de aparecer para todos!",
    },
    {
      targetId: "",
      text: "Em cada post você pode ♡ curtir para dar like e 💬 comentar para responder. Interagir com a comunidade faz parte da jornada de aprendizado!",
    },
  ],

  // ── Inspirações ──────────────────────────────────────────────────────────────
  inspiracoes: [
    {
      targetId: "tour-inspiracoes-feed",
      text: "Role para explorar receitas, fotos, vídeos e dicas do universo do artesanato. É o espaço perfeito para se inspirar e descobrir novas criações!",
    },
    {
      targetId: "tour-inspiracoes-filtros",
      text: "Use os filtros para encontrar exatamente o que procura: filtre por tipo de conteúdo (fotos, receitas, vídeos) e por categoria de artesanato!",
    },
    {
      targetId: "",
      text: "Em cada post você pode ♡ curtir para dar like, 🔖 salvar para guardar para depois, e ver todos os seus salvos pelo link 'Ver salvos' no topo da página!",
    },
  ],

  // ── Ferramentas ──────────────────────────────────────────────────────────────
  ferramentas: [
    {
      targetId: "tour-ferramentas-hub",
      text: "Aqui ficam todas as ferramentas para facilitar o seu artesanato — calculadoras, fornecedores e muito mais, tudo gratuito!",
    },
    {
      targetId: "tour-ferramentas-nicho",
      text: "Primeiro, selecione o seu tipo de artesanato aqui. Clique no botão e escolha entre velas, sabonetes, aromaterapia e outros!",
    },
    {
      targetId: "tour-ferramentas-busca",
      text: "Você também pode buscar uma ferramenta pelo nome. Digite aqui e os resultados aparecem na hora — rápido e fácil!",
    },
  ],

  // ── Notificações ─────────────────────────────────────────────────────────────
  notificacoes: [
    {
      targetId: "tour-notificacoes-list",
      text: "Aqui chegam todos os seus avisos: respostas no fórum, novidades e conquistas. Clique em qualquer item para ver os detalhes.",
    },
  ],
};
