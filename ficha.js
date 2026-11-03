/*
 * Compilador determinístico da ficha do cliente para o dados-empresa.json (sem IA).
 * Entrada: os valores digitados na ficha, como texto. Saída: o JSON, a lista de pendências e avisos.
 * A mesma ficha gera sempre o mesmo JSON. Funciona no navegador (global CTFicha) e no Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CTFicha = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var REGIMES = ['simples', 'presumido', 'real'];
  var ANEXOS = ['I', 'II', 'III', 'IV', 'V', 'III_ou_V_fator_r', 'vedado'];
  /* Tipos de presunção que indicam comércio ou indústria: sem ISS por padrão. Os demais são serviço: sem ICMS por padrão. */
  var TIPOS_COMERCIO = ['comercio_industria', 'revenda_combustiveis'];

  /* "42.000,50", "R$ 42000", "42000.5" ou "3%" -> número. NaN se não for número. */
  function brNum(s) {
    s = String(s == null ? '' : s).replace(/R\$|%|\s/g, '');
    if (s === '') return NaN;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  }

  /* Lista colada do Excel (uma coluna), separada por ";", tab, quebra de linha ou espaço. */
  function lerLista(txt) {
    var raw = String(txt == null ? '' : txt).replace(/R\$/g, '').trim();
    if (raw === '') return { itens: [], vals: [], ok: true };
    var sep = /[\n;\t]/.test(raw) ? /[\n;\t]+/ : /\s+/;
    var itens = raw.split(sep).map(function (x) { return x.trim(); }).filter(Boolean);
    var vals = itens.map(brNum);
    return { itens: itens, vals: vals, ok: vals.every(function (v) { return !isNaN(v); }) };
  }

  function r2(n) { return Math.round(n * 100) / 100; }

  /* "6201501" ou "6201-5/01" -> "6201-5/01". Retorna null se não tiver 7 dígitos. */
  function formatarCnae(s) {
    var d = String(s == null ? '' : s).replace(/\D/g, '');
    if (d.length !== 7) return null;
    return d.slice(0, 4) + '-' + d.slice(4, 5) + '/' + d.slice(5);
  }

  function slug(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  }

  function compilarFicha(e, aliq) {
    e = e || {};
    var pend = [], avisos = [], meta = {};
    function P(caminho, rotulo) { pend.push({ caminho: caminho, rotulo: rotulo }); }
    function premissa(caminho, justificativa) {
      meta[caminho] = { origem: 'premissa', confianca: 'media', justificativa: justificativa, fonte: 'Regra fixa do compilador da ficha' };
    }
    function numero(txt, caminho, rotulo, obrig) {
      var s = String(txt == null ? '' : txt).trim();
      if (s === '') { if (obrig) P(caminho, rotulo + ': não informado'); return null; }
      var n = brNum(s);
      if (isNaN(n)) { P(caminho, rotulo + ': valor não numérico "' + s + '"'); return null; }
      return n;
    }
    /* Campo mensal: um valor (vale para os 12 meses) ou 12 valores. */
    function mensal(txt, caminho, rotulo, obrig, padrao) {
      var l = lerLista(txt);
      if (!l.itens.length) {
        if (padrao !== undefined) return padrao;
        if (obrig) P(caminho, rotulo + ': não informado');
        return null;
      }
      if (!l.ok) { P(caminho, rotulo + ': há valor não numérico'); return null; }
      if (l.vals.length === 1) return l.vals[0];
      if (l.vals.length === 12) return l.vals;
      P(caminho, rotulo + ': esperado 1 ou 12 valores, veio ' + l.vals.length);
      return null;
    }

    var ano = numero(e.ano, 'ano_calendario', 'Ano-calendário', true);
    if (ano !== null && ano !== Math.round(ano)) { P('ano_calendario', 'Ano-calendário: use número inteiro'); ano = null; }

    var situacao = e.situacao === 'EM_ABERTURA' ? 'em_abertura' : e.situacao === 'ATIVA' ? 'ativa' : null;
    if (!situacao) P('empresa.situacao', 'Situação: escolha ATIVA ou EM_ABERTURA');
    var ativa = situacao !== 'em_abertura';

    var regimes = (e.regimes || []).filter(function (r) { return REGIMES.indexOf(r) >= 0; });
    if (!regimes.length) regimes = REGIMES.slice();
    var temReal = regimes.indexOf('real') >= 0;

    /* ---------- atividades ---------- */
    var tiposValidos = aliq && aliq.lucro_presumido && aliq.lucro_presumido.presuncao ? Object.keys(aliq.lucro_presumido.presuncao) : null;
    var ids = {};
    var soma = 0;
    var atividades = (e.atividades || []).map(function (a, k) {
      var base = 'atividades[' + k + ']', rot = 'Atividade ' + (k + 1);
      var cnae = formatarCnae(a.cnae);
      if (!cnae) P(base + '.cnae', rot + ': CNAE com 7 dígitos' + (a.cnae ? ' (veio "' + a.cnae + '")' : ''));
      var desc = String(a.desc || '').trim();
      var id = slug(desc) || ('atividade_' + (k + 1));
      while (ids[id]) id += '_' + (k + 1);
      ids[id] = 1;
      var pct = numero(a.pct, base + '.percentual_receita', rot + ': % da receita', true);
      if (pct !== null) soma += pct;
      var anexo = ANEXOS.indexOf(a.anexo) >= 0 ? a.anexo : null;
      if (!anexo) P(base + '.anexo_simples', rot + ': anexo do Simples');
      var tipo = a.tipo ? a.tipo : null;
      if (!tipo) P(base + '.tipo_presumido', rot + ': tipo de presunção');
      else if (tiposValidos && tiposValidos.indexOf(tipo) < 0) { P(base + '.tipo_presumido', rot + ': tipo de presunção "' + tipo + '" não existe no aliquotas.json'); tipo = null; }
      var comercio = tipo && TIPOS_COMERCIO.indexOf(tipo) >= 0;
      var iss = numero(a.iss, base + '.iss_percentual', rot + ': ISS %', false);
      if (iss === null && String(a.iss || '').trim() === '') {
        if (comercio) { iss = 0; premissa(base + '.iss_percentual', 'Atividade de comércio ou indústria: sem ISS.'); }
        else P(base + '.iss_percentual', rot + ': ISS % (consultar a lei do município)');
      }
      if (iss !== null && iss !== 0 && (iss < 2 || iss > 5)) avisos.push(rot + ': ISS de ' + iss + '% fora da faixa legal de 2% a 5% (LC 116/2003, arts. 8º e 8º-A).');
      var icms = numero(a.icms, base + '.icms_liquido_percentual_receita', rot + ': ICMS líquido %', false);
      if (icms === null && String(a.icms || '').trim() === '') {
        if (tipo && !comercio) { icms = 0; premissa(base + '.icms_liquido_percentual_receita', 'Atividade de serviço: sem ICMS.'); }
        else P(base + '.icms_liquido_percentual_receita', rot + ': ICMS líquido % da receita (apuração de entradas e saídas)');
      }
      return {
        id: id, descricao: desc, cnae: cnae || (a.cnae ? String(a.cnae) : null), percentual_receita: pct,
        anexo_simples: anexo, tipo_presumido: tipo, iss_percentual: iss, icms_liquido_percentual_receita: icms
      };
    });
    if (!atividades.length) P('atividades', 'Informe ao menos uma atividade');
    else if (Math.abs(soma - 100) > 0.01) P('atividades', 'Os % da receita das atividades somam ' + r2(soma) + ', devem somar 100');

    /* ---------- receitas ---------- */
    var hl = lerLista(e.hist), hist = [];
    if (!hl.itens.length) { if (ativa) P('receitas.historico_12_meses_anteriores', 'Receita dos 12 meses anteriores: não informada (só fica vazia em empresa em abertura)'); }
    else if (!hl.ok) { P('receitas.historico_12_meses_anteriores', 'Receita dos 12 meses anteriores: há valor não numérico'); hist = null; }
    else if (hl.vals.length !== 12) { P('receitas.historico_12_meses_anteriores', 'Receita dos 12 meses anteriores: esperado 12 valores, veio ' + hl.vals.length); hist = null; }
    else hist = hl.vals;

    var sl = lerLista(e.sim), sim = null;
    var cresc = numero(e.cresc, 'premissa.crescimento', 'Crescimento %', false);
    if (sl.itens.length) {
      if (!sl.ok) P('receitas.simulacao_12_meses', 'Receita simulada: há valor não numérico');
      else if (sl.vals.length !== 12) P('receitas.simulacao_12_meses', 'Receita simulada: esperado 12 valores, veio ' + sl.vals.length);
      else sim = sl.vals;
      if (cresc !== null) avisos.push('Crescimento informado foi ignorado, porque a receita simulada já tem os 12 meses.');
    } else if (hist && hist.length === 12) {
      var g = cresc === null ? 0 : cresc;
      sim = hist.map(function (v) { return r2(v * (1 + g / 100)); });
      premissa('receitas.simulacao_12_meses', cresc === null
        ? 'Sem receita simulada nem crescimento: repete a receita dos 12 meses anteriores.'
        : 'Receita dos 12 meses anteriores com crescimento de ' + g + '%.');
    } else P('receitas.simulacao_12_meses', 'Receita simulada: informe os 12 meses (ou o histórico, para repeti-lo)');

    /* ---------- folha e sócios ---------- */
    var usaFatorR = atividades.some(function (a) { return a.anexo_simples === 'III_ou_V_fator_r'; });
    var folha = {
      salarios_empregados_mensal: mensal(e.sal, 'folha.salarios_empregados_mensal', 'Salários dos empregados', true),
      prolabore_total_mensal: mensal(e.prol, 'folha.prolabore_total_mensal', 'Pró-labore total', true),
      rat_percentual: numero(e.rat, 'folha.rat_percentual', 'RAT ajustado %', true),
      terceiros_percentual: numero(e.terc, 'folha.terceiros_percentual', 'Terceiros %', true),
      folha_historico_12m_fator_r: numero(e.folha12, 'folha.folha_historico_12m_fator_r', 'Folha dos 12 meses anteriores (Fator R)', ativa && usaFatorR)
    };
    var nsoc = numero(e.nsoc, 'socios.quantidade', 'Quantidade de sócios', true);
    if (nsoc !== null && (nsoc < 1 || nsoc !== Math.round(nsoc))) { P('socios.quantidade', 'Quantidade de sócios: número inteiro a partir de 1'); nsoc = null; }
    var socios = {
      quantidade: nsoc,
      distribuicao_mensal_por_socio: mensal(e.dist, 'socios.distribuicao_mensal_por_socio', 'Distribuição de lucros por sócio (use 0 se não há)', true),
      isento_lucros_ate_2025_mensal_por_socio: mensal(e.iso, 'socios.isento_lucros_ate_2025_mensal_por_socio', 'Isento por lucros até 2025', false, 0)
    };

    /* ---------- custos e Lucro Real ---------- */
    var custos = {
      compras_insumos_mensal: mensal(e.compras, 'custos.compras_insumos_mensal', 'Compras de insumos', temReal),
      compras_com_direito_credito_pis_cofins_mensal: mensal(e.comprascred, 'custos.compras_com_direito_credito_pis_cofins_mensal', 'Compras com crédito de PIS/COFINS (decisão do contador)', temReal),
      outras_despesas_operacionais_mensal: mensal(e.desp, 'custos.outras_despesas_operacionais_mensal', 'Outras despesas operacionais', temReal),
      despesas_com_direito_credito_pis_cofins_mensal: mensal(e.despcred, 'custos.despesas_com_direito_credito_pis_cofins_mensal', 'Despesas com crédito de PIS/COFINS (decisão do contador)', temReal)
    };
    var prej = numero(e.prej, 'lucro_real.prejuizo_fiscal_acumulado', 'Prejuízo fiscal acumulado', false);
    var lucroReal = {
      prejuizo_fiscal_acumulado: prej === null ? 0 : prej,
      ajustes_adicoes_exclusoes_mensal: mensal(e.ajustes, 'lucro_real.ajustes_adicoes_exclusoes_mensal', 'Adições e exclusões', false, 0)
    };

    var empresa = {
      identificacao: String(e.apelido || '').trim(),
      situacao: situacao,
      uf: String(e.uf || '').trim().toUpperCase(),
      municipio: String(e.municipio || '').trim(),
      cnae_principal: atividades.length ? atividades[0].cnae : null
    };
    if (e.municipio_ibge) empresa.municipio_ibge = Number(e.municipio_ibge);
    if (!empresa.uf) P('empresa.uf', 'UF: não informada');
    if (!empresa.municipio) P('empresa.municipio', 'Município: não informado (define o ISS)');

    var dados = {
      schema_version: '1.0',
      origem: 'Ficha do cliente compilada sem IA (ficha.js)',
      ano_calendario: ano,
      empresa: empresa,
      regimes_a_comparar: regimes,
      atividades: atividades,
      receitas: { historico_12_meses_anteriores: hist, simulacao_12_meses: sim },
      custos: custos,
      folha: folha,
      socios: socios,
      lucro_real: lucroReal,
      meta: meta
    };
    var obs = String(e.obs || '').trim();
    if (obs) dados.observacoes = obs;
    return { dados: dados, pendencias: pend, avisos: avisos };
  }

  return {
    compilarFicha: compilarFicha, brNum: brNum, lerLista: lerLista, formatarCnae: formatarCnae,
    ANEXOS: ANEXOS, TIPOS_COMERCIO: TIPOS_COMERCIO
  };
});
