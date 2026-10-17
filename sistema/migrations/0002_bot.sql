-- De qual chat do Telegram veio o orçamento (pro /desfazer apagar só o que a pessoa mandou)
ALTER TABLE orcamentos ADD COLUMN origem_chat TEXT;
