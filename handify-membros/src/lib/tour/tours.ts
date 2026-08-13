export interface TourStep {
  targetId: string;
  text: string;
}

export const SECTION_TOURS: Record<string, TourStep[]> = {
  cursos: [
    {
      targetId: "tour-cursos-grid",
      text: "Aqui ficam todos os seus cursos. Toque em qualquer um para abrir e começar a aprender!",
    },
  ],
  aulas: [
    {
      targetId: "tour-aulas-player",
      text: "Este é o player de vídeo. Dê play e assista no seu ritmo — pause quando quiser!",
    },
    {
      targetId: "tour-aulas-concluir",
      text: "Ao terminar, clique aqui para marcar a aula como concluída. Concluindo todas as aulas você ganha o certificado!",
    },
    {
      targetId: "tour-aulas-sidebar",
      text: "Aqui ficam todas as aulas do curso. Clique em qualquer título para navegar entre elas.",
    },
  ],
  perfil: [
    {
      targetId: "tour-perfil-certs",
      text: "Seus certificados aparecem aqui quando você conclui um curso. Baixe o PDF a qualquer hora!",
    },
    {
      targetId: "tour-perfil-notif",
      text: "Ative as notificações para receber novidades e avisos da Handify direto no seu celular.",
    },
  ],
  feed: [
    {
      targetId: "tour-feed-posts",
      text: "Aqui você vê as novidades, avisos e lançamentos publicados pela equipe Handify. Confira sempre!",
    },
  ],
  forum: [
    {
      targetId: "tour-forum-list",
      text: "Estes são os fóruns dos seus cursos. Tire dúvidas, compartilhe projetos e troque experiências!",
    },
  ],
  inspiracoes: [
    {
      targetId: "tour-inspiracoes-feed",
      text: "Role para explorar receitas, fotos e dicas do universo do artesanato. Salve os que você gostar!",
    },
  ],
  ferramentas: [
    {
      targetId: "tour-ferramentas-hub",
      text: "Aqui ficam as ferramentas para facilitar o seu artesanato. Escolha a que você precisa!",
    },
  ],
  notificacoes: [
    {
      targetId: "tour-notificacoes-list",
      text: "Aqui chegam todos os seus avisos: respostas, novidades e conquistas. Clique para ver os detalhes.",
    },
  ],
};
