---
name: K&V Admin
description: Sistema interno da K&V, agência de passagens em pontos e em dinheiro.
colors:
  noite: "#010E1F"
  superficie-1: "#0B1B30"
  superficie-2: "#13263F"
  superficie-3: "#1C3352"
  linha: "#213A5C"
  texto: "#F3F6FA"
  texto-2: "#A9B8CC"
  texto-3: "#7F93AE"
  laranja: "#FF8911"
  tinta-laranja: "#1F1000"
  petroleo: "#1A8BA6"
  petroleo-claro: "#68ACBE"
  ok: "#3CCB8B"
  atencao: "#F5C451"
  perigo: "#FF6B6B"
  claro-fundo: "#F4F7FB"
  claro-texto: "#0B1B30"
  claro-laranja: "#E8740A"
typography:
  marca:
    fontFamily: "Montserrat, Urbanist, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
  titulo:
    fontFamily: "Urbanist, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  secao:
    fontFamily: "Urbanist, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.15
  corpo:
    fontFamily: "Urbanist, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.45
  rotulo:
    fontFamily: "Urbanist, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 700
rounded:
  chip: "10px"
  campo: "12px"
  cartao: "20px"
  cartao-grande: "26px"
  pilula: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  botao-primario:
    backgroundColor: "{colors.laranja}"
    textColor: "{colors.tinta-laranja}"
    rounded: "{rounded.pilula}"
    height: "42px"
    padding: "0 18px"
  botao:
    backgroundColor: "{colors.superficie-1}"
    textColor: "{colors.texto}"
    rounded: "{rounded.pilula}"
    height: "42px"
    padding: "0 18px"
  pilula-filtro:
    backgroundColor: "{colors.noite}"
    textColor: "{colors.texto-2}"
    rounded: "{rounded.pilula}"
    height: "34px"
  pilula-filtro-ativa:
    backgroundColor: "{colors.texto}"
    textColor: "{colors.noite}"
    rounded: "{rounded.pilula}"
    height: "34px"
  cartao:
    backgroundColor: "{colors.superficie-1}"
    rounded: "{rounded.cartao}"
    padding: "20px"
  cartao-destaque:
    backgroundColor: "{colors.laranja}"
    textColor: "{colors.tinta-laranja}"
    rounded: "{rounded.cartao-grande}"
    padding: "20px"
  campo:
    backgroundColor: "{colors.superficie-2}"
    textColor: "{colors.texto}"
    rounded: "{rounded.campo}"
    height: "44px"
---

# Design System: K&V Admin

## Overview

**Creative North Star: "Painel de voo à noite"**

A K&V é azul-marinho com um laranja que chama a atenção: o céu noturno com a luz de um avião. A interface usa o marinho da logo como fundo, superfícies um pouco mais claras empilhadas e o laranja só onde precisa de ação ou atenção do dono, como o "&" na logo. O azul-petróleo do arco fica com o mundo dos pontos e milhas.

É uma ferramenta de trabalho (dono no celular, pesquisadores no computador), então a leitura vem antes do enfeite. A referência é o redesign do HubSpot CRM (Behance): números grandes no topo, cartões grandes e arredondados com o botão redondo ↗ no canto, um cartão em cor cheia pro que precisa de você agora, filtros em pílula com contagem e a situação trocada dentro do próprio cartão. O verde-limão da referência foi trocado pelo laranja da marca.

**Key Characteristics:**
- Fundo marinho, superfícies empilhadas, quase nenhuma borda ou sombra.
- Laranja raro: ação principal e "precisa de você".
- Números grandes em Montserrat; o resto em Urbanist.
- Cartões com poucos dados e muito respiro.
- Tema escuro por padrão, com tema claro equivalente.

## Colors

Neutros azulados da logo, um destaque laranja e um secundário petróleo pra informação de pontos.

