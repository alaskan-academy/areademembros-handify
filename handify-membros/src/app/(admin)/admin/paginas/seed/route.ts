import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

const TERMOS_HTML = `<h1>Termo de Uso</h1>
<p><em>Versão vigente a partir de: 14 de maio de 2026</em></p>

<h2>Preâmbulo</h2>
<p>Este Termo de Uso ("Termo") regula, de forma integral e vinculante, as condições de acesso e utilização dos conteúdos disponibilizados na Plataforma Handify™, gerenciada e operada pela empresa detentora dos direitos sobre os cursos e materiais digitais aqui referenciados ("Empresa" ou "Plataforma").</p>
<p>Ao realizar a aquisição e/ou ao acessar qualquer conteúdo vinculado à Plataforma, o usuário ("Aluno") declara ter lido, compreendido e aceito, integralmente e sem ressalvas, todas as cláusulas e condições deste Termo, bem como a Política de Privacidade da Plataforma.</p>
<p>Caso o Aluno não concorde com qualquer disposição deste Termo, deverá abster-se de utilizar os serviços e, caso já os tenha adquirido, deverá solicitar o cancelamento dentro dos prazos legais previstos.</p>

<h2>1. Definições</h2>
<p>Para os fins deste Termo, adotam-se as seguintes definições:</p>
<ul>
<li><strong>"Plataforma"</strong>: o ambiente virtual (site, aplicativo ou sistema) onde os conteúdos estão hospedados e são disponibilizados ao Aluno.</li>
<li><strong>"Conteúdo"</strong>: todos os materiais digitais disponibilizados na Plataforma, incluindo, mas não se limitando a, videoaulas, apostilas, materiais de apoio, arquivos de áudio, exercícios, avaliações e quaisquer outros recursos pedagógicos.</li>
<li><strong>"Acesso Vitalício"</strong>: direito perpétuo de acesso aos Conteúdos especificamente adquiridos nesta modalidade, condicionado ao cumprimento deste Termo e à manutenção da Plataforma em operação.</li>
<li><strong>"Credenciais de Acesso"</strong>: login, senha e demais dados de autenticação utilizados pelo Aluno para acessar a Plataforma.</li>
</ul>

<h2>2. Objeto do Contrato</h2>
<p>O presente Termo tem por objeto a concessão, pela Empresa, de uma licença de uso não exclusiva, intransferível e limitada, que permite ao Aluno acessar os Conteúdos digitais da Plataforma, de acordo com as condições aqui estabelecidas.</p>
<p>Esta licença é pessoal e não admite cessão, transferência, sublicenciamento ou qualquer forma de compartilhamento com terceiros, seja a título oneroso ou gratuito.</p>

<h2>3. Natureza e Alcance do Acesso</h2>

<h3>3.1. O que está incluído</h3>
<ul>
<li>Acesso permanente a todos os Conteúdos adquiridos pelo Aluno sob esta modalidade.</li>
<li>Flexibilidade para assistir, rever e consumir os materiais no ritmo e horário de preferência do Aluno.</li>
<li>Atualizações de conteúdo realizadas pela Empresa para os módulos já adquiridos, quando e se disponibilizadas, a critério exclusivo da Empresa.</li>
<li>Acesso mediante login e senha pessoais em dispositivos compatíveis com a Plataforma.</li>
</ul>

<h3>3.2. Vigência do Acesso Vitalício</h3>
<p>O acesso vitalício é concedido pelo tempo em que a Plataforma permanecer ativa. A Empresa envidará todos os esforços razoáveis para manter a Plataforma em funcionamento, porém não garante disponibilidade ininterrupta e pode, a qualquer momento e a seu exclusivo critério, encerrar a operação da Plataforma, mediante aviso prévio mínimo de 90 (noventa) dias ao Aluno pelo e-mail cadastrado.</p>

<h2>4. Cadastro, Credenciais e Segurança</h2>
<p>Para acesso aos Conteúdos, o Aluno deverá manter um cadastro válido e atualizado na Plataforma, sendo responsável pela veracidade e atualidade das informações fornecidas.</p>
<p>As Credenciais de Acesso são de uso estritamente pessoal e intransferível. O Aluno é o único responsável pela guarda, sigilo e uso de seu login e senha, sendo vedado:</p>
<ul>
<li>Compartilhar as Credenciais de Acesso com terceiros;</li>
<li>Utilizar as Credenciais de terceiros para acessar a Plataforma;</li>
<li>Permitir acesso simultâneo de múltiplos usuários com as mesmas credenciais.</li>
</ul>
<p>A Plataforma poderá adotar mecanismos de detecção de uso simultâneo ou compartilhamento não autorizado, sendo facultada a suspensão ou rescisão do acesso nessas hipóteses, sem direito à restituição de valores pagos.</p>

<h2>5. Propriedade Intelectual</h2>
<p>Todos os Conteúdos disponibilizados na Plataforma são de titularidade exclusiva da Empresa ou de seus licenciantes, protegidos pelas leis de direitos autorais (Lei nº 9.610/1998), propriedade intelectual e demais legislações aplicáveis.</p>
<p>A aquisição desta licença de uso <strong>NÃO</strong> transfere ao Aluno quaisquer direitos de propriedade intelectual sobre os Conteúdos. Ao Aluno é vedado:</p>
<ul>
<li>Reproduzir, copiar, distribuir, transmitir, publicar ou ceder os Conteúdos a terceiros;</li>
<li>Realizar download não autorizado, captura de tela sistemática ou gravação de videoaulas;</li>
<li>Comercializar, revender ou sublicenciar, total ou parcialmente, os Conteúdos;</li>
<li>Modificar, adaptar, traduzir ou criar obras derivadas baseadas nos Conteúdos sem autorização expressa por escrito;</li>
<li>Utilizar os Conteúdos para fins comerciais ou treinamentos corporativos sem prévia autorização.</li>
</ul>

<h2>6. Conduta Esperada e Proibições</h2>
<p>O Aluno compromete-se a utilizar os Conteúdos exclusivamente para fins de aprendizado pessoal. São expressamente proibidas:</p>
<ul>
<li>Práticas que possam prejudicar a Plataforma, seus sistemas ou outros usuários;</li>
<li>Tentativas de acesso não autorizado a áreas restritas da Plataforma;</li>
<li>Uso de softwares, bots, scrapers ou ferramentas automatizadas para extrair dados ou Conteúdos;</li>
<li>Qualquer conduta que viole a legislação brasileira vigente ou direitos de terceiros.</li>
</ul>

<h2>7. Pagamento e Política de Reembolso</h2>
<p>O acesso à Plataforma é condicionado ao pagamento integral do valor estabelecido no momento da aquisição, nas condições acordadas entre as partes.</p>
<p>Por se tratar de produto digital com disponibilização imediata após a confirmação do pagamento, aplica-se o direito de arrependimento previsto no art. 49 do Código de Defesa do Consumidor (Lei nº 8.078/1990), conferindo ao Aluno o prazo de <strong>7 (sete) dias corridos</strong>, contados da data da compra, para solicitar o cancelamento e o reembolso integral.</p>
<p>Após o período de 7 (sete) dias e/ou após o consumo substancial dos Conteúdos, não haverá direito a reembolso, salvo nas hipóteses de vício ou defeito do produto digital devidamente comprovado.</p>

<h2>8. Suporte Técnico</h2>
<p>A Empresa disponibiliza suporte técnico ao Aluno relacionado ao funcionamento e ao acesso da Plataforma. O suporte é limitado a questões técnicas e operacionais, não abrangendo consultorias ou acompanhamentos pedagógicos individuais não contratados.</p>

<h2>9. Disponibilidade e Manutenção da Plataforma</h2>
<p>A Empresa empregará esforços razoáveis para garantir a disponibilidade contínua da Plataforma, porém não se responsabiliza por interrupções temporárias decorrentes de manutenções programadas, falhas técnicas, ataques cibernéticos ou casos fortuitos e de força maior.</p>
<p>A Empresa reserva-se o direito de alterar, atualizar, remover ou substituir Conteúdos a qualquer momento, visando à qualidade e à atualização pedagógica, sem que isso configure inadimplemento contratual.</p>

<h2>10. Privacidade e Proteção de Dados Pessoais</h2>
<p>O tratamento dos dados pessoais do Aluno é regulado pela Política de Privacidade da Plataforma, em conformidade com a Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018).</p>
<p>Ao aceitar este Termo, o Aluno consente com o tratamento de seus dados pessoais para as finalidades de: (i) gerenciamento do acesso aos Conteúdos; (ii) comunicações relacionadas ao serviço; (iii) cumprimento de obrigações legais; e (iv) melhoria contínua da Plataforma.</p>

<h2>11. Limitação de Responsabilidade</h2>
<p>A Empresa não se responsabiliza por: (i) resultados pessoais, profissionais ou financeiros decorrentes do uso dos Conteúdos; (ii) interpretações equivocadas das informações fornecidas; (iii) danos indiretos, incidentais ou consequentes; (iv) perdas decorrentes do uso indevido das Credenciais de Acesso pelo Aluno.</p>
<p>Os Conteúdos têm caráter exclusivamente educacional e informativo, não substituindo consultas profissionais especializadas. A responsabilidade total da Empresa, em qualquer hipótese, fica limitada ao valor pago pelo Aluno.</p>

<h2>12. Rescisão e Suspensão do Acesso</h2>
<p>A Empresa poderá suspender ou rescindir o acesso do Aluno, com ou sem aviso prévio, nas seguintes situações:</p>
<ul>
<li>Violação de qualquer disposição deste Termo;</li>
<li>Compartilhamento não autorizado de Credenciais de Acesso;</li>
<li>Reprodução, distribuição ou comercialização não autorizada dos Conteúdos;</li>
<li>Prática de atos ilícitos ou fraudulentos relacionados à Plataforma.</li>
</ul>
<p>Em caso de rescisão motivada por infração do Aluno, não haverá direito a reembolso dos valores pagos.</p>

<h2>13. Alterações neste Termo</h2>
<p>A Empresa reserva-se o direito de alterar este Termo a qualquer momento. Alterações substanciais serão comunicadas ao Aluno por e-mail cadastrado e/ou mediante aviso em destaque na Plataforma, com antecedência mínima de 15 (quinze) dias.</p>

<h2>14. Disposições Gerais</h2>
<p>A invalidade ou nulidade de qualquer cláusula deste Termo não afetará as demais disposições, que permanecerão em pleno vigor.</p>
<p>Este Termo constitui o acordo integral entre as partes em relação ao seu objeto, substituindo quaisquer entendimentos anteriores, verbais ou escritos.</p>

<h2>15. Foro e Lei Aplicável</h2>
<p>Este Termo é regido pelas leis da República Federativa do Brasil. Para a resolução de quaisquer litígios decorrentes deste Termo, as partes elegem o Foro da Comarca da sede da Empresa, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>
<p>Antes de recorrer ao Judiciário, as partes comprometem-se a buscar, de boa-fé, a resolução amigável de eventuais conflitos, por meio dos canais de atendimento da Plataforma.</p>

<hr>
<p><em>Documento gerado em 14 de maio de 2026</em></p>`;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  const { error } = await service.from("static_pages").upsert(
    {
      slug: "termos",
      title: "Termo de Uso",
      blocks: [{ type: "html", content: TERMOS_HTML, position: 0 }],
      published: true,
    },
    { onConflict: "slug", ignoreDuplicates: false }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.redirect(new URL("/admin/paginas", process.env.NEXT_PUBLIC_APP_URL!));
}
