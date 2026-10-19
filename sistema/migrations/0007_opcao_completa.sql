-- Opção de voo com todos os campos da página de voo do documento antigo.
-- destaque = a "Observação Data" (‼️Opção mais barata‼️), que no resumo vem logo depois da companhia.
-- bagagem passa a ser a quantidade de malas despachadas (0 = não inclusa); quem só olha se tem mala continua igual.
ALTER TABLE opcoes ADD COLUMN destaque TEXT;
