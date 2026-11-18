-- Dados da empresa que vão no recibo (CNPJ, telefone, Instagram, e-mail e a logo).
-- Ficam no banco, não no código: o repositório é público. Uma linha só (id = 1); dados = JSON.
CREATE TABLE empresa (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  dados TEXT NOT NULL DEFAULT '{}',
  logo TEXT,                 -- data:image/png;base64,... (a tela reduz pra 256 px antes de mandar)
  alterado_em TEXT
);
INSERT INTO empresa (id) VALUES (1);
