-- Banco do sistema K&V (Cloudflare D1, SQLite).
-- Regras: pontos e dinheiro em inteiros (dinheiro em centavos; valor da milha em milionésimos de real).
-- Datas em texto ISO: dia 'AAAA-MM-DD', momento 'AAAA-MM-DDTHH:MM:SS.sssZ' (UTC).
-- Glossário dos nomes em CONTEXT.md.

-- ---------- quem usa o sistema ----------
CREATE TABLE usuarios (
  email      TEXT PRIMARY KEY,               -- o mesmo e-mail do login (Cloudflare Access)
  nome       TEXT NOT NULL,
  papel      TEXT NOT NULL CHECK (papel IN ('dono', 'pesquisador', 'admin')), -- admin: o programador; pode o mesmo que o dono
  pesquisa   INTEGER NOT NULL DEFAULT 0,     -- 1 = pesquisa voos: pega orçamentos, bate ponto e entra na folha
  ativo      INTEGER NOT NULL DEFAULT 1
);

-- ---------- programas de fidelidade ----------
CREATE TABLE programas (
  id               TEXT PRIMARY KEY,         -- smiles, latam, azul, livelo
  nome             TEXT NOT NULL,
  valor_milha      INTEGER NOT NULL,         -- milionésimos de real: R$ 0,016 = 16000
  limite           INTEGER,                  -- CPFs beneficiários; null = não emite
  regra            TEXT NOT NULL CHECK (regra IN ('ano', 'janela', 'manual', 'nenhuma')),
  renovacao        TEXT NOT NULL DEFAULT ''  -- explicação da regra, mostrada na tela
);
-- na Azul o limite depende da categoria da conta
CREATE TABLE categorias (
  programa_id TEXT NOT NULL REFERENCES programas(id),
  nome        TEXT NOT NULL,
  limite      INTEGER NOT NULL,
  PRIMARY KEY (programa_id, nome)
);

-- ---------- pessoas (cadastro único pelo CPF) ----------
-- titular, cliente e passageiro são papéis da mesma pessoa
CREATE TABLE pessoas (
  id                   INTEGER PRIMARY KEY,
  nome                 TEXT NOT NULL,
  cpf                  TEXT UNIQUE,          -- só dígitos; pode faltar (contato que ainda não fechou)
  nascimento           TEXT,
  whatsapp             TEXT,                 -- só dígitos
  email                TEXT,
  passaporte_numero    TEXT,
  passaporte_validade  TEXT,
  obs                  TEXT NOT NULL DEFAULT '',
  criada_em            TEXT NOT NULL
);
CREATE INDEX pessoas_whatsapp ON pessoas(whatsapp);

-- ---------- contas de pontos ----------
CREATE TABLE contas (
  id           INTEGER PRIMARY KEY,
  titular_id   INTEGER NOT NULL REFERENCES pessoas(id),
  programa_id  TEXT NOT NULL REFERENCES programas(id),
  clube        INTEGER,                      -- pontos por mês do clube; null = sem clube
  categoria    TEXT,                         -- só Azul
  ativa        INTEGER NOT NULL DEFAULT 1,
  criada_em    TEXT NOT NULL,
  UNIQUE (titular_id, programa_id)
);

-- entradas e saídas de pontos. O saldo é sempre a soma; nunca é digitado.
-- Cada entrada guarda quanto ainda resta (resta); as saídas gastam primeiro o que vence antes.
CREATE TABLE movimentos (
  id           INTEGER PRIMARY KEY,
  conta_id     INTEGER NOT NULL REFERENCES contas(id),
  lado         TEXT NOT NULL CHECK (lado IN ('entrada', 'saida')),
  tipo         TEXT NOT NULL,                -- entrada: clube, compra, transferencia, cartao, bonus, estorno, inicial
                                             -- saída: emissao, transferencia, expiracao, ajuste
  data         TEXT NOT NULL,
  pontos       INTEGER NOT NULL CHECK (pontos > 0),
  custo        INTEGER NOT NULL DEFAULT 0,   -- centavos (entradas com custo)
  vence        TEXT,                         -- entradas: vencimento do lote
  resta        INTEGER,                      -- entradas: pontos do lote ainda não gastos
  bonus_pct    INTEGER,                      -- transferência recebida
  par_id       INTEGER REFERENCES movimentos(id), -- transferência: a saída de um lado liga à entrada do outro
  emissao_id   INTEGER REFERENCES emissoes(id),
  obs          TEXT NOT NULL DEFAULT '',
  criado_em    TEXT NOT NULL,
  criado_por   TEXT NOT NULL
);
CREATE INDEX movimentos_conta ON movimentos(conta_id, data);

-- beneficiário registrado à mão (CPF que já tinha voado antes do sistema, ou cadastrado direto no programa)
CREATE TABLE beneficiarios_manuais (
  conta_id   INTEGER NOT NULL REFERENCES contas(id),
  pessoa_id  INTEGER NOT NULL REFERENCES pessoas(id),
  data       TEXT NOT NULL,                  -- define quando a vaga volta
  PRIMARY KEY (conta_id, pessoa_id)
);