### Primary
- **Laranja do "&"** (#FF8911): botão principal, cartão em destaque, número que pede ação. No tema claro escurece pra #E8740A.

### Secondary
- **Petróleo do arco** (#1A8BA6, claro #68ACBE): pontos, milhas, programas, vagas e o pedido especial.

### Neutral
- **Noite** (#010E1F): fundo da página.
- **Superfícies 1, 2 e 3** (#0B1B30, #13263F, #1C3352): cartões, campos e hover, do mais fundo pro mais claro.
- **Linha** (#213A5C): divisória, só quando precisa.
- **Texto, texto 2 e texto 3** (#F3F6FA, #A9B8CC, #7F93AE): principal, secundário legível e rótulos.

### Named Rules
**A Regra da Luz do Avião.** O laranja aparece em pouca coisa por tela: o botão principal e o que espera o dono. Se tudo é laranja, nada chama a atenção.

**A Regra dos Estados Calmos.** Verde (#3CCB8B), amarelo (#F5C451) e vermelho (#FF6B6B) só pra estados (pago, vencendo, perdido), sempre em fundo suave, nunca competindo com o laranja.

## Typography

**Display Font:** Montserrat ExtraBold (a mesma do "EASY TRAVELING" da logo)
**Body Font:** Urbanist (com system-ui)

**Character:** Montserrat pesada só pros números grandes e pro nome K&V; Urbanist geométrica e leve pra ler o dia todo. º e ª usam a fonte do sistema (`KV Ordinal`), porque a Urbanist desenha esses caracteres como letras comuns.

### Hierarchy
- **Marca / números grandes** (800, 26 a 40px, 1.05): KPIs do topo, rota do orçamento, valor em destaque.
- **Título** (600 a 700, 28 a 34px, 1.15): título da tela.
- **Seção** (600 a 700, 19 a 22px): título de bloco.
- **Corpo** (500, 15px, 1.45): texto e tabelas, com algarismos tabulares.
- **Rótulo** (700, 12 a 13.5px): legendas e etiquetas; mínimo de 12px.

## Layout

Menu lateral fino de ícones (76px) no computador, que vira barra embaixo no celular. A área de trabalho tem 28 a 32px de margem no computador e 16px no celular. Cartões em grade que se ajusta sozinha (mínimo de 270 a 320px por coluna). No celular tudo empilha em uma coluna, as pílulas rolam de lado e as janelas sobem de baixo. Tabelas continuam tabelas no celular (rolam de lado, com a primeira coluna fixa).

## Elevation & Depth

Profundidade por tons de superfície, não por sombra. Sombra (`0 12px 32px rgb(0 0 0 / .4)`) só no que flutua: janelas, listas de seleção e barras fixas.

## Shapes

Tudo arredondado: pílulas (999px) em botões e filtros, campos com 12px, cartões com 20px e cartões grandes com 26px. O cartão grande tem um "recorte" no canto superior direito: um anel da cor do fundo com o botão redondo ↗ dentro.

## Components

### Buttons
- **Shape:** pílula (999px), 42px de altura.
- **Primary:** laranja com texto escuro.
- **Default:** superfície 1 com borda de linha; hover sobe pra superfície 2.
- **Redondo:** 40 a 44px, só ícone (↗, WhatsApp).

### Chips
- **Pílula de filtro:** contorno de linha, texto 2; ativa vira texto claro em fundo branco, com a contagem ao lado.
- **Etiqueta:** pílula pequena (28px) em superfície 2; amarela pra aviso.

### Cards / Containers
- **Corner Style:** 20px (padrão) e 26px (cartão grande da referência).
- **Background:** superfície 1; o cartão em destaque é laranja cheio com texto escuro.
- **Internal Padding:** 20px.

### Inputs / Fields
- **Style:** superfície 2, borda de linha, 12px de raio, 44px de altura, texto de 16px (não dá zoom no celular).
- **Focus:** borda ou contorno laranja.
- **Listas longas:** viram campo de busca que filtra antes de escolher.

### Navigation
- Menu lateral de ícones com dica no hover; item atual em superfície 2. O pesquisador vê só Orçamentos e Ponto.

## Do's and Don'ts

### Do:
- **Do** usar números grandes em Montserrat pro que importa e deixar o resto pequeno.
- **Do** deixar um cartão em laranja cheio só quando ele espera o dono.
- **Do** pôr a situação trocável dentro do cartão, em seletor de pílula.
- **Do** testar no celular e no computador; o dono usa o celular.

### Don't:
- **Don't** usar verde-limão neon, fotos de avatar ou palavras gigantes decorativas da referência.
- **Don't** usar carrossel horizontal de cartões pra listas longas.
- **Don't** usar texto menor que 12px nem cinza-fantasma sobre o fundo.
- **Don't** encher a tela: uma coisa por cartão, o resto num toque.
