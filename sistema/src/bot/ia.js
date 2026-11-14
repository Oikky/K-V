// Áudio → texto (Whisper da Cloudflare) e texto → orçamento (Claude, saída estruturada).
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { Buffer } from 'node:buffer';

// o mais barato que dá conta (pedido do usuário)
const MODELO = 'claude-sonnet-5';

// os mesmos textos de pedido especial que as telas usam (viram itens da lista de conferência)
export const PEDIDOS_CONHECIDOS = ['Só voo direto', 'Até 1 escala', 'Só pontos', 'Com bagagem despachada', 'Saída de manhã'];

export async function transcrever(env, audio) {
  // base64 pelo Buffer: decodificar na mão estoura o limite de CPU do plano grátis (lição da D'luh)
  const r = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: Buffer.from(audio).toString('base64'), language: 'pt' });
  return String(r?.text || '').trim();
}

const Pedido = z.object({
  acao: z.enum(['criar', 'editar', 'outro']).describe('criar = pedido novo; editar = mudança num orçamento já anotado; outro = nenhum dos dois'),
  numero_orcamento: z.number().int().nullable().describe('Só em editar: o número do orçamento que muda'),
  nome_contato: z.string().nullable(),
  whatsapp: z.string().nullable(),
  trechos: z.array(z.object({
    de: z.string().describe('Código IATA do aeroporto de saída, 3 letras maiúsculas'),
    para: z.string().describe('Código IATA do aeroporto de chegada, 3 letras maiúsculas'),
    data: z.string().describe('Data pedida, AAAA-MM-DD'),
    data_flexivel: z.boolean().describe('false só se a pessoa disse que a data é fixa'),
  })),
  adultos: z.number().int(),
  criancas: z.number().int(),
  bebes: z.number().int(),
  pedidos_especiais: z.array(z.string()),
  observacao: z.string(),
  faltando: z.array(z.string()),
});

const INSTRUCOES = `Você anota pedidos de passagem aérea pra K&V, uma agência que emite passagens em milhas ou em dinheiro.
O dono da agência te manda, em português e do jeito que fala, o que um cliente pediu no WhatsApp. Transforme isso num orçamento.

A mensagem pode ser um pedido novo (acao = criar) ou uma mudança num orçamento que já está anotado (acao = editar),
ex.: "muda a data da Maria pra dia 15", "no 12 são 3 adultos", "o WhatsApp do João é ...". Os orçamentos em aberto vêm junto, com o número.
Em editar: numero_orcamento é o número do orçamento que muda (pelo número citado, pelo nome do cliente ou pela mensagem respondida),
e TODOS os campos vêm com o orçamento já mudado: copie do orçamento atual o que não mudou. Se não der pra saber qual orçamento, numero_orcamento = null.

Regras:
- Trechos: cada deslocamento vira um trecho. Ida e volta são 2 trechos (o segundo invertido). Roteiro com várias cidades vira vários trechos, na ordem.
- Aeroportos em código IATA. Cidade com mais de um aeroporto: São Paulo = GRU, Rio de Janeiro = GIG, Belo Horizonte = CNF, a menos que a pessoa diga outro.
- Se não disser de onde sai, use GRU e ponha "cidade de saída" em faltando.
- Datas em AAAA-MM-DD. Resolva datas relativas a partir de hoje; data sem ano é a próxima ocorrência. data_flexivel é true, a não ser que a pessoa diga que a data é fixa.
- Passageiros: quem viaja. Sem número dito, 1 adulto. Criança: 2 a 11 anos. Bebê: menos de 2.
- pedidos_especiais: use exatamente estes textos quando couberem: ${PEDIDOS_CONHECIDOS.join(', ')}. Outros pedidos, em frase curta.
- observacao: o que mais for útil pro pesquisador e não couber nos campos (ex.: "aniversário de casamento", "aceita sair de Campinas"). Vazio se não houver.
- faltando: o que precisa perguntar ao cliente antes de pesquisar (ex.: "data da volta", "quantas pessoas"). Não invente dados pra preencher lacunas.
- nome_contato e whatsapp: só se aparecerem na mensagem.
- acao = outro se a mensagem não for pedido nem mudança; aí os outros campos podem ficar vazios.`;

// devolve o pedido, ou { erro: 'texto pro dono' }
// abertos: os orçamentos que ainda podem mudar, pro caso de a mensagem ser uma edição
export async function interpretar(env, texto, abertos = []) {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD
  const diaSemana = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' });
  const cliente = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const r = await cliente.messages.parse({
      model: MODELO,
      max_tokens: 16000,
      system: INSTRUCOES,
      messages: [{ role: 'user', content: `Hoje é ${hoje} (${diaSemana}).\n\nOrçamentos em aberto:\n${JSON.stringify(abertos)}\n\nMensagem:\n${texto}` }],
      output_config: { format: zodOutputFormat(Pedido) },
    });
    if (r.stop_reason === 'refusal') return { erro: 'A IA não quis processar essa mensagem. Pode reescrever?' };
    if (!r.parsed_output) return { erro: 'A IA respondeu de um jeito que não entendi. Tenta de novo?' };
    return r.parsed_output;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return { erro: 'A IA está ocupada agora. Tenta de novo em um minuto.' };
    if (e instanceof Anthropic.APIConnectionError) return { erro: 'Não consegui falar com a IA. Tenta de novo em instantes.' };
    if (e instanceof Anthropic.APIError) { console.error('Claude', e.status, e.message); return { erro: 'Deu um erro na IA. Avise o Ikky.' }; }
    throw e;
  }
}
