// Gera o arquivo da extensão pra baixar no sistema: public/extensao/kv-pesquisa.zip (+ versao.json).
// Rodar depois de mudar qualquer coisa em sistema/extensao/ (e subir a "version" do manifest.json), antes do deploy.
// Se a barra precisar da versão nova pra funcionar, subir também a MINIMA lá embaixo.
// Uso: npm run extensao
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
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
