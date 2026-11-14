-- roteiros alternativos no mesmo orçamento (A = 0, B = 1...): a ordem continua sendo a posição geral do trecho
ALTER TABLE trechos ADD COLUMN roteiro INTEGER NOT NULL DEFAULT 0;
