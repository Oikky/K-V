// Sobe pra Cloudflare só os segredos que cada Worker usa, lendo do .env (que nunca vai pro git).
// Uso: node scripts/segredos.mjs sistema | bot
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const QUAIS = {
  sistema: { config: 'wrangler.jsonc', chaves: ['ACCESS_TEAM', 'ACCESS_AUD'] },
  bot: { config: 'wrangler.bot.jsonc', chaves: ['TELEGRAM_TOKEN', 'TELEGRAM_SECRET', 'KV_CHATS', 'ANTHROPIC_API_KEY'] },
};
const alvo = QUAIS[process.argv[2]];
if (!alvo) { console.error('Uso: node scripts/segredos.mjs sistema | bot'); process.exit(1); }

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/)
  .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const faltam = alvo.chaves.filter((k) => !env[k]);
if (faltam.length) { console.error('Faltam no .env:', faltam.join(', ')); process.exit(1); }

const tmp = '.segredos.tmp.json';
writeFileSync(tmp, JSON.stringify(Object.fromEntries(alvo.chaves.map((k) => [k, env[k]]))));
try {
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'secret', 'bulk', tmp, '-c', alvo.config], { stdio: 'inherit' });
} finally { rmSync(tmp, { force: true }); }
