-- Cabine da opção de voo (Premium Economy, Executiva, Primeira classe); vazio = econômica.
-- de/para da opção passam a aceitar o nome livre ("São Paulo GRU"), não só a sigla.
ALTER TABLE opcoes ADD COLUMN cabine TEXT;
