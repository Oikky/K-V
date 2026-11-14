-- Cartões de crédito da K&V e o que foi pago em cada um. O gasto cai na fatura pelo dia que o cartão fecha.

CREATE TABLE cartoes (
  id         INTEGER PRIMARY KEY,
  nome       TEXT NOT NULL,                  -- ex.: "Nubank do dono"
  final      TEXT NOT NULL DEFAULT '',       -- 4 últimos números
  fecha      INTEGER NOT NULL CHECK (fecha BETWEEN 1 AND 31),  -- dia em que a fatura fecha
  vence      INTEGER NOT NULL CHECK (vence BETWEEN 1 AND 31),  -- dia em que a fatura vence
  limite     INTEGER,                        -- centavos; nulo = não anotado
  ativo      INTEGER NOT NULL DEFAULT 1,
  criado_em  TEXT NOT NULL
);

-- entrada de pontos com custo (compra, clube, transferência): em qual cartão e em quantas vezes
ALTER TABLE movimentos ADD COLUMN cartao_id INTEGER REFERENCES cartoes(id);
ALTER TABLE movimentos ADD COLUMN parcelas INTEGER NOT NULL DEFAULT 1;

-- emissão: o que foi pago no cartão (taxa de embarque, ou a passagem inteira quando sai em dinheiro)
ALTER TABLE emissoes ADD COLUMN cartao_id INTEGER REFERENCES cartoes(id);
ALTER TABLE emissoes ADD COLUMN pago INTEGER NOT NULL DEFAULT 0;   -- centavos

-- quando o dinheiro do cliente deve entrar (a K&V recebe de uma vez, mesmo no parcelado)
ALTER TABLE orcamentos ADD COLUMN receb_previsto TEXT;
