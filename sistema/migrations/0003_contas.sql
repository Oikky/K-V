-- Contas: número de fidelidade e mensalidade do clube; movimentos: de onde veio uma transferência de fora do sistema
ALTER TABLE contas ADD COLUMN numero TEXT;
ALTER TABLE contas ADD COLUMN clube_custo INTEGER;          -- centavos por mês
ALTER TABLE movimentos ADD COLUMN origem TEXT;             -- entrada de transferência: programa de onde veio (ex.: Livelo)
