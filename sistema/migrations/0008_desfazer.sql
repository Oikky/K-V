-- Tudo tem volta: desfazer emissão, apagar ou corrigir entrada e saída, cancelar passagem, vaga extra de beneficiário.

-- de quais lotes saíram os pontos de cada saída. Desfazer a saída devolve os pontos exatamente pros mesmos lotes.
-- (saídas de antes desta tabela não têm registro: a devolução enche de novo os lotes que vencem antes)
CREATE TABLE consumos (
  saida_id  INTEGER NOT NULL REFERENCES movimentos(id),
  lote_id   INTEGER NOT NULL REFERENCES movimentos(id),
  pontos    INTEGER NOT NULL CHECK (pontos > 0),
  PRIMARY KEY (saida_id, lote_id)
);
CREATE INDEX consumos_lote ON consumos(lote_id);

-- passagem cancelada no programa: quando, e se o CPF continua ocupando a vaga de beneficiário
ALTER TABLE emissoes ADD COLUMN cancelada_em TEXT;
ALTER TABLE emissoes ADD COLUMN cancelada_obs TEXT NOT NULL DEFAULT '';

-- observação da emissão (vai junto na saída de pontos)
ALTER TABLE emissoes ADD COLUMN obs TEXT NOT NULL DEFAULT '';

-- movimento importado: a linha de onde veio no documento antigo (tabela superhuman), pra mostrar os dados do voo
ALTER TABLE movimentos ADD COLUMN coda_id TEXT;

-- vagas de beneficiário a mais numa conta (o programa liberou mais pra essa conta). Sem "ate", vale até alguém desligar.
CREATE TABLE vagas_extras (
  id         INTEGER PRIMARY KEY,
  conta_id   INTEGER NOT NULL REFERENCES contas(id),
  vagas      INTEGER NOT NULL CHECK (vagas > 0),
  ate        TEXT,                           -- AAAA-MM-DD; depois desse dia deixa de contar
  motivo     TEXT NOT NULL DEFAULT '',
  criada_em  TEXT NOT NULL,
  criada_por TEXT NOT NULL,
  desligada_em TEXT
);
CREATE INDEX vagas_extras_conta ON vagas_extras(conta_id);
