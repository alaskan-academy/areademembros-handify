-- Garante que todos os valores necessários existem no enum banner_slot
alter type banner_slot add value if not exists 'header';
alter type banner_slot add value if not exists 'lateral';
alter type banner_slot add value if not exists 'pos-aula';
