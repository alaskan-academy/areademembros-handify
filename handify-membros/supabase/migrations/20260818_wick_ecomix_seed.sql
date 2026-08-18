-- Seed de recomendações para Ecomix (blend soja+parafina muito popular no Brasil)
INSERT INTO public.wick_recommendations
  (candle_type, wax_type, diameter_min, diameter_max, fragrance_min, fragrance_max, wick_primary, wick_alternatives, notes, priority)
VALUES
('container','ecomix', 4, 7,  0, 8, 'LX 10', ARRAY['CD 10','ECO 3'],
 'Ecomix tem comportamento próximo ao da cera de soja. Pavio semelhante é um bom ponto de partida — sempre faça o teste de queima.', 1),
('container','ecomix', 7, 9,  0, 8, 'LX 14', ARRAY['CD 14','ECO 6'],
 'Tamanho mais comum. A formulação exata do Ecomix pode variar — ajuste conforme o resultado do seu teste.', 1),
('container','ecomix', 9, 11, 0, 8, 'LX 18', ARRAY['CD 18','ECO 10'], null, 1),
('container','ecomix',11, 99, 0, 8, 'LX 22', ARRAY['CD 20'],          'Para potes acima de 12 cm, considere 2 pavios LX 14.', 1),
('container','ecomix', 4, 7,  8,99, 'LX 8',  ARRAY['CD 8'],  'Com alta fragrância, vá um tamanho abaixo do usual.', 2),
('container','ecomix', 7, 9,  8,99, 'LX 12', ARRAY['CD 12'], null, 2),
('container','ecomix', 9, 11, 8,99, 'LX 16', ARRAY['CD 16'], null, 2),
('container','ecomix',11, 99, 8,99, 'LX 20', ARRAY['CD 18'], null, 2);
