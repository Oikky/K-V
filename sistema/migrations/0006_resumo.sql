-- Resumo escrito da pesquisa (o "Em função site" do documento antigo): o que cada opção precisa pra ele sair completo.
-- Tudo opcional: o que estiver vazio não aparece no resumo.
ALTER TABLE opcoes ADD COLUMN de TEXT;              -- aeroporto de saída desta opção, quando não é o do trecho (CGH num trecho GRU)
ALTER TABLE opcoes ADD COLUMN para TEXT;            -- aeroporto de chegada desta opção, idem
ALTER TABLE opcoes ADD COLUMN duracao TEXT;         -- tempo de viagem, como foi escrito ("7h10m")
ALTER TABLE opcoes ADD COLUMN escalas_onde TEXT;    -- JSON: [["São Paulo CGH", "3h40m"], ...]
ALTER TABLE opcoes ADD COLUMN milhas_mala INTEGER;  -- milhas por pessoa com mala despachada, quando o site cobra à parte
ALTER TABLE opcoes ADD COLUMN mala_mao INTEGER;     -- 1 inclusa, 0 não inclusa, vazio = não anotado
-- preço em dinheiro anotado à mão no Skyscanner (veio do documento antigo; no sistema o Skyscanner é uma opção)
ALTER TABLE orcamentos ADD COLUMN skyscanner TEXT NOT NULL DEFAULT '';
