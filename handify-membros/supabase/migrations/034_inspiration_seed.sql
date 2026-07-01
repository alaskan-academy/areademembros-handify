-- ── Seed: migração dos 8 posts da biblioteca-handify ─────────────────────────
-- Fonte: github.com/alaskan-academy/biblioteca-handify/data/posts.json
-- Executar APÓS a migration 033.
-- Requer ao menos 1 admin na tabela profiles.

do $$
declare
  v_admin_id uuid;
begin
  -- Usa o primeiro admin cadastrado como autor dos posts migrados
  select id into v_admin_id
  from profiles
  where role = 'admin'
  order by created_at asc
  limit 1;

  if v_admin_id is null then
    raise exception 'Nenhum admin encontrado em profiles. Cadastre um admin antes de rodar este seed.';
  end if;

  -- ── Post 1: Sabonete Natural de Aloe Vera e Matcha (receita) ────────────────
  insert into inspiration_posts (
    author_id, type, title, body, media, recipe_data, tags, published
  ) values (
    v_admin_id,
    'receita',
    'Sabonete Natural de Aloe Vera e Matcha',
    'Sabonete hidratante, regenerador e suave para rosto e corpo, feito com gel fresco de aloe vera e matcha. Perfeito para peles ressecadas ou sensibilizadas, com acabamento marmorizado elegante.',
    '[{"url": "assets/sabonete-aloe-vera-matcha.png", "alt": "Sabonete de Aloe Vera e Matcha", "order": 0}]',
    '{
      "ingredientes": [
        {"item": "Base glicerinada branca", "quantidade": "300g"},
        {"item": "Base glicerinada transparente", "quantidade": "300g"},
        {"item": "Gel fresco de aloe vera (15g por base)", "quantidade": "30g"},
        {"item": "Matcha em pó", "quantidade": "4g"},
        {"item": "Óleo essencial de palmarosa", "quantidade": "20 gotas"},
        {"item": "Óleo essencial de alecrim", "quantidade": "20 gotas"},
        {"item": "Álcool 70% para borrifar", "quantidade": "a gosto"}
      ],
      "passos": [
        "24h antes: corte uma folha madura de aloe vera na base e deixe inclinada ou em pé por 24 horas para eliminar a aloína (líquido amarelado que pode irritar a pele).",
        "Corte as duas bases glicerinadas em cubos de ~1cm. Derreta cada uma separadamente em banho-maria até atingir 65°C a 70°C. Reserve em recipientes distintos.",
        "Com as bases ainda acima de 60°C, adicione 15g de gel de aloe vera em cada recipiente. Misture imediatamente para incorporar antes que o gel forme grumos.",
        "Prepare a pasta de matcha: misture 4g de matcha com algumas borrifadas de álcool até formar uma pasta homogênea. Divida em partes iguais (2g por base) e misture delicadamente em cada uma.",
        "Quando as bases atingirem entre 55°C e 60°C, adicione 20 gotas de óleo essencial de palmarosa e 20 de alecrim. Mexa suavemente. Nunca adicione óleos acima de 60°C.",
        "Aguarde ambas as bases esfriarem entre 50°C e 55°C — devem estar mais espessas, mas ainda fluidas. Esse é o ponto ideal para a marmorização.",
        "Despeje pequenas quantidades alternadas das duas bases no molde, fazendo pausas entre as camadas. Não despeje tudo de uma vez, ou os tons se misturam e o efeito desaparece.",
        "Borrife álcool 70% na superfície para eliminar bolhas de ar.",
        "Aguarde 4 a 5 horas para endurecer. Desenforme, corte em barras de 1,5 a 2cm. Embale em filme PVC e etiquete com nome, peso, ingredientes e data de fabricação."
      ],
      "tempo": "5h (+ 24h de preparo do aloe vera)",
      "temperatura": "65°C–70°C (derretimento) / 55°C–60°C (óleos essenciais) / 50°C–55°C (marmorização)",
      "nivel": "Intermediário",
      "dicas": "Misture o matcha com álcool antes de adicionar à base — isso evita manchas e grumos. E nunca adicione os óleos essenciais acima de 60°C: o calor evapora o aroma antes do sabonete endurecer.",
      "paleta_cores": ["#A8C896", "#2D6A3F", "#E8F0E4", "#C8B89A"],
      "custo_medio": "R$ 3,20 por barra (lote de 6 unidades = R$ 17,00)",
      "preco_venda": "R$ 15 – R$ 22 por barra de 100g"
    }',
    array['sabonetes'],
    true
  );

  -- ── Post 2: Sabonete de Arroz Artesanal (receita) ────────────────────────────
  insert into inspiration_posts (
    author_id, type, title, body, media, recipe_data, tags, published
  ) values (
    v_admin_id,
    'receita',
    'Sabonete de Arroz Artesanal',
    'Inspirado nos tradicionais cuidados asiáticos com a pele, este sabonete combina farinha de arroz, leite em pó e amido de milho. Resulta em uma barra cremosa, suave e ideal para uso diário no rosto e no corpo.',
    '[{"url": "assets/sabonete-arroz-artesanal.png", "alt": "Sabonete de Arroz Artesanal", "order": 0}]',
    '{
      "ingredientes": [
        {"item": "Base glicerinada branca (ou base de coco)", "quantidade": "250g"},
        {"item": "Farinha de arroz fina (triturada na hora)", "quantidade": "10g"},
        {"item": "Amido de milho (maizena)", "quantidade": "5g"},
        {"item": "Leite em pó integral", "quantidade": "10g"},
        {"item": "Álcool 70% para higienizar e borrifar", "quantidade": "a gosto"}
      ],
      "passos": [
        "Prepare a farinha de arroz: triture arroz cru e seco em moedor de café. Passe por peneira fina e descarte os grânulos maiores. Não use liquidificador comum — os grãos ficam grandes e irritam a pele.",
        "Corte a base glicerinada em cubos pequenos e derreta em banho-maria entre 65°C e 70°C, mexendo suavemente até fusão completa.",
        "Com a base acima de 60°C, adicione a farinha de arroz (10g) e misture bem. Se surgirem grumos, pressione-os contra a lateral do recipiente até dissolver.",
        "Adicione o amido de milho (5g) e misture. Em seguida adicione o leite em pó (10g) e misture até homogeneizar completamente.",
        "Se a base começar a engrossar antes da hora, mantenha o recipiente sobre a água quente do banho-maria com o fogo desligado.",
        "Higienize o molde com álcool. Quando a mistura atingir 55°C a 60°C, despeje lentamente nas cavidades.",
        "Borrife álcool 70% sobre a superfície para eliminar bolhas de ar.",
        "Aguarde 40 a 45 minutos. Desenforme e embale imediatamente em filme PVC para evitar o suor da glicerina."
      ],
      "tempo": "45 min",
      "temperatura": "65°C–70°C (derretimento) / 55°C–60°C (enformagem)",
      "nivel": "Iniciante",
      "dicas": "Trabalhe com a base bem líquida ao adicionar os pós — isso evita grumos. E embale logo após desenformar: a glicerina transpira rapidamente e o filme PVC preserva a aparência e a durabilidade da barra.",
      "paleta_cores": ["#F5F0E8", "#E8DDD0", "#FFFFFF", "#D4C5B0"],
      "custo_medio": "R$ 1,90 – R$ 2,10 por barra (lote de 4 = R$ 6,75)",
      "preco_venda": "R$ 12 – R$ 18 por barra de 65g"
    }',
    array['sabonetes'],
    true
  );

  -- ── Post 3: Sabonete Redondo com Flores Secas (foto/inspiração) ─────────────
  insert into inspiration_posts (
    author_id, type, title, body, media, recipe_data, tags, published
  ) values (
    v_admin_id,
    'foto',
    'Sabonete Redondo com Flores Secas',
    'Sabonetes redondos com pétalas de rosas e flores secas prensadas na superfície. O acabamento rústico e romântico transforma cada barra em um presente sofisticado — com apelo visual alto e custo de produção acessível. Ideal para Dia das Mães, casamentos e kits especiais.',
    '[{"url": "assets/sabonete-flores-secas-redondo.png", "alt": "Sabonete Redondo com Flores Secas", "order": 0}]',
    '{
      "como_fazer": [
        "Derreta base glicerinada branca ou transparente em banho-maria (65–70°C).",
        "Despeje no molde redondo até a metade e aguarde ~2 minutos até formar uma película fina na superfície.",
        "Disponha pétalas de rosas secas e flores desidratadas sobre a película ainda mole, pressionando levemente.",
        "Complete o molde com mais base a 55–60°C e borrife álcool para eliminar bolhas e fixar as flores.",
        "Aguarde 45 minutos em temperatura ambiente. Desenforme delicadamente e embale em filme PVC imediatamente."
      ],
      "paleta_cores": ["#F5EDE0", "#D4A5A5", "#8B5E52", "#F9F5F0"],
      "custo_medio": "R$ 3,50 – R$ 4,50 por unidade",
      "preco_venda": "R$ 18 – R$ 28 por unidade"
    }',
    array['sabonetes'],
    true
  );

  -- ── Post 4: Sabonete com Margaridas Decorativas (foto/inspiração) ────────────
  insert into inspiration_posts (
    author_id, type, title, body, media, recipe_data, tags, published
  ) values (
    v_admin_id,
    'foto',
    'Sabonete com Margaridas Decorativas',
    'Sabonetes retangulares brancos decorados com margaridas artesanais em tons de rosa e branco. O acabamento floral delicado confere um visual de alto padrão que justifica preços premium — ideal para lembrancinhas de festas, presentes corporativos e kits de beleza personalizados.',
    '[{"url": "assets/sabonete-margaridas-decorativas.png", "alt": "Sabonete com Margaridas Decorativas", "order": 0}]',
    '{
      "como_fazer": [
        "Modele as margaridas com argila específica para sabonetes, massa de modelar própria ou com a própria base glicerinada colorida derretida em moldes de flores. Deixe secar por pelo menos 2 horas antes de aplicar.",
        "Derreta a base glicerinada branca (65–70°C) e despeje no molde retangular. Aguarde solidificar completamente — não tente trabalhar antes.",
        "Lixe levemente a base das flores secas para criar uma superfície porosa e melhorar a aderência.",
        "Aplique uma pequena quantidade de base glicerinada derretida (como cola) no verso das flores e pressione-as sobre o sabonete.",
        "Deixe fixar por 15–20 minutos. Embale individualmente em filme PVC logo após para proteger as decorações."
      ],
      "paleta_cores": ["#FFFFFF", "#F2C4D0", "#D4769A", "#BDBDBD"],
      "custo_medio": "R$ 4,00 – R$ 5,50 por unidade",
      "preco_venda": "R$ 20 – R$ 30 por unidade"
    }',
    array['sabonetes'],
    true
  );

  -- ── Post 5: Buquê de Velas Florais (foto/inspiração) ────────────────────────
  insert into inspiration_posts (
    author_id, type, title, body, media, recipe_data, tags, published
  ) values (
    v_admin_id,
    'foto',
    'Buquê de Velas Florais',
    'Velas artesanais moldadas em formato de flores — rosas, peônias e flores silvestres — agrupadas como um buquê real em tons creme, rosé e branco. O resultado é visualmente indistinguível de um buquê de flores verdadeiras, com o apelo extra de ser um presente funcional e durável. Uma das peças com maior percepção de valor e potencial de venda em datas comemorativas.',
    '[{"url": "assets/buque-velas-florais.png", "alt": "Buquê de Velas Florais", "order": 0}]',
    '{
      "como_fazer": [
        "Derreta cera ecomix e adicione corante líquido nos tons desejados: creme, rosé suave e branco puro. Prepare cada cor separadamente.",
        "Despeje a cera colorida em moldes de flores (rosas, peônias, tulipas) e insira o palito de bambu no centro enquanto ainda está mole para facilitar a montagem do buquê.",
        "Aguarde endurecer completamente (30 a 45 minutos), desenforme com cuidado e repita até ter flores suficientes para o volume desejado.",
        "Agrupe as velas como um buquê, variando alturas e cores. Amarre com fita de cetim, envolva em papel celofane e finalize com laço decorativo."
      ],
      "paleta_cores": ["#F5EAD8", "#D4A89A", "#C49A7A", "#FFFFFF"],
      "custo_medio": "R$ 28 – R$ 40 por buquê (12 velas)",
      "preco_venda": "R$ 90 – R$ 160 por buquê"
    }',
    array['velas'],
    true
  );

  -- ── Post 6: Sabonete Artesanal de Cacau e Canela (receita) ──────────────────
  insert into inspiration_posts (
    author_id, type, title, body, media, recipe_data, tags, published
  ) values (
    v_admin_id,
    'receita',
    'Sabonete Artesanal de Cacau e Canela',
    'Sabonete nutritivo e aromático com manteiga de cacau, cacau puro e canela — toque hidratante profundo, aroma aconchegante de especiarias e efeito marmorizado que imita o chocolate. Rende 2 barras massageadoras de 100g com visual sofisticado e apelo premium. Perfeito para kits de inverno, presentes corporativos e linhas de autocuidado.',
    '[{"url": "assets/sabonete-cacau-canela.png", "alt": "Sabonete de Cacau e Canela", "order": 0}]',
    '{
      "ingredientes": [
        {"item": "Base glicerinada branca de coco", "quantidade": "200g (100g por parte)"},
        {"item": "Manteiga de cacau", "quantidade": "10g"},
        {"item": "Cacau em pó 100% puro", "quantidade": "5g"},
        {"item": "Canela em pó", "quantidade": "2g"},
        {"item": "Óleo essencial de cravo (ou canela)", "quantidade": "15 gotas"},
        {"item": "Corante cosmético marrom (opcional)", "quantidade": "2 gotas"},
        {"item": "Álcool de cereais para borrifar", "quantidade": "a gosto"}
      ],
      "passos": [
        "Corte a base glicerinada em cubos pequenos e uniformes — cubos menores derretem mais rápido e reduzem o risco de superaquecimento.",
        "Derreta em banho-maria a 65°C–70°C, mexendo suavemente até fusão completa. Divida em dois recipientes com 100g cada.",
        "Parte escura: adicione 5g de cacau em pó e 2g de canela. Mexa com calma, pressionando os grumos contra a lateral do recipiente até dissolver. Para cor mais intensa, acrescente 2 gotas de corante marrom.",
        "Parte clara: adicione 10g de manteiga de cacau picada em pedaços pequenos e misture até incorporação completa — o próprio calor da base derrete a manteiga.",
        "Quando ambas atingirem 55°C–60°C, adicione 15 gotas de óleo essencial de cravo (ou canela) em cada base. Mexa delicadamente. Nunca adicione acima de 60°C — o calor evapora o aroma.",
        "Aguarde as bases esfriarem até 50°C–55°C: devem estar mais espessas, mas ainda fluidas. Esse é o ponto exato para o efeito marmorizado.",
        "Pegue os dois recipientes simultaneamente e despeje as duas bases ao mesmo tempo no molde — deixe os tons se misturarem naturalmente para criar o efeito chocolate com creme.",
        "Borrife álcool sobre a superfície para eliminar bolhas. Aguarde 40 minutos, desenforme e embale em filme PVC com cinta de papel kraft. Destaque os ingredientes naturais na embalagem."
      ],
      "tempo": "40 min",
      "temperatura": "65°C–70°C (derretimento) / 55°C–60°C (óleos essenciais) / 50°C–55°C (enformagem marmorizada)",
      "nivel": "Iniciante",
      "dicas": "Pique a manteiga de cacau em pedaços bem pequenos — ela derrete no próprio calor da base, sem precisar de fogo extra. Para o efeito marmorizado perfeito, despeje as duas bases ao mesmo tempo e resista à tentação de mexer: os tons se misturam sozinhos e o resultado é muito mais bonito.",
      "paleta_cores": ["#4A2518", "#8B5E3C", "#D4A882", "#F5F0E8"],
      "custo_medio": "R$ 3,80 – R$ 4,00 por barra de 100g (lote de 2 barras = R$ 7,15)",
      "preco_venda": "R$ 18 – R$ 35 por barra de 100g"
    }',
    array['sabonetes'],
    true
  );

  -- ── Post 7: Vela Floral Individual (foto/inspiração) ────────────────────────
  insert into inspiration_posts (
    author_id, type, title, body, media, recipe_data, tags, published
  ) values (
    v_admin_id,
    'foto',
    'Vela Floral Individual — A Lembrancinha Acessível',
    'Uma única vela moldada em formato de rosa, apresentada como mini buquê em papel kraft com gypsophila e laço de cetim. A alternativa perfeita para clientes que amam a ideia do buquê de velas, mas têm orçamento mais limitado — ou para quem quer oferecer lembrancinhas individuais em casamentos, formaturas e aniversários. Com custo de produção baixo e acabamento encantador, essa peça prova que elegância não precisa de volume.',
    '[{"url": "assets/vela-floral-individual.png", "alt": "Vela Floral Individual", "order": 0}]',
    '{
      "como_fazer": [
        "Derreta cera ecomix e adicione corante líquido creme ou branco. Insira o pavio no centro do molde de rosa antes de despejar a cera.",
        "Despeje a cera no molde. Quando começar a firmar (ainda macia), insira o palito de bambu na parte superior da vela. Aguarde endurecer completamente (30 a 40 minutos) e desenforme com cuidado.",
        "Prepare a embalagem: corte um quadrado de papel kraft e um quadrado de tule. Sobreponha os dois e posicione a vela no centro, com raminhos de gypsophila (mosquitinho) ao redor.",
        "Envolva formando um mini bouquet, ajuste os raminhos e feche com fita de cetim em laço caprichado.",
        "Personalize com uma tag escrita à mão ou impressa — esse detalhe aumenta o valor percebido e justifica um preço premium mesmo sendo uma peça só."
      ],
      "paleta_cores": ["#C8A882", "#F5F0E8", "#E8D8C0", "#F9F6F0"],
      "custo_medio": "R$ 4 – R$ 7 por unidade",
      "preco_venda": "R$ 18 – R$ 35 por unidade"
    }',
    array['velas'],
    true
  );

  -- ── Post 8: Buquê de Velas Artesanais Florivelas (receita) ─────────────────
  insert into inspiration_posts (
    author_id, type, title, body, media, recipe_data, tags, published
  ) values (
    v_admin_id,
    'receita',
    'Buquê de Velas Artesanais (Florivelas)',
    'Arranjo decorativo de velas moldadas em formato de flores — rosas, corações e margaridas — montadas como um buquê em caixa presente. Combina velas aromáticas de cera de soja com flores secas decorativas, criando um presente de alto valor percebido. Rende 18 a 25 flores por buquê, com custo de produção em torno de R$ 45 e potencial de venda até R$ 299.',
    '[{"url": "assets/buque-velas-florivelas.png", "alt": "Buquê de Velas Artesanais Florivelas", "order": 0}]',
    '{
      "ingredientes": [
        {"item": "Cera de soja para moldes (alto ponto de fusão)", "quantidade": "665g"},
        {"item": "Essência para velas", "quantidade": "35g"},
        {"item": "Corante para velas (rosa e branco)", "quantidade": "a gosto"},
        {"item": "Pavios encerados", "quantidade": "18-25 unidades"},
        {"item": "Moldes de flores variados", "quantidade": "conforme o buquê"},
        {"item": "Palitos de bambu (tipo espetinho)", "quantidade": "18-25 unidades"},
        {"item": "Espuma floral", "quantidade": "1 bloco"},
        {"item": "Papel coreano ou papel seda", "quantidade": "a gosto"},
        {"item": "Flores secas e pampas decorativas", "quantidade": "a gosto"},
        {"item": "Embalagem para buquê", "quantidade": "1 unidade"}
      ],
      "passos": [
        "Prepare os moldes: faça um furo central com punção, passe o pavio pelo centro e centralize bem. Um pavio bem posicionado garante melhor acabamento e queima uniforme.",
        "Derreta a cera de soja lentamente até atingir 90°C a 95°C. Nunca ultrapasse 100°C para não prejudicar a qualidade.",
        "Divida a cera conforme as cores: 150g para branco e 515g para rosa. Adicione o corante ainda com a cera quente. Teste o tom pingando uma gota em superfície fria antes de enformar.",
        "Quando a cera atingir 65°C, adicione os 35g de essência e misture por 2 minutos.",
        "Com a temperatura entre 60°C e 65°C, despeje nos moldes. Para efeito degradê: coloque uma camada branca, aguarde alguns segundos e complete com a cera colorida — isso cria um acabamento mais sofisticado.",
        "Quando a vela começar a firmar, insira o palito de bambu na metade superior da peça, sem encostar no fundo. Se o palito não ficar em pé, aguarde mais alguns minutos.",
        "Aguarde 2 horas de cura. Desenforme as flores com cuidado e faça os acabamentos necessários.",
        "Monte a base do buquê: corte um bloco de espuma floral, envolva com papel seda e posicione dentro da embalagem.",
        "Insira as velas começando pelas flores maiores no centro, depois as médias e as menores nas bordas — varie alturas para criar profundidade.",
        "Preencha os espaços vazios com pampas, sempre-vivas e flores secas. O destaque deve ser sempre das velas — os complementos são apenas preenchimento."
      ],
      "tempo": "2h de cura + preparo e montagem",
      "temperatura": "90°C-95°C (derretimento) / 65°C (essência) / 60°C-65°C (enformagem)",
      "nivel": "Intermediário",
      "dicas": "Centralize bem o pavio para um acabamento mais limpo. Teste sempre o tom do corante antes de enformar — uma gota em superfície fria mostra a cor real. Para o efeito degradê, despeje uma camada branca, aguarde alguns segundos e complete com a cera colorida: o resultado é muito mais sofisticado e aumenta o valor percebido do produto.",
      "paleta_cores": ["#F5A0B5", "#FFFFFF", "#F9C8D8", "#E8D5C0"],
      "custo_medio": "R$ 45,00 por buquê (18-25 flores)",
      "preco_venda": "R$ 79 – R$ 299 conforme tamanho (pequeno, médio ou grande)"
    }',
    array['velas'],
    true
  );

  raise notice 'Seed concluído: 8 posts migrados da biblioteca-handify para inspiration_posts.';
end;
$$;
