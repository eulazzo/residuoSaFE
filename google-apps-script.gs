/**
 * ResíduoSafe — recebimento de leads da landing de validação.
 *
 * Este arquivo NÃO roda no site. Ele é colado no editor de Apps Script
 * de uma planilha do Google. Passo a passo no README.md.
 *
 * O que faz: recebe o JSON enviado pelo formulário e grava uma linha
 * na aba "Leads", criando o cabeçalho na primeira execução.
 */

var SHEET_NAME = 'Leads';

/**
 * Ordem das colunas. Cada item é [título, função que extrai o valor].
 * Para adicionar um campo novo, basta acrescentar uma linha aqui —
 * o cabeçalho da planilha é sincronizado automaticamente.
 */
var COLUNAS = [
  ['Data/hora',        function (d) { return parseData_(d.meta && d.meta.enviado_em); }],
  ['Nome',             function (d) { return d.nome; }],
  ['E-mail',           function (d) { return d.email; }],
  ['WhatsApp',         function (d) { return d.whatsapp; }],
  ['Trabalha em',      function (d) { return d.segmento; }],
  ['Unidades',         function (d) { return d.unidades; }],
  ['Controle atual',   function (d) { return lista_(d.controle_atual); }],
  ['Terceirizado?',    function (d) { return temItem_(d.controle_atual, 'Empresa terceirizada') ? 'Sim' : 'Não'; }],
  ['Maior dificuldade', function (d) { return d.dificuldade; }],
  ['Interesse',        function (d) { return d.interesse; }],
  ['Preço aceitável',  function (d) { return d.preco || ''; }],
  ['utm_source',       function (d) { return utm_(d, 'utm_source'); }],
  ['utm_medium',       function (d) { return utm_(d, 'utm_medium'); }],
  ['utm_campaign',     function (d) { return utm_(d, 'utm_campaign'); }],
  ['utm_term',         function (d) { return utm_(d, 'utm_term'); }],
  ['utm_content',      function (d) { return utm_(d, 'utm_content'); }],
  ['Referrer',         function (d) { return (d.meta && d.meta.referrer) || ''; }],
  ['Página',           function (d) { return (d.meta && d.meta.pagina) || ''; }],
  ['Navegador',        function (d) { return (d.meta && d.meta.user_agent) || ''; }]
];

/* ---------------------------------------------------------------
   Endpoint
   --------------------------------------------------------------- */

function doPost(e) {
  var lock = LockService.getScriptLock();

  try {
    // Evita duas gravações simultâneas caírem na mesma linha
    lock.waitLock(20000);

    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'Requisição sem corpo.' });
    }

    var dados = JSON.parse(e.postData.contents);

    // Honeypot: bots preenchem o campo escondido, pessoas não.
    // Responde ok para não ensinar o bot a contornar.
    if (dados.website) {
      return json_({ ok: true });
    }

    var aba = getAba_();
    aba.appendRow(montarLinha_(dados));

    return json_({ ok: true });

  } catch (err) {
    // Registrado em Execuções, no editor do Apps Script
    console.error(err);
    return json_({ ok: false, error: String(err && err.message || err) });

  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

/** Health check: abrir a URL da implantação no navegador deve mostrar isto. */
function doGet() {
  return json_({ ok: true, service: 'residuosafe-leads', leads: contarLeads_() });
}

/* ---------------------------------------------------------------
   Planilha
   --------------------------------------------------------------- */

function getAba_() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(SHEET_NAME) || planilha.insertSheet(SHEET_NAME);

  var titulos = COLUNAS.map(function (c) { return c[0]; });

  // Cria o cabeçalho na primeira vez, ou reescreve se colunas foram adicionadas
  if (aba.getLastRow() === 0 || aba.getLastColumn() < titulos.length) {
    aba.getRange(1, 1, 1, titulos.length).setValues([titulos]).setFontWeight('bold');
    aba.setFrozenRows(1);
    aba.getRange(1, 1, 1, titulos.length).setBackground('#07182F').setFontColor('#FFFFFF');
  }

  return aba;
}

function montarLinha_(dados) {
  return COLUNAS.map(function (coluna) {
    try {
      var valor = coluna[1](dados);
      return valor === null || valor === undefined ? '' : valor;
    } catch (err) {
      return '';
    }
  });
}

function contarLeads_() {
  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  return aba ? Math.max(0, aba.getLastRow() - 1) : 0;
}

/* ---------------------------------------------------------------
   Auxiliares
   --------------------------------------------------------------- */

function parseData_(iso) {
  var d = iso ? new Date(iso) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
}

function lista_(valor) {
  if (Array.isArray(valor)) return valor.join(', ');
  return valor || '';
}

function temItem_(valor, alvo) {
  if (Array.isArray(valor)) return valor.indexOf(alvo) !== -1;
  return String(valor || '').indexOf(alvo) !== -1;
}

function utm_(dados, chave) {
  return (dados.meta && dados.meta.utm && dados.meta.utm[chave]) || '';
}

function json_(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------------------------------------------------------------
   Teste manual: rode esta função no editor para conferir se a
   planilha recebe a linha corretamente, sem precisar do site.
   --------------------------------------------------------------- */

function testarGravacao() {
  var exemplo = {
    nome: 'Teste Manual',
    email: 'teste@exemplo.com',
    whatsapp: '(11) 90000-0000',
    segmento: 'Clínica odontológica',
    unidades: '2-5',
    controle_atual: ['Excel', 'WhatsApp'],
    dificuldade: 'Linha de teste — pode apagar.',
    interesse: 'Sim, teria bastante interesse',
    preco: 'R$100–200/mês',
    meta: {
      enviado_em: new Date().toISOString(),
      pagina: 'teste',
      referrer: '',
      utm: { utm_source: 'teste' },
      user_agent: 'Apps Script'
    }
  };

  getAba_().appendRow(montarLinha_(exemplo));
  Logger.log('Linha de teste gravada em "%s".', SHEET_NAME);
}
