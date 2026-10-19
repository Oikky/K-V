// Modo captura, ligado na aba do site da companhia: a pessoa passa o mouse e o cartão do voo fica marcado
// (o menor pedaço da página com horário de saída e de chegada). Clicar manda o texto dele pra barra.
// Setas ↑ e ↓ aumentam ou diminuem o pedaço; Esc cancela. Se já tiver texto selecionado, manda a seleção na hora.
(() => {
  if (window.__kvCaptura) { window.__kvCaptura.iniciar(); return; }

  const LARANJA = '#FF8911';
  let ligado = false, alvo = null, base = null, subir = 0, caixa = null, dica = null;
  const enviar = (dados) => { try { chrome.runtime.sendMessage({ kvCaptura: true, dados }); } catch (e) {} };
  const texto = (el) => (el.innerText || el.textContent || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 6000);
  const horas = (t) => (t.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/g) || []).length;

  // a partir do que está embaixo do mouse, sobe até o primeiro pedaço com dois horários (o cartão do voo)
  function cartao(el) {
    let x = el;
    for (let i = 0; x && x !== document.body && i < 15; i++, x = x.parentElement) if (horas(texto(x)) >= 2) return x;
    return el;
  }
  function escolhido() {
    let x = base;
    for (let i = 0; i < subir && x && x.parentElement && x.parentElement !== document.body; i++) x = x.parentElement;
    return x;
  }
  function desenhar() {
    alvo = escolhido();
    if (!alvo) return;
    const r = alvo.getBoundingClientRect();
    Object.assign(caixa.style, { top: r.top - 3 + 'px', left: r.left - 3 + 'px', width: r.width + 6 + 'px', height: r.height + 6 + 'px', display: 'block' });
  }

  function mover(e) {
    if (!ligado || e.target === caixa || e.target === dica) return;
    const b = cartao(e.target);
    if (b !== base) { base = b; subir = 0; }
    desenhar();
  }
  function travar(e) { if (ligado) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); } }
  function clicar(e) {
    if (!ligado) return;
    travar(e);
    if (alvo) { const t = texto(alvo); parar(); enviar({ texto: t, titulo: document.title }); }
  }
  function tecla(e) {
    if (!ligado) return;
    if (e.key === 'Escape') { travar(e); parar(); enviar({ cancelado: true }); }
    else if (e.key === 'ArrowUp') { travar(e); subir++; desenhar(); }
    else if (e.key === 'ArrowDown') { travar(e); subir = Math.max(0, subir - 1); desenhar(); }
  }

  function iniciar() {
    const sel = String(getSelection() || '').trim();
    if (sel.length > 8) { enviar({ texto: sel.slice(0, 6000), titulo: document.title }); return; }
    if (ligado) return;
    ligado = true;
    caixa = document.createElement('div');
    Object.assign(caixa.style, { position: 'fixed', zIndex: 2147483646, pointerEvents: 'none', border: `3px solid ${LARANJA}`, borderRadius: '12px',
      background: 'rgba(255,137,17,.08)', boxShadow: '0 0 0 9999px rgba(1,14,31,.25)', transition: 'all .08s ease-out', display: 'none' });
    dica = document.createElement('div');
    dica.textContent = 'Clique no voo pra mandar pra K&V  ·  ↑ pega mais  ·  Esc cancela';
    Object.assign(dica.style, { position: 'fixed', zIndex: 2147483647, left: '50%', bottom: '20px', transform: 'translateX(-50%)', pointerEvents: 'none',
      background: '#010E1F', color: '#fff', font: '600 14px system-ui, sans-serif', padding: '10px 16px', borderRadius: '999px', border: `2px solid ${LARANJA}` });
    document.documentElement.append(caixa, dica);
    addEventListener('mousemove', mover, true);
    ['pointerdown', 'mousedown', 'mouseup', 'pointerup'].forEach((t) => addEventListener(t, travar, true));
    addEventListener('click', clicar, true);
    addEventListener('keydown', tecla, true);
    addEventListener('scroll', desenhar, true);
  }
  function parar() {
    if (!ligado) return;
    ligado = false;
    removeEventListener('mousemove', mover, true);
    ['pointerdown', 'mousedown', 'mouseup', 'pointerup'].forEach((t) => removeEventListener(t, travar, true));
    removeEventListener('click', clicar, true);
    removeEventListener('keydown', tecla, true);
    removeEventListener('scroll', desenhar, true);
    caixa && caixa.remove(); dica && dica.remove();
    caixa = dica = alvo = base = null;
  }

  // a barra também tem botões de "pegar mais / menos" (o teclado fica na barra enquanto a pessoa não clica na página)
  const maior = () => { if (ligado && base) { subir++; desenhar(); } };
  const menor = () => { if (ligado && base) { subir = Math.max(0, subir - 1); desenhar(); } };
  window.__kvCaptura = { iniciar, parar, maior, menor };
  iniciar();
})();
