// Clicar no ícone da extensão abre a barra lateral da K&V (vale a cada vez que o Chrome acorda a extensão).
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Atalho do teclado (Alt+K por padrão; no Edge, Ctrl+Shift+K é "duplicar aba" e não pode ser usado): abre a barra na janela atual.
// Dá pra trocar em chrome://extensions/shortcuts (no Edge, edge://extensions/shortcuts).
chrome.commands.onCommand.addListener((comando, aba) => {
  if (comando !== 'abrir-barra') return;
  if (aba && aba.windowId != null) chrome.sidePanel.open({ windowId: aba.windowId }).catch(() => {});
  else chrome.windows.getCurrent().then((j) => chrome.sidePanel.open({ windowId: j.id })).catch(() => {});
});
