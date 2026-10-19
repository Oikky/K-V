// Gera o arquivo da extensão pra baixar no sistema: public/extensao/kv-pesquisa.zip (+ versao.json).
// Rodar depois de mudar qualquer coisa em sistema/extensao/ (e subir a "version" do manifest.json), antes do deploy.
// Se a barra precisar da versão nova pra funcionar, subir também a MINIMA lá embaixo.
// Uso: npm run extensao
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..');
const origem = join(raiz, 'extensao'), destino = join(raiz, 'public', 'extensao');
const { version } = JSON.parse(readFileSync(join(origem, 'manifest.json'), 'utf8'));

mkdirSync(destino, { recursive: true });
const zip = join(destino, 'kv-pesquisa.zip');
rmSync(zip, { force: true });
// os arquivos ficam na raiz do zip: "Extrair tudo" já cria a pasta kv-pesquisa com o manifest dentro
execFileSync('powershell.exe', ['-NoProfile', '-Command',
  `Compress-Archive -Path '${join(origem, '*').replace(/'/g, "''")}' -DestinationPath '${zip.replace(/'/g, "''")}' -Force`], { stdio: 'inherit' });
// "minima": a barra só pede pra atualizar quem tem versão abaixo dela. Subir só quando a barra depender da mudança;
// mudança opcional sobe a "version" do manifest e deixa a mínima como está.
const MINIMA = '1.0.0';
writeFileSync(join(destino, 'versao.json'), JSON.stringify({ versao: version, minima: MINIMA }) + '\n');
console.log(`Extensão ${version} → public/extensao/kv-pesquisa.zip`);

// No PC do dev: se existir sistema/extensao.local.json ({ "pasta": "C:\\...\\kv-pesquisa" }, fora do repositório),
// a pasta que o Chrome carrega já recebe a versão nova; aí é só clicar em recarregar em chrome://extensions.
const local = join(raiz, 'extensao.local.json');
if (existsSync(local)) {
  const { pasta } = JSON.parse(readFileSync(local, 'utf8'));
  if (!existsSync(join(pasta, 'manifest.json'))) throw new Error(`${pasta} não parece a pasta da extensão (falta o manifest.json)`);
  const novos = readdirSync(origem);
  // o que saiu da extensão sai da pasta também (só arquivos soltos; a pasta é só da extensão)
  for (const f of readdirSync(pasta)) if (!novos.includes(f) && statSync(join(pasta, f)).isFile()) rmSync(join(pasta, f));
  for (const f of novos) copyFileSync(join(origem, f), join(pasta, f));
  console.log(`Copiada pra ${pasta}: clique em recarregar no K&V Pesquisa em chrome://extensions`);
}
