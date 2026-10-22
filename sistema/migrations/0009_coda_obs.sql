-- Movimentos importados do documento antigo: liga cada um à linha original (tabela superhuman) e traz o campo
-- "Informações" inteiro pra observação. A ligação é pelo instante em que a linha foi criada lá + os pontos
-- (a importação gravou esse instante em criado_em). Não reimporta nada e não mexe no que a equipe já lançou.

UPDATE movimentos SET coda_id = (
  SELECT s.coda_id FROM superhuman s
  WHERE s.tabela = CASE movimentos.lado WHEN 'entrada' THEN 'Entrada' ELSE 'Saída' END
    AND json_extract(s.dados, '$.criado') = movimentos.criado_em
    AND json_extract(s.dados, '$.Pontos') = movimentos.pontos
  LIMIT 1)
WHERE criado_por = 'superhuman' AND coda_id IS NULL;

-- o texto inteiro, sem os dois espaços que o documento punha no fim de cada linha
UPDATE movimentos SET obs = (
  -- (na emissão, a tela monta o título "passageiro · rota" a partir das duas primeiras linhas desse texto)
  SELECT trim(replace(replace(json_extract(s.dados, '$."Informações"'), '  ' || char(10), char(10)), char(13), ''))
  FROM superhuman s WHERE s.coda_id = movimentos.coda_id AND s.tabela IN ('Entrada', 'Saída'))
WHERE criado_por = 'superhuman' AND coda_id IS NOT NULL
  AND (SELECT json_extract(s.dados, '$."Informações"') FROM superhuman s WHERE s.coda_id = movimentos.coda_id AND s.tabela IN ('Entrada', 'Saída')) IS NOT NULL;
