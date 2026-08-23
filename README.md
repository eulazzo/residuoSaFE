# ResíduoSafe — Landing de validação de demanda

Landing page estática (HTML + CSS + JS puro, sem build) cujo único objetivo é
**gerar interesse, coletar leads e validar o problema e a disposição a pagar**
antes de desenvolver o SaaS.

## Arquivos

| Arquivo                 | O que é                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| `index.html`            | Estrutura completa da página + SEO + JSON-LD                              |
| `styles.css`            | Todo o design system (tokens em `:root`)                                  |
| `script.js`             | Máscara, validação, envio, analytics e modal                              |
| `favicon.svg`           | Ícone da aba                                                              |
| `google-apps-script.gs` | Não roda no site: é colado no Apps Script da planilha que recebe os leads |

Basta abrir o `index.html` no navegador — não há dependências além das fontes do
Google Fonts.

## Enviar os leads para uma planilha

Cada envio do formulário vira uma linha numa planilha do Google, com todos os
campos preenchidos. Não é preciso servidor: a própria planilha hospeda o
endpoint, via Apps Script. São 5 minutos de configuração.

### 1. Criar a planilha

Crie uma planilha nova no Google Sheets. O nome é livre; a aba `Leads` e o
cabeçalho são criados sozinhos no primeiro envio.

### 2. Colar o script

Na planilha: **Extensões → Apps Script**. Apague o conteúdo do editor e cole
o arquivo [`google-apps-script.gs`](google-apps-script.gs) inteiro. Salve.

Vale testar antes de publicar: selecione a função `testarGravacao` e clique em
**Executar**. O Google vai pedir autorização uma vez (é normal — o script é
seu e está acessando a sua planilha; em "Avançado", escolha prosseguir). Se uma
linha de teste aparecer na aba `Leads`, está funcionando. Depois é só apagar
essa linha.

### 3. Publicar como app da web

No editor: **Implantar → Nova implantação → tipo: App da Web**, com

| Campo             | Valor               |
| ----------------- | ------------------- |
| Executar como     | **Eu**              |
| Quem pode acessar | **Qualquer pessoa** |

"Qualquer pessoa" é obrigatório — quem envia o formulário não está logado no
Google. Isso libera apenas o endpoint, não a planilha: ninguém consegue ler os
dados por ali, só gravar.

Copie a URL gerada, no formato
`https://script.google.com/macros/s/AKfy.../exec`.

### 4. Ligar na landing

Em [`script.js`](script.js), no topo:

```js
var CONFIG = {
  LEADS_ENDPOINT: 'https://script.google.com/macros/s/AKfy.../exec',
  ENDPOINT_MODE: 'apps_script',
  ...
};
```

Pronto. Para conferir se o endpoint está no ar, abra a URL direto no
navegador: ela responde `{"ok":true,"service":"residuosafe-leads","leads":N}`.

> Ao alterar o `.gs` depois, é preciso **Implantar → Gerenciar implantações →
> editar → Versão: Nova versão**. Sem isso a URL continua servindo o código
> antigo — é a pegadinha mais comum do Apps Script.

### Colunas da planilha

Data/hora · Nome · E-mail · WhatsApp · Trabalha em · Unidades · Controle
atual · Terceirizado? · Maior dificuldade · Interesse · Preço aceitável ·
utm_source · utm_medium · utm_campaign · utm_term · utm_content · Referrer ·
Página · Navegador

Para acrescentar um campo, adicione uma linha em `COLUNAS` no `.gs` — o
cabeçalho se ajusta sozinho.

### Outros destinos

`ENDPOINT_MODE: 'json'` envia `Content-Type: application/json` para uma API
própria, Supabase, n8n ou Make. O modo `apps_script` usa `text/plain` de
propósito: assim o navegador não dispara o preflight `OPTIONS`, que o Apps
Script não sabe responder — o corpo continua sendo JSON.

Com `LEADS_ENDPOINT: null`, o envio é simulado (delay + gravação em
`localStorage` sob a chave `residuosafe_leads`), útil para testar o funil sem
tocar na planilha.

### Se um envio falhar

O visitante vê uma mensagem pedindo para tentar de novo, o modal de sucesso
não abre e o botão volta ao normal. O motivo técnico vai para o console do
navegador e para o evento `form_error`.

### Formato do payload

```json
{
  "nome": "...",
  "email": "...",
  "whatsapp": "(11) 91234-5678",
  "whatsapp_digits": "11912345678",
  "segmento": "Clínica odontológica",
  "unidades": "2-5",
  "controle_atual": ["Excel", "WhatsApp"],
  "dificuldade": "...",
  "interesse": "Sim, teria bastante interesse",
  "preco": "R$100–200/mês",
  "meta": {
    "enviado_em": "2026-08-23T14:02:00.000Z",
    "pagina": "https://...",
    "referrer": "...",
    "utm": { "utm_source": "..." },
    "user_agent": "..."
  }
}
```

Os parâmetros UTM da URL são capturados automaticamente.

## Analytics

A função `track()` em `script.js` repassa cada evento para o que estiver
carregado na página — `dataLayer` (GTM), `gtag` (GA4) e `fbq` (Meta Pixel).
Não é preciso alterar o código: basta colar os scripts das plataformas no
`<head>` do `index.html`.

Eventos disparados:

| Evento                      | Quando                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `hero_cta_clicked`          | qualquer CTA âncora (com `cta_location`: `hero`, `header`, `final`, `mobile_sticky`, `hero_secondary`)                          |
| `form_started`              | primeira interação real com o formulário                                                                                        |
| `form_completed`            | envio bem-sucedido                                                                                                              |
| `current_control_answered`  | primeira marcação em "Como você controla isso atualmente?" (dispara uma vez; traz `controle_atual` e o booleano `terceirizado`) |
| `pricing_question_answered` | resposta da pergunta de preço                                                                                                   |
| `interest_high`             | marcou "Sim, teria bastante interesse"                                                                                          |
| `form_error`                | falha no envio                                                                                                                  |

Para ver os eventos no console durante testes:

```js
window.RESIDUOSAFE_DEBUG = true;
```

O mapeamento para eventos padrão do Meta Pixel fica em `META_MAP`
(`form_completed` → `Lead`).

## Decisões de conteúdo

Seguindo o briefing, a página **não** afirma conformidade legal, não promete
evitar multas e não faz promessas jurídicas — usa apenas "organizar",
"centralizar", "acompanhar" e "identificar possíveis pendências". Também deixa
explícito em vários pontos que o produto está em fase de validação.

Não há prova social inventada: a seção de validação contém apenas um **espaço
reservado** para depoimentos futuros. O dashboard do hero é rotulado como
"representação ilustrativa da interface planejada".

## O que ainda falta antes de publicar

- Páginas de Privacidade e Termos (os links no rodapé estão como `#`).
- Domínio real nas tags `canonical` e `og:url`.
- Imagem `og:image` para compartilhamento em redes sociais.
