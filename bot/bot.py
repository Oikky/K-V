"""Bot do Telegram da K&V: demonstração de IA no atendimento.

O dono manda pro bot, em texto ou áudio, o pedido do cliente do jeito que falaria
("a Maria quer ir pra Lisboa dia 12 de novembro com o marido, volta dia 26, só voo direto").
O áudio vira texto aqui no PC (faster-whisper, nada sai da máquina). A Claude transforma
o texto num orçamento estruturado (contato, trechos, datas, passageiros, pedido especial),
e ele entra na fila dos rascunhos como "Novo", pronto pro pesquisador pegar.

Rodar:  py -3.11 bot/bot.py   (o servidor dos rascunhos na porta 8790 mostra a fila)
Config: bot/.env (ver bot/.env.exemplo). O .env nunca vai pro git: o repositório é público.
"""
import datetime
import json
import os
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

import anthropic
from pydantic import BaseModel, Field

RAIZ = Path(__file__).resolve().parent
ARQ_PEDIDOS = RAIZ.parent / "_rascunhos" / "dados" / "pedidos.json"

# os mesmos textos de pedido especial que os rascunhos usam (viram itens da lista de conferência)
PEDIDOS_CONHECIDOS = ["Só voo direto", "Até 1 escala", "Só pontos", "Com bagagem despachada", "Saída de manhã"]


def carregar_env():
    arq = RAIZ / ".env"
    if not arq.exists():
        return
    for linha in arq.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        os.environ.setdefault(chave.strip(), valor.strip().strip('"').strip("'"))


carregar_env()
sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # o console do Windows não mostra → e acentos sem isso
TOKEN = os.environ.get("TELEGRAM_TOKEN", "")
MODELO = os.environ.get("KV_MODELO", "claude-opus-5")
CHATS = {c.strip() for c in os.environ.get("KV_CHATS", "").split(",") if c.strip()}
URL_RASCUNHOS = os.environ.get("KV_RASCUNHOS_URL", "http://127.0.0.1:8790").rstrip("/")
MODELO_WHISPER = os.environ.get("KV_WHISPER", "large-v3")


# ---------- Telegram (só biblioteca padrão) ----------
def telegram(metodo, **params):
    dados = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None}).encode()
    req = urllib.request.Request(f"https://api.telegram.org/bot{TOKEN}/{metodo}", data=dados)
    with urllib.request.urlopen(req, timeout=70) as r:
        resp = json.load(r)
    if not resp.get("ok"):
        raise RuntimeError(f"Telegram {metodo}: {resp}")
    return resp["result"]


def responder(chat_id, texto):
    telegram("sendMessage", chat_id=chat_id, text=texto, disable_web_page_preview="true")


def baixar_arquivo(file_id, destino):
    info = telegram("getFile", file_id=file_id)
    url = f"https://api.telegram.org/file/bot{TOKEN}/{info['file_path']}"
    with urllib.request.urlopen(url, timeout=120) as r, open(destino, "wb") as f:
        f.write(r.read())


# ---------- áudio → texto, local ----------
_whisper = None


def transcrever(caminho):
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel
        try:
            _whisper = WhisperModel(MODELO_WHISPER, device="cuda", compute_type="float16")
        except Exception as e:  # sem GPU: CPU com um modelo menor, pra não ficar lento demais
            print(f"[aviso] GPU indisponível ({e}); usando CPU com o modelo small.")
            _whisper = WhisperModel("small", device="cpu", compute_type="int8")
    trechos, _ = _whisper.transcribe(str(caminho), language="pt", vad_filter=True)
    return " ".join(t.text.strip() for t in trechos).strip()


# ---------- texto → orçamento (Claude, saída estruturada) ----------
class Trecho(BaseModel):
    de: str = Field(description="Código IATA do aeroporto de saída, 3 letras maiúsculas")
    para: str = Field(description="Código IATA do aeroporto de chegada, 3 letras maiúsculas")
    data: str = Field(description="Data pedida, AAAA-MM-DD")
    data_flexivel: bool = Field(description="false só se a pessoa disse que a data é fixa")


class Pedido(BaseModel):
    e_pedido_de_viagem: bool
    nome_contato: str | None
    whatsapp: str | None
    trechos: list[Trecho]
    adultos: int
    criancas: int
    bebes: int
    pedidos_especiais: list[str]
    observacao: str
    faltando: list[str]


