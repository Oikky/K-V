-- Foto do perfil (vem do Google pelo login) e, no histórico, quem fez de verdade quando o admin
-- usa o sistema como outra pessoa da equipe ("quem" = a pessoa, "por" = o admin).
ALTER TABLE usuarios ADD COLUMN foto TEXT;
ALTER TABLE eventos ADD COLUMN por TEXT;
