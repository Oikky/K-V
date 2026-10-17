// Cadastro único de pessoas: cada uma existe uma vez só, achada pelo CPF. Titular, cliente e passageiro são papéis dela.
import { acao, Recusa } from '../acoes.js';

const soDigitos = (s) => String(s || '').replace(/\D/g, '');
const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
// confere os dois dígitos verificadores do CPF (pega erro de digitação)
export function cpfValido(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += +cpf[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +cpf[9] && dv(10) === +cpf[10];
}

// cria (sem id) ou altera. O CPF só entra na criação: é ele que liga a pessoa às contas de pontos.
acao('pessoa.salvar', ['dono'], async ({ db, quando }, d) => {
  const nome = String(d.nome || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (nome.split(' ').length < 2) throw new Recusa('Falta o nome completo');
  const campos = {
    nome,
    nascimento: d.nascimento && ehData(d.nascimento) ? d.nascimento : null,
    whatsapp: soDigitos(d.whatsapp).slice(0, 15) || null,
    email: String(d.email || '').trim().slice(0, 120) || null,
    passaporte_numero: String(d.passaporte_numero || '').trim().toUpperCase().slice(0, 20) || null,
    passaporte_validade: d.passaporte_validade && ehData(d.passaporte_validade) ? d.passaporte_validade : null,
    obs: String(d.obs || '').trim().slice(0, 500),
  };
  if (d.id) {
    const antes = await db.prepare('SELECT * FROM pessoas WHERE id = ?').bind(d.id).first();
    if (!antes) throw new Recusa('Pessoa não encontrada', 404);
    return {
      resultado: { id: d.id },
      comandos: [db.prepare(`UPDATE pessoas SET nome = ?, nascimento = ?, whatsapp = ?, email = ?, passaporte_numero = ?, passaporte_validade = ?, obs = ?
        WHERE id = ?`).bind(...Object.values(campos), d.id)],
      eventos: [{ entidade: 'pessoa', id: d.id, texto: `Alterou os dados de ${nome}`, antes, depois: campos }],
    };
  }
  const cpf = soDigitos(d.cpf);
  if (!cpfValido(cpf)) throw new Recusa('CPF inválido; confira os números');
  const ja = await db.prepare('SELECT id, nome FROM pessoas WHERE cpf = ?').bind(cpf).first();
  if (ja) throw new Recusa(`Esse CPF já é de ${ja.nome}. Cada pessoa tem um cadastro só.`, 409);
  const { id: ult } = await db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM pessoas').first();
  const id = ult + 1;
  return {
    resultado: { id },
    comandos: [db.prepare(`INSERT INTO pessoas (id, nome, cpf, nascimento, whatsapp, email, passaporte_numero, passaporte_validade, obs, criada_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, nome, cpf, campos.nascimento, campos.whatsapp, campos.email, campos.passaporte_numero, campos.passaporte_validade, campos.obs, quando)],
    eventos: [{ entidade: 'pessoa', id, texto: `Cadastrou ${nome}`, depois: { ...campos, cpf } }],
  };
});