-- ---------- orçamentos ----------
CREATE TABLE orcamentos (
  id                INTEGER PRIMARY KEY,     -- é também o número mostrado
  contato_nome      TEXT NOT NULL,
  contato_whatsapp  TEXT NOT NULL DEFAULT '',
  pessoa_id         INTEGER REFERENCES pessoas(id),  -- contato já cadastrado
  cliente_id        INTEGER REFERENCES pessoas(id),  -- quem paga (definido no fechamento)
  etapa             TEXT NOT NULL DEFAULT 'novo'
                    CHECK (etapa IN ('novo', 'pesquisa', 'pesquisado', 'enviado', 'fechado', 'emitido', 'perdido', 'cancelado')),
  antes_de_perder   TEXT,
  motivo            TEXT,
  responsavel       TEXT REFERENCES usuarios(email),
  adultos           INTEGER NOT NULL DEFAULT 1,
  criancas          INTEGER NOT NULL DEFAULT 0,
  bebes             INTEGER NOT NULL DEFAULT 0,
  pedido            TEXT NOT NULL DEFAULT '',  -- pedido especial, escrito
  observacao        TEXT NOT NULL DEFAULT '',
  faltando          TEXT NOT NULL DEFAULT '[]', -- JSON: o que perguntar ao cliente (vem do bot)
  origem            TEXT NOT NULL DEFAULT 'manual', -- manual, telegram
  texto_original    TEXT,                    -- o que o dono mandou pro bot
  audio             INTEGER NOT NULL DEFAULT 0,
  enviada_em        TEXT,
  combo_aceita      INTEGER,                 -- combos.id
  receb_forma       TEXT,                    -- pix, cartao, parcelado
  receb_parcelas    INTEGER,
  receb_recebido    INTEGER NOT NULL DEFAULT 0, -- centavos
  criado_em         TEXT NOT NULL,
  criado_por        TEXT NOT NULL
);
CREATE INDEX orcamentos_etapa ON orcamentos(etapa);
CREATE INDEX orcamentos_whatsapp ON orcamentos(contato_whatsapp);

CREATE TABLE trechos (
  orcamento_id  INTEGER NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  ordem         INTEGER NOT NULL,            -- 0, 1, 2...
  de            TEXT NOT NULL,               -- IATA
  para          TEXT NOT NULL,
  data          TEXT NOT NULL,
  janela        INTEGER NOT NULL DEFAULT 1,  -- pesquisar a janela de 14 dias
  PRIMARY KEY (orcamento_id, ordem)
);

CREATE TABLE conferencia (
  orcamento_id  INTEGER NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  ordem         INTEGER NOT NULL,
  texto         TEXT NOT NULL,
  feito         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (orcamento_id, ordem)
);

-- opção de voo achada pra um trecho (milhas, taxa e preço por pessoa)
CREATE TABLE opcoes (
  id            INTEGER PRIMARY KEY,
  orcamento_id  INTEGER NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  trecho        INTEGER NOT NULL,
  site          TEXT NOT NULL,               -- Smiles, Latam, TudoAzul, Interline, Skyscanner
  data          TEXT NOT NULL,
  sai           TEXT NOT NULL,               -- 'HH:MM'
  chega         TEXT NOT NULL,               -- 'HH:MM' ou 'HH:MM +1'
  cia           TEXT NOT NULL DEFAULT '',
  voo           TEXT NOT NULL DEFAULT '',
  escalas       INTEGER NOT NULL DEFAULT 0,
  bagagem       INTEGER NOT NULL DEFAULT 0,
  milhas        INTEGER,
  taxa          INTEGER,                     -- centavos
  preco         INTEGER,                     -- centavos (em dinheiro)
  link          TEXT NOT NULL DEFAULT '',
  obs           TEXT NOT NULL DEFAULT '',
  criada_em     TEXT NOT NULL,
  criada_por    TEXT NOT NULL
);
CREATE INDEX opcoes_orcamento ON opcoes(orcamento_id);

-- combinação mandada na proposta: uma opção por trecho
CREATE TABLE combos (
  id            INTEGER PRIMARY KEY,
  orcamento_id  INTEGER NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  ordem         INTEGER NOT NULL,
  nome          TEXT NOT NULL,
  escolha       TEXT NOT NULL,               -- JSON: ids das opções, na ordem dos trechos
  milha         TEXT NOT NULL DEFAULT '{}',  -- JSON: valor da milha por programa, se mudou do padrão
  livre         INTEGER,                     -- centavos: preço digitado à mão
  parcelado     INTEGER,                     -- centavos
  vezes         INTEGER NOT NULL DEFAULT 10
);

-- quem voa no orçamento fechado
CREATE TABLE orcamento_passageiros (
  orcamento_id  INTEGER NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  pessoa_id     INTEGER NOT NULL REFERENCES pessoas(id),
  ordem         INTEGER NOT NULL,
  PRIMARY KEY (orcamento_id, pessoa_id)
);

