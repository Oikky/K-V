// Quem está chamando. O Cloudflare Access fica na frente do sistema e manda um token assinado
// (cabeçalho Cf-Access-Jwt-Assertion) com o e-mail de quem entrou. Aqui o token é conferido
// com as chaves públicas do Access, e o e-mail é procurado na tabela usuarios.
// No PC (wrangler dev) não tem Access: vale o DEV_EMAIL do .dev.vars.

let chaves = null, chavesEm = 0;

async function chavesAccess(team) {
  if (chaves && Date.now() - chavesEm < 3600e3) return chaves;
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error('Não deu pra baixar as chaves do Access');
  const { keys } = await r.json();
  chaves = await Promise.all(keys.map(async (k) => ({
    kid: k.kid,
    chave: await crypto.subtle.importKey('jwk', k, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']),
  })));
  chavesEm = Date.now();
  return chaves;
}

const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const json64 = (s) => JSON.parse(new TextDecoder().decode(b64url(s)));

async function emailDoToken(token, env) {
  const [cab, corpo, assinatura] = token.split('.');
  if (!assinatura) return null;
  const h = json64(cab), p = json64(corpo);
  const k = (await chavesAccess(env.ACCESS_TEAM)).find((x) => x.kid === h.kid);
  if (!k) return null;
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', k.chave, b64url(assinatura), new TextEncoder().encode(`${cab}.${corpo}`));
  if (!ok) return null;
  const aud = Array.isArray(p.aud) ? p.aud : [p.aud];
  if (!aud.includes(env.ACCESS_AUD)) return null;
  if (p.exp && p.exp * 1000 < Date.now()) return null;
  return String(p.email || '').toLowerCase() || null;
}

// devolve { email, nome, papel, pesquisa, foto, real, admin? } ou null (não entra)
export async function usuarioDa(req, env) {
  let email = null;
  if (env.ACCESS_TEAM && env.ACCESS_AUD) {
    const token = req.headers.get('Cf-Access-Jwt-Assertion');
    if (token) email = await emailDoToken(token, env).catch(() => null);
  } else if (env.DEV_EMAIL) {
    email = env.DEV_EMAIL.toLowerCase();
  }
  if (!email) return null;
  const sql = 'SELECT email, nome, papel, pesquisa, foto FROM usuarios WHERE email = ? AND ativo = 1';
  const u = await env.DB.prepare(sql).bind(email).first();
  if (!u) return null;
  // o admin pode usar o sistema como qualquer pessoa da equipe, como se tivesse entrado na conta dela:
  // vê o que ela vê e grava no nome dela (o histórico guarda em "por" que foi o admin). Só o admin pode.
  const como = String(req.headers.get('x-kv-ver-como') || '').toLowerCase();
  if (u.papel === 'admin' && como && como !== u.email) {
    const alvo = await env.DB.prepare(sql).bind(como).first();
    if (alvo) return { ...alvo, real: 'admin', admin: { email: u.email, nome: u.nome, foto: u.foto } };
  }
  return { ...u, real: u.papel };
}
