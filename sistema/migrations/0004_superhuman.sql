-- Importação do documento antigo (Superhuman Docs, ex-Coda).
-- A importação pode rodar de novo até a virada: ela apaga o que importou antes (lista em "importado") e importa outra vez.

-- situação da conta e cartão usado (vinha em texto livre no documento antigo)
ALTER TABLE contas ADD COLUMN obs TEXT NOT NULL DEFAULT '';

-- cada linha que a importação criou no sistema
CREATE TABLE importado (
  tabela  TEXT NOT NULL,                     -- pessoas, contas, movimentos, orcamentos, opcoes, ponto
  id      INTEGER NOT NULL,
  PRIMARY KEY (tabela, id)
);

-- cópia de todas as linhas do documento antigo, inclusive as que não têm lugar no sistema (recibos, voos, check-in)
CREATE TABLE superhuman (
  tabela   TEXT NOT NULL,                    -- nome da tabela no documento antigo
  coda_id  TEXT NOT NULL,                    -- código da linha lá
  dados    TEXT NOT NULL,                    -- JSON com as colunas preenchidas
  PRIMARY KEY (tabela, coda_id)
);