-- um voo emitido (um por trecho). Em pontos, gera a saída na conta.
CREATE TABLE emissoes (
  id            INTEGER PRIMARY KEY,
  orcamento_id  INTEGER NOT NULL REFERENCES orcamentos(id),
  trecho        INTEGER NOT NULL,
  conta_id      INTEGER REFERENCES contas(id),
  pontos        INTEGER,
  localizador   TEXT NOT NULL,
  cancelada     INTEGER NOT NULL DEFAULT 0,
  devolvido     INTEGER NOT NULL DEFAULT 0,  -- centavos devolvidos ao cliente no cancelamento
  em            TEXT NOT NULL,
  por           TEXT NOT NULL,
  UNIQUE (orcamento_id, trecho)
);
-- quem voou em cada emissão: é daqui que saem os beneficiários das contas
CREATE TABLE emissao_passageiros (
  emissao_id  INTEGER NOT NULL REFERENCES emissoes(id),
  pessoa_id   INTEGER NOT NULL REFERENCES pessoas(id),
  PRIMARY KEY (emissao_id, pessoa_id)
);

-- ---------- ponto dos pesquisadores ----------
CREATE TABLE ponto (
  id               INTEGER PRIMARY KEY,
  email            TEXT NOT NULL REFERENCES usuarios(email),
  inicio           TEXT NOT NULL,
  fim              TEXT,                     -- null = cronômetro ligado
  original_inicio  TEXT,                     -- preenchidos quando o pesquisador corrige
  original_fim     TEXT,
  manual           INTEGER NOT NULL DEFAULT 0, -- lançado à mão ("esqueci de ligar")
  corrigido_em     TEXT
);
CREATE INDEX ponto_email ON ponto(email, inicio);

CREATE TABLE valores_hora (
  email   TEXT NOT NULL REFERENCES usuarios(email),
  desde   TEXT NOT NULL,                     -- vale a partir deste dia
  valor   INTEGER NOT NULL,                  -- centavos por hora
  PRIMARY KEY (email, desde)
);

CREATE TABLE pagamentos_semana (
  email    TEXT NOT NULL REFERENCES usuarios(email),
  semana   TEXT NOT NULL,                    -- segunda-feira da semana
  valor    INTEGER NOT NULL,                 -- centavos
  data     TEXT NOT NULL,
  PRIMARY KEY (email, semana)
);

-- ---------- histórico e segurança ----------
-- tudo que muda fica aqui: quem, o quê, quando e como estava antes
CREATE TABLE eventos (
  id          INTEGER PRIMARY KEY,
  quando      TEXT NOT NULL,
  quem        TEXT NOT NULL,                 -- e-mail, ou 'bot'
  acao        TEXT NOT NULL,                 -- nome da ação (ex.: orc.pegar)
  entidade    TEXT NOT NULL,                 -- orcamento, conta, pessoa, ponto...
  entidade_id TEXT NOT NULL,
  texto       TEXT NOT NULL DEFAULT '',      -- frase pro histórico ("Pegou o orçamento")
  antes       TEXT,                          -- JSON
  depois      TEXT                           -- JSON
);
CREATE INDEX eventos_entidade ON eventos(entidade, entidade_id, quando);

-- cada ação chega com uma chave única; repetida, devolve o resultado da primeira vez
CREATE TABLE idempotencia (
  chave      TEXT PRIMARY KEY,
  quando     TEXT NOT NULL,
  resultado  TEXT NOT NULL
);

-- conversas do bot esperando o dono (falta nome/WhatsApp, ou esperando Confirmar)
CREATE TABLE bot_pendentes (
  chat_id    TEXT PRIMARY KEY,
  dados      TEXT NOT NULL,                  -- JSON do pedido montado
  situacao   TEXT NOT NULL CHECK (situacao IN ('faltando', 'confirmar')),
  expira     TEXT NOT NULL
);

-- ---------- valores iniciais (só regras públicas, nada de dado de cliente) ----------
INSERT INTO programas (id, nome, valor_milha, limite, regra, renovacao) VALUES
  ('smiles', 'Smiles',     16000, 25,   'ano',     '25 CPFs por ano; zera em 1º de janeiro'),
  ('latam',  'Latam Pass', 25500, 24,   'janela',  '24 CPFs; cada um libera a vaga 12 meses após a emissão'),
  ('azul',   'TudoAzul',   15000, 5,    'manual',  '5 a 8 CPFs conforme a categoria; troca manual com 30 dias de carência'),
  ('livelo', 'Livelo',     0,     NULL, 'nenhuma', 'Não emite passagem: só transfere pros outros programas');
INSERT INTO categorias (programa_id, nome, limite) VALUES
  ('azul', 'Básico', 5), ('azul', 'Topázio', 6), ('azul', 'Safira', 7), ('azul', 'Diamante', 8);
