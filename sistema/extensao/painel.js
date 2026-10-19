// Ponte entre a barra (página do sistema, no quadro) e a aba aberta ao lado (Smiles, Latam...).
// A barra pede, a ponte faz: abrir um endereço na aba, capturar o voo que a pessoa clicar, dizer qual site está aberto.
const SISTEMA = 'https://kv-sistema.ikkysousa5.workers.dev';
const VERSAO = chrome.runtime.getManifest().version;
let quadro = null;

const mandar = (msg) => quadro && quadro.contentWindow.postMessage({ kv: true, ...msg }, SISTEMA);
const abaAtual = async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

// ---------- entrar: o login é o mesmo do sistema (Google pelo Cloudflare Access) ----------
async function conferirLogin() {
  try {
    const r = await fetch(SISTEMA + '/api/estado', { credentials: 'include', cache: 'no-store', redirect: 'manual' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) return true;
    if (r.status === 403) document.getElementById('msg').textContent = 'Seu e-mail não tem acesso ao sistema. Fale com o dono.';
  } catch (e) {}
  return false;
}
let esperando = null;
async function iniciar() {
  if (await conferirLogin()) return mostrarBarra();
  document.getElementById('entrar').classList.add('ver');
  // enquanto a pessoa entra na outra aba, confere de novo a cada 3 s
  clearInterval(esperando);
  esperando = setInterval(async () => { if (await conferirLogin()) { clearInterval(esperando); mostrarBarra(); } }, 3000);
}
document.getElementById('botao').addEventListener('click', () => chrome.tabs.create({ url: SISTEMA + '/orcamentos.html' }));

function mostrarBarra() {
  document.getElementById('entrar').classList.remove('ver');
  if (quadro) return;
  quadro = document.createElement('iframe');
  quadro.src = `${SISTEMA}/barra.html?ext=${encodeURIComponent(VERSAO)}`;
  quadro.allow = 'clipboard-read; clipboard-write';
  document.body.append(quadro);
  // se a barra não der sinal de vida (o Chrome barrou o login dentro do quadro), avisa em vez de ficar em branco
  setTimeout(() => {
    if (pronta) return;
    quadro.remove(); quadro = null;
    document.getElementById('msg').textContent = 'A barra não carregou. Abra o sistema numa aba, confira se está entrando normal e clique em tentar de novo.';
    const b = document.getElementById('botao'); b.textContent = 'Tentar de novo'; b.onclick = () => { b.onclick = null; iniciar(); };
    document.getElementById('entrar').classList.add('ver');
  }, 12000);
}
let pronta = false;

// ---------- pedidos da barra ----------
addEventListener('message', async (e) => {
  if (e.origin !== SISTEMA || !e.data || !e.data.kv) return;
  const d = e.data;
  try {
    if (d.tipo === 'oi') { pronta = true; return avisarAba(); }
    if (d.tipo === 'abrir') {
      const aba = await abaAtual();
      // a aba do próprio sistema (ou uma aba vazia/do Chrome) não é trocada: abre outra
      const usar = aba && /^https?:/.test(aba.url || '') && !(aba.url || '').startsWith(SISTEMA) && !d.novaAba;
      if (usar) await chrome.tabs.update(aba.id, { url: d.url }); else await chrome.tabs.create({ url: d.url });
      return;
    }
    if (d.tipo === 'capturar') {
      const aba = await abaAtual();
      if (!aba || !/^https:/.test(aba.url || '')) return mandar({ tipo: 'erro', texto: 'Abra o site da companhia nesta janela antes de capturar.' });
      await chrome.scripting.executeScript({ target: { tabId: aba.id }, files: ['captura.js'] });
      return;
    }
    if (['cancelar', 'maior', 'menor'].includes(d.tipo)) {
      const aba = await abaAtual();
      if (aba) await chrome.scripting.executeScript({ target: { tabId: aba.id }, args: [d.tipo],
        func: (t) => { const c = window.__kvCaptura; if (c) (t === 'cancelar' ? c.parar : t === 'maior' ? c.maior : c.menor)(); } }).catch(() => {});
    }
  } catch (err) {
    mandar({ tipo: 'erro', texto: 'Não deu pra mexer nessa aba (' + (err && err.message ? err.message : 'erro') + ').' });
  }
});

// o voo clicado chega da aba (captura.js) e vai pra barra
chrome.runtime.onMessage.addListener((msg, quem) => {
  if (!msg || !msg.kvCaptura) return;
  mandar({ tipo: 'capturado', ...msg.dados, url: quem.tab ? quem.tab.url : '' });
});

// a barra sabe qual site está aberto (escolhe o site sozinha e guarda o link do preço)
async function avisarAba() {
  const aba = await abaAtual();
  mandar({ tipo: 'aba', versao: VERSAO, url: aba ? aba.url || '' : '', titulo: aba ? aba.title || '' : '' });
}
chrome.tabs.onActivated.addListener(avisarAba);
chrome.tabs.onUpdated.addListener((id, mud, aba) => { if (aba.active && (mud.url || mud.status === 'complete')) avisarAba(); });
chrome.windows.onFocusChanged.addListener(avisarAba);

iniciar();
