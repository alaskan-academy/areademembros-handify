import { describe, it, expect } from "vitest";
import { decidirPlanoAoPagar } from "./plano";

const AGORA = new Date("2026-09-24T12:00:00Z");
const DAQUI_A_DEZ_DIAS = "2026-10-04T12:00:00Z";
const DEZ_DIAS_ATRAS = "2026-09-14T12:00:00Z";

describe("decidirPlanoAoPagar", () => {
  it("sem plano nenhum, cria", () => {
    expect(decidirPlanoAoPagar(null, AGORA)).toBe("criar");
  });

  it("plano vitalício em pé, não mexe", () => {
    expect(decidirPlanoAoPagar({ expires_at: null }, AGORA)).toBe("nada");
  });

  it("plano vencido, cria um novo", () => {
    expect(decidirPlanoAoPagar({ expires_at: DEZ_DIAS_ATRAS }, AGORA)).toBe("criar");
  });

  it("É O CASO DO DEFEITO: atrasou, o fim foi agendado, e agora pagou", () => {
    // Sem isto o plano morre na data agendada mesmo ela tendo pago, e nada
    // aparece em alarme nenhum.
    expect(decidirPlanoAoPagar({ expires_at: DAQUI_A_DEZ_DIAS }, AGORA)).toBe(
      "desfazer_agendamento"
    );
  });

  it("a data exatamente igual a agora conta como vencida", () => {
    expect(decidirPlanoAoPagar({ expires_at: AGORA.toISOString() }, AGORA)).toBe("criar");
  });

  it("um segundo no futuro ainda é agendamento a desfazer", () => {
    const daqui1s = new Date(AGORA.getTime() + 1000).toISOString();
    expect(decidirPlanoAoPagar({ expires_at: daqui1s }, AGORA)).toBe("desfazer_agendamento");
  });

  it("a decisão NÃO olha quem concedeu — foi o que três revisões derrubaram", () => {
    // `granted_by` diz quem criou a linha, não quem escreveu a data: o ramo de
    // revogação agenda `expires_at` em qualquer linha, inclusive nas criadas
    // pela admin. Olhar para ele deixava justamente esse caso sem conserto.
    // O tipo nem carrega mais o campo; este teste existe para que voltar a
    // olhá-lo exija mexer aqui e reler o porquê.
    const comData = { expires_at: DAQUI_A_DEZ_DIAS } as const;
    expect(decidirPlanoAoPagar({ ...comData }, AGORA)).toBe("desfazer_agendamento");
    expect(Object.keys(comData)).toEqual(["expires_at"]);
  });
});
