// "server-only" não existe como pacote instalado: o Next resolve esse import
// sozinho, para barrar código de servidor que vaze para o cliente. Scripts de
// linha de comando rodam fora do Next, então precisam de um módulo vazio no
// lugar, mapeado em tsconfig.scripts.json.
//
// O stub vale SÓ para os scripts. O tsconfig da aplicação não é tocado — mapear
// isso lá desligaria a barreira do server-only no projeto inteiro.
export {};