INSTRUCOES = f"""Você anota pedidos de passagem aérea pra K&V, uma agência que emite passagens em milhas ou em dinheiro.
O dono da agência te manda, em português e do jeito que fala, o que um cliente pediu no WhatsApp. Transforme isso num orçamento.

Regras:
- Trechos: cada deslocamento vira um trecho. Ida e volta são 2 trechos (o segundo invertido). Roteiro com várias cidades vira vários trechos, na ordem.
- Aeroportos em código IATA. Cidade com mais de um aeroporto: São Paulo = GRU, Rio de Janeiro = GIG, Belo Horizonte = CNF, a menos que a pessoa diga outro.
- Se não disser de onde sai, use GRU e ponha "cidade de saída" em faltando.
- Datas em AAAA-MM-DD. Resolva datas relativas a partir de hoje; data sem ano é a próxima ocorrência. data_flexivel é true, a não ser que a pessoa diga que a data é fixa.
- Passageiros: quem viaja. Sem número dito, 1 adulto. Criança: 2 a 11 anos. Bebê: menos de 2.
- pedidos_especiais: use exatamente estes textos quando couberem: {", ".join(PEDIDOS_CONHECIDOS)}. Outros pedidos, em frase curta.
- observacao: o que mais for útil pro pesquisador e não couber nos campos (ex.: "aniversário de casamento", "aceita sair de Campinas"). Vazio se não houver.
- faltando: o que precisa perguntar ao cliente antes de pesquisar (ex.: "data da volta", "quantas pessoas"). Não invente dados pra preencher lacunas.
- nome_contato e whatsapp: só se aparecerem na mensagem.
- e_pedido_de_viagem: false se a mensagem não for um pedido de viagem; aí os outros campos podem ficar vazios."""

cliente_ia = anthropic.Anthropic() if os.environ.get("ANTHROPIC_API_KEY") else None


def interpretar(texto):
    hoje = datetime.date.today()
    resp = cliente_ia.messages.parse(
        model=MODELO,
        max_tokens=16000,
        system=INSTRUCOES,
        messages=[{"role": "user", "content": f"Hoje é {hoje.isoformat()} ({hoje.strftime('%A')}).\n\nPedido:\n{texto}"}],
        output_format=Pedido,
    )
    if resp.stop_reason == "refusal":
        return None
    return resp.parsed_output


