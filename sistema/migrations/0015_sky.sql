-- Skyscanner é a base de preço, não uma opção de trecho: um por roteiro, JSON [{ valor (centavos, por pessoa), texto }]
ALTER TABLE orcamentos ADD COLUMN sky TEXT;
