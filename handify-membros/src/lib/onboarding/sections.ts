export type OnboardingSection = {
  id: string;
  label: string;
  rota: string;
  /** Prefixo: qualquer rota que comece com esse valor conta como visita */
  prefix?: boolean;
  descricao: string;
  icone: string; // Lucide icon name
  steps: string[];
};

export const ONBOARDING_SECTIONS: OnboardingSection[] = [
  {
    id: "dashboard",
    label: "Minha Jornada",
    rota: "/dashboard",
    descricao: "Acompanhe seus cursos e continue de onde parou.",
    icone: "LayoutDashboard",
    steps: [
      "Veja aqui todos os cursos em que você está matriculada",
      "Clique em um card para retomar a aula de onde parou",
      "A barra colorida mostra quanto do curso você já concluiu",
      "Cursos que você terminou aparecem na seção Refazer",
    ],
  },
  {
    id: "cursos",
    label: "Cursos",
    rota: "/cursos",
    descricao: "Explore o catálogo e acesse os seus cursos.",
    icone: "Home",
    steps: [
      "Clique no card do curso que deseja assistir",
      "Na página do curso, veja os módulos e as aulas disponíveis",
      "Clique em qualquer aula para abrir o vídeo",
      "Ao terminar, clique em Marcar como concluída e avance para a próxima",
    ],
  },
  {
    id: "aulas",
    label: "Aulas",
    rota: "/aulas/",
    prefix: true,
    descricao: "Bem-vinda à sua aula! Veja como navegar por aqui.",
    icone: "Play",
    steps: [
      "Assista ao vídeo — use o player para pausar, avançar e ajustar o volume",
      "No menu lateral (ou no topo em celular), veja todos os módulos e aulas do curso e acesse qualquer uma",
      "Role a página para baixo para ver materiais e conteúdos extras, quando houver",
      "Clique em Marcar como concluída quando terminar a aula",
      "Use os botões Anterior e Próxima para navegar entre as aulas",
    ],
  },
  {
    id: "inspiracoes",
    label: "Inspirações",
    rota: "/inspiracoes",
    descricao: "Receitas, fotos e dicas do universo do artesanato.",
    icone: "BookOpen",
    steps: [
      "Role o feed para ver as publicações da equipe Handify",
      "Clique no ícone de marcador para salvar uma publicação",
      "Acesse Salvos no topo da página para ver tudo que você guardou",
      "Use os filtros de nicho e categoria para encontrar temas do seu interesse",
    ],
  },
  {
    id: "ferramentas",
    label: "Ferramentas",
    rota: "/ferramentas",
    descricao: "Calculadoras e recursos para facilitar o seu artesanato.",
    icone: "Layers",
    steps: [
      "Escolha seu nicho no topo da página (velas, saboaria, aromaterapia…)",
      "Clique na ferramenta que deseja usar, por exemplo a Calculadora de Lucro",
      "Preencha os campos solicitados e clique em calcular",
      "O resultado aparece logo abaixo — você pode anotar ou imprimir",
    ],
  },
  {
    id: "forum",
    label: "Comunidade",
    rota: "/comunidade/forum",
    descricao: "Troque experiências, tire dúvidas e compartilhe projetos.",
    icone: "MessageSquare",
    steps: [
      "Escolha o fórum do curso em que você está matriculada",
      "Clique em Nova publicação para fazer uma pergunta ou compartilhar algo",
      "Para responder outra aluna, clique em Responder na publicação dela",
      "Curta as publicações que você gostou com o ícone de coração",
    ],
  },
  {
    id: "feed",
    label: "Avisos",
    rota: "/comunidade/feed",
    descricao: "Acompanhe novidades e avisos publicados pela equipe Handify.",
    icone: "Award",
    steps: [
      "Leia as publicações mais recentes no topo",
      "Ative as notificações para receber um alerta sempre que sair um aviso novo",
    ],
  },
  {
    id: "notificacoes",
    label: "Notificações",
    rota: "/notificacoes",
    descricao: "Fique por dentro de tudo que acontece na plataforma.",
    icone: "Bell",
    steps: [
      "Clique no sino no canto superior direito para ver seus alertas rapidamente",
      "Clique em uma notificação para ir direto ao conteúdo",
      "Marque notificações como lidas individualmente ou clique em Marcar todas como lidas",
    ],
  },
  {
    id: "perfil",
    label: "Perfil",
    rota: "/perfil",
    descricao: "Gerencie seus dados, notificações e certificados.",
    icone: "User",
    steps: [
      "Edite seu nome e foto clicando nos campos do perfil",
      "Clique em Ativar notificações para receber avisos de novidades diretamente no celular",
      "Role até Meus certificados e clique em Baixar PDF para salvar seu certificado",
      "Compartilhe o link de verificação do certificado para comprovar a conclusão do curso",
    ],
  },
];