# ---------- fila dos rascunhos ----------
def ler_pedidos():
    try:
        return json.loads(ARQ_PEDIDOS.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def gravar_pedidos(lista):
    ARQ_PEDIDOS.parent.mkdir(parents=True, exist_ok=True)
    tmp = ARQ_PEDIDOS.with_suffix(".tmp")
    tmp.write_text(json.dumps(lista, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(ARQ_PEDIDOS)  # troca de uma vez: a fila nunca lê um arquivo pela metade


def salvar(p: Pedido, texto, chat_id, veio_de_audio):
    lista = ler_pedidos()
    especiais = [e.strip() for e in p.pedidos_especiais if e.strip()]
    novo = {
        "id": f"tg{int(time.time())}",
        "origem": "telegram", "audio": veio_de_audio, "chat": str(chat_id), "textoOriginal": texto,
        "criadoEm": datetime.datetime.now().isoformat(timespec="seconds"),
        "contato": {"nome": p.nome_contato or "Sem nome", "whatsapp": p.whatsapp or ""},
        "trechos": [{"de": t.de.upper(), "para": t.para.upper(), "data": t.data, "janela": t.data_flexivel} for t in p.trechos],
        "passageiros": {"adultos": max(p.adultos, 0), "criancas": max(p.criancas, 0), "bebes": max(p.bebes, 0)},
        "pedido": " · ".join(especiais), "especiais": especiais,
        "observacao": p.observacao.strip(), "faltando": [f for f in p.faltando if f.strip()],
    }
    lista.append(novo)
    gravar_pedidos(lista)
    return novo


def data_br(iso):
    try:
        return datetime.date.fromisoformat(iso).strftime("%d/%m")
    except ValueError:
        return iso


def resumo(o):
    pax = o["passageiros"]
    pessoas = ", ".join(x for x in [
        pax["adultos"] and f"{pax['adultos']} adulto{'s' if pax['adultos'] > 1 else ''}",
        pax["criancas"] and f"{pax['criancas']} criança{'s' if pax['criancas'] > 1 else ''}",
        pax["bebes"] and f"{pax['bebes']} bebê{'s' if pax['bebes'] > 1 else ''}",
    ] if x)
    linhas = ["Anotado! Já está na fila como Novo.", "",
              f"{o['contato']['nome']}{' · ' + o['contato']['whatsapp'] if o['contato']['whatsapp'] else ''}"]
    linhas += [f"{t['de']} → {t['para']}  {data_br(t['data'])}{'' if t['janela'] else ' (data fixa)'}" for t in o["trechos"]]
    linhas.append(pessoas or "passageiros a confirmar")
    if o["pedido"]:
        linhas.append(f"Pedido: {o['pedido']}")
    if o["observacao"]:
        linhas.append(f"Obs.: {o['observacao']}")
    if o["faltando"]:
        linhas += ["", "Falta perguntar: " + "; ".join(o["faltando"])]
    linhas += ["", f"Abrir: {URL_RASCUNHOS}/orcamento.html?id={o['id']}", "Errou? Mande /desfazer."]
    return "\n".join(linhas)


AJUDA = ("Oi! Sou o bot da K&V. Me mande o pedido do cliente, escrito ou em áudio, do jeito que você falaria. "
         "Ex.: \"A Maria Souza, (11) 91234-5678, quer ir pra Lisboa dia 12/11 com o marido, volta dia 26, só voo direto.\"\n\n"
         "Eu anoto como orçamento novo na fila dos pesquisadores.\n/desfazer apaga o último que você mandou.")


# ---------- laço principal ----------
def tratar(msg):
    chat_id = msg["chat"]["id"]
    texto = (msg.get("text") or "").strip()
    if texto.startswith("/start") or texto.startswith("/ajuda"):
        responder(chat_id, AJUDA + (f"\n\nSeu número de chat: {chat_id}" if str(chat_id) not in CHATS else ""))
        return
    if CHATS and str(chat_id) not in CHATS:
        responder(chat_id, "Este bot é só pra equipe da K&V.")
        return
    if not CHATS:
        responder(chat_id, f"Falta liberar este chat. Ponha KV_CHATS={chat_id} no bot/.env e reinicie o bot.")
        return
    if texto.startswith("/desfazer"):
        lista = ler_pedidos()
        meus = [o for o in lista if o.get("chat") == str(chat_id)]
        if not meus:
            responder(chat_id, "Não tem nada seu pra desfazer.")
            return
        ultimo = meus[-1]
        gravar_pedidos([o for o in lista if o["id"] != ultimo["id"]])
        responder(chat_id, f"Apaguei o pedido de {ultimo['contato']['nome']}.")
        return

    voz = msg.get("voice") or msg.get("audio")
    if voz:
        telegram("sendChatAction", chat_id=chat_id, action="typing")
        with tempfile.TemporaryDirectory() as pasta:
            arq = Path(pasta) / "audio.ogg"
            baixar_arquivo(voz["file_id"], arq)
            texto = transcrever(arq)
        if not texto:
            responder(chat_id, "Não consegui entender o áudio. Pode mandar de novo ou escrever?")
            return
        responder(chat_id, f"Entendi assim: \"{texto}\"")
    if not texto:
        responder(chat_id, "Me mande o pedido em texto ou áudio.")
        return

    telegram("sendChatAction", chat_id=chat_id, action="typing")
    try:
        p = interpretar(texto)
    except anthropic.APIConnectionError:
        responder(chat_id, "Fiquei sem internet pra falar com a IA. Tenta de novo em instantes.")
        return
    except anthropic.RateLimitError:
        responder(chat_id, "A IA está ocupada agora. Tenta de novo em um minuto.")
        return
    except anthropic.APIStatusError as e:
        print(f"[erro] API {e.status_code}: {e.message}")
        responder(chat_id, "Deu um erro na IA. Avise o Ikky.")
        return
    if p is None:
        responder(chat_id, "A IA não quis processar essa mensagem. Pode reescrever?")
        return
    if not p.e_pedido_de_viagem or not p.trechos:
        responder(chat_id, "Não entendi isso como um pedido de viagem. Me diga pra onde, quando e quantas pessoas.")
        return
    o = salvar(p, texto, chat_id, bool(voz))
    responder(chat_id, resumo(o))
    print(f"[ok] {o['id']}: {o['contato']['nome']} {[t['de'] + '-' + t['para'] for t in o['trechos']]}")


def main():
    if not TOKEN:
        sys.exit("Falta TELEGRAM_TOKEN no bot/.env (pegue com o @BotFather no Telegram).")
    if not cliente_ia:
        sys.exit("Falta ANTHROPIC_API_KEY no bot/.env.")
    eu = telegram("getMe")
    print(f"Bot @{eu['username']} ligado. Modelo: {MODELO}. Chats liberados: {', '.join(CHATS) or 'nenhum ainda'}. Ctrl+C pra parar.")
    offset = None
    while True:
        try:
            for upd in telegram("getUpdates", offset=offset, timeout=50, allowed_updates='["message"]'):
                offset = upd["update_id"] + 1
                if "message" in upd:
                    try:
                        tratar(upd["message"])
                    except Exception as e:  # uma mensagem com problema não derruba o bot
                        print(f"[erro] {type(e).__name__}: {e}")
                        try:
                            responder(upd["message"]["chat"]["id"], "Deu um erro aqui. Tenta de novo?")
                        except Exception:
                            pass
        except KeyboardInterrupt:
            print("Bot desligado.")
            return
        except Exception as e:  # queda de internet: espera e tenta de novo
            print(f"[aviso] {type(e).__name__}: {e}. Tentando de novo em 5s.")
            time.sleep(5)


if __name__ == "__main__":
    main()
