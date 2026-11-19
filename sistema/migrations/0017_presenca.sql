-- Quem está com um orçamento aberto agora (tela do orçamento ou barra da extensão).
-- A tela avisa a cada 30 s; quem não avisou nos últimos 90 s já saiu. Linhas de mais de um dia são apagadas.
CREATE TABLE presenca (
  orcamento_id INTEGER NOT NULL,
  email        TEXT NOT NULL,
  em           TEXT NOT NULL,
  PRIMARY KEY (orcamento_id, email)
);
