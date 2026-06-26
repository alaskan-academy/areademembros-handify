// Estado compartilhado entre useModalBackGuard e BackButtonGuard.
// Quando um modal está aberto, BackButtonGuard fica no modo "fechar modal"
// em vez de mostrar o toast de "pressione novamente para sair".
export const activeModalRef: { current: boolean } = { current: false };
