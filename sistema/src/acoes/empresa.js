// Dados da empresa pro recibo (Configurações › Empresa). Só o dono vê e muda; ficam no banco porque o repositório é público.
import { acao, Recusa } from '../acoes.js';

const CAMPOS = { tel: 40, ig: 60, cnpj: 30, gmail: 120 };
const LOGO_MAX = 400_000; // ~300 KB de imagem: a tela reduz pra 256 px antes de mandar

acao('empresa.salvar', ['dono'], async ({ db, quando }, d) => {
  const dados = {};
  for (const [k, max] of Object.entries(CAMPOS)) dados[k] = String(d[k] || '').trim().slice(0, max);
  dados.pesquisaCria = d.pesquisaCria === true; // quem pesquisa pode criar orçamento
  // logo: undefined = não mexe; null = tira; texto = troca
  let logo;
  if (d.logo !== undefined) {
    if (d.logo !== null && (typeof d.logo !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d.logo))) throw new Recusa('A logo precisa ser uma imagem PNG, JPG ou WebP');
    if (d.logo && d.logo.length > LOGO_MAX) throw new Recusa('A logo ficou grande demais; use uma imagem menor');
    logo = d.logo;
  }
  const antes = await db.prepare('SELECT dados FROM empresa WHERE id = 1').first();
  const cmd = logo === undefined
    ? db.prepare('UPDATE empresa SET dados = ?, alterado_em = ? WHERE id = 1').bind(JSON.stringify(dados), quando)
    : db.prepare('UPDATE empresa SET dados = ?, logo = ?, alterado_em = ? WHERE id = 1').bind(JSON.stringify(dados), logo, quando);
  return {
    resultado: { ok: true },
    comandos: [cmd],
    eventos: [{ entidade: 'empresa', id: 1, texto: logo === undefined ? 'Alterou os dados da empresa' : 'Alterou os dados e a logo da empresa', antes: antes && JSON.parse(antes.dados) }],
  };
});
