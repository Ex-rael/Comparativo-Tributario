/*
 * Motor de cálculo do comparativo tributário (cálculo puro, sem IA).
 * Entradas: aliquotas.json (regras estáveis) e dados-empresa.json (dados da empresa).
 * Funciona no navegador (global CTEngine) e no Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CTEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /*
   * Versão da ferramenta (SemVer), mostrada nas duas páginas. Sobe a cada commit, conforme o CHANGELOG.md:
   * MAJOR muda o resultado para a mesma entrada ou quebra o formato dos JSON; MINOR traz função nova compatível;
   * PATCH corrige erro, texto, layout ou documentação sem mudar resultado.
   */
  var VERSAO = '1.13.1';
  var REGIMES = ['simples', 'presumido', 'real'];
  var NOMES = { simples: 'Simples Nacional', presumido: 'Lucro Presumido', real: 'Lucro Real' };
  var ROTULOS = {
    das: 'DAS (tributos unificados)',
    irpj: 'IRPJ e adicional',
    csll: 'CSLL',
    pis: 'PIS',
    cofins: 'COFINS',
    iss: 'ISS',
    icms: 'ICMS líquido (estimado)',
    cbs: 'CBS (reforma, em definição)',
    ibs: 'IBS (reforma, em definição)',
    cpp: 'CPP e RAT patronais',
    terceiros: 'Contribuições a terceiros',
    retencao_lucros: 'Retenção sobre lucros distribuídos'
  };
  var MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  function num(x, d) {
    var dflt = d === undefined ? 0 : d;
    if (x === null || x === undefined || x === '') return dflt;
    var n = Number(x);
    return isFinite(n) ? n : dflt;
  }
  function mv(x, i) { return Array.isArray(x) ? num(x[i]) : num(x); }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function vigente(ano, mes, v) {
    if (!v) return true;
    return ano > v.ano || (ano === v.ano && mes >= v.mes);
  }

  /* ------------------------------------------------------------------ */
  /* Normalização                                                         */
  /* ------------------------------------------------------------------ */
  function normalizar(dados) {
    var emp = dados.empresa || {};
    var rec = dados.receitas || {};
    var sim = [];
    for (var i = 0; i < 12; i++) sim.push(num((rec.simulacao_12_meses || [])[i]));
    var h = (rec.historico_12_meses_anteriores || []).map(function (v) { return num(v); });
    var hist = h.length >= 12 ? h.slice(h.length - 12) : new Array(12 - h.length).fill(0).concat(h);
    var emAb = emp.situacao === 'em_abertura';
    var primeiro = 0;
    if (emAb) {
      primeiro = sim.findIndex(function (v) { return v > 0; });
      if (primeiro < 0) primeiro = 0;
    }
    var atividades = (dados.atividades || []).map(function (a, k) {
      return {
        id: a.id || ('atividade-' + (k + 1)),
        descricao: a.descricao || '',
        share: num(a.percentual_receita) / 100,
        anexo: a.anexo_simples,
        tipo: a.tipo_presumido,
        iss: num(a.iss_percentual) / 100,
        icms: num(a.icms_liquido_percentual_receita) / 100
      };
    });
    var regimes = (dados.regimes_a_comparar && dados.regimes_a_comparar.length) ? dados.regimes_a_comparar : REGIMES.slice();
    return {
      ano: num(dados.ano_calendario, 2026),
      emAb: emAb,
      primeiro: primeiro,
      sim: sim,
      hist: hist,
      histLen: h.length,
      atividades: atividades,
      custos: dados.custos || {},
      folha: dados.folha || {},
      socios: dados.socios || {},
      lreal: dados.lucro_real || {},
      regimes: regimes
    };
  }

  function encargosMes(aliq, c, i) {
    var E = aliq.encargos_folha || {};
    var sal = mv(c.folha.salarios_empregados_mensal, i);
    var prol = mv(c.folha.prolabore_total_mensal, i);
    var rat = num(c.folha.rat_percentual) / 100;
    var terc = num(c.folha.terceiros_percentual) / 100;
    return {
      sal: sal,
      prol: prol,
      fgts: sal * num(E.fgts),
      cpp: (sal + prol) * num(E.cpp_patronal),
      rat: sal * rat,
      terc: sal * terc
    };
  }

  /* ------------------------------------------------------------------ */
  /* CBS e IBS (opcional, alíquotas em definição)                         */
  /*                                                                      */
  /* Mecânica adotada (hipótese a validar pelo contador; ver calculos.md): */
  /*  - Base de cálculo: receita bruta mensal, sem créditos nem exclusões. */
  /*  - CBS = receita x cbs_aplicar.aliquota; IBS = receita x ibs_aplicar.aliquota. */
  /*  - Alíquotas só vêm do aliquotas.json (reforma_consumo). Se cbs_aplicar */
  /*    ou ibs_aplicar faltarem, usa cbs_teste / ibs_teste e avisa.         */
  /*  - Presumido e Real: CBS e IBS somam à carga. No Real também reduzem   */
  /*    o lucro antes do IR (como PIS, COFINS, ISS e ICMS). No Presumido     */
  /*    não alteram a base de IRPJ e CSLL (receita x presunção).             */
  /*  - Simples: só recebe CBS/IBS se simples_por_fora_do_das.aplicar for    */
  /*    true no JSON; senão o regime fica sem CBS/IBS e o motor avisa.       */
  /*  - Compensação com PIS, COFINS, ICMS e ISS na transição NÃO é modelada: */
  /*    esses tributos seguem calculados integralmente (pode haver dupla     */
  /*    contagem) e o motor avisa.                                           */
  /* ------------------------------------------------------------------ */
  function paramsCbsIbs(aliq) {
    var RC = aliq.reforma_consumo || {};
    var avisos = [], origem = 'cbs_aplicar e ibs_aplicar';
    function le(campo, teste, nome) {
      var o = RC[campo];
      var v = o && typeof o === 'object' ? o.aliquota : undefined;
      if (v === undefined || v === null || v === '') {
        v = RC[teste];
        origem = 'cbs_teste e ibs_teste (campos novos ausentes)';
        avisos.push('Alíquotas: "reforma_consumo.' + campo + '" ausente; usando "' + teste + '" para ' + nome + '.');
      }
      v = Number(v);
      if (!isFinite(v) || v < 0 || v > 1) throw new Error('Alíquota de ' + nome + ' inválida em reforma_consumo (esperado fração entre 0 e 1).');
      return v;
    }
    var cbs = le('cbs_aplicar', 'cbs_teste', 'CBS');
    var ibs = le('ibs_aplicar', 'ibs_teste', 'IBS');
    var sp = RC.simples_por_fora_do_das;
    return { cbs: cbs, ibs: ibs, simples: !!(sp && sp.aplicar === true), origem: origem, avisos: avisos };
  }
  function pctTxt(v) { return (v * 100).toFixed(2).replace('.', ',') + '%'; }

  /* ------------------------------------------------------------------ */
  /* Simples Nacional                                                     */
  /* ------------------------------------------------------------------ */
  function aliqEfetiva(anexo, rbt) {
    var f = anexo.faixas;
    var idx = -1;
    for (var k = 0; k < f.length; k++) { if (rbt <= f[k].ate) { idx = k; break; } }
    if (idx < 0) idx = f.length - 1;
    var x = f[idx];
    var ef = rbt > 0 ? (rbt * x.aliquota - x.deduzir) / rbt : f[0].aliquota;
    return { faixa: idx, nominal: x.aliquota, deduzir: x.deduzir, efetiva: ef };
  }

  function calcSimples(aliq, c) {
    var S = aliq.simples_nacional;
    var avisos = [];
    var motivos = [];
    var i, e;
    var fr = [];
    for (i = 0; i < 12; i++) { e = encargosMes(aliq, c, i); fr.push(e.sal + e.prol + e.fgts); }
    var histFR = num(c.folha.folha_historico_12m_fator_r);
    var temFatorR = c.atividades.some(function (a) { return a.anexo === 'III_ou_V_fator_r'; });
    if (temFatorR && !c.emAb && histFR === 0) {
      avisos.push('Fator R: folha_historico_12m_fator_r não informada. O cálculo parte de folha zero nos 12 meses anteriores, o que tende a enquadrar no Anexo V nos primeiros meses.');
    }
    if (!c.emAb && c.histLen < 12) {
      avisos.push('Histórico de receita com menos de 12 meses: RBT12 subestimado. Se a empresa começou há menos de 12 meses, use situacao "em_abertura".');
    }
    var serie = c.hist.concat(c.sim);
    var meses = [];
    var totalDas = 0, totalCpp = 0;
    var vedado = false, estourou = false, avisouSub = false;
    var rbtMax = 0;

    for (i = 0; i < 12; i++) {
      var rec = c.sim[i];
      var rbt, folha12;
      if (c.emAb) {
        if (i < c.primeiro) {
          meses.push({ mes: i, receita: 0, rbt12: 0, fator_r: 0, das: 0, cpp_fora: 0, atividades: [] });
          continue;
        }
        if (i === c.primeiro) { rbt = rec * 12; folha12 = fr[i] * 12; }
        else {
          var n = i - c.primeiro;
          rbt = sum(c.sim.slice(c.primeiro, i)) / n * 12;
          folha12 = sum(fr.slice(c.primeiro, i)) / n * 12;
        }
      } else {
        rbt = sum(serie.slice(i, i + 12));
        folha12 = histFR * (12 - i) / 12 + sum(fr.slice(0, i));
      }
      if (rbt > rbtMax) rbtMax = rbt;
      var fatorR = rbt > 0 ? folha12 / rbt : 0;
      var das = 0, shareIV = 0, det = [];
      c.atividades.forEach(function (a) {
        var ra = rec * a.share;
        var key = a.anexo;
        if (key === 'vedado') { vedado = true; det.push({ id: a.id, anexo: 'vedado', receita: ra, das: 0 }); return; }
        if (key === 'III_ou_V_fator_r') key = fatorR >= num(S.fator_r_minimo, 0.28) ? 'III' : 'V';
        var anexo = S.anexos[key];
        if (!anexo) throw new Error('Anexo do Simples inválido na atividade "' + a.id + '": ' + a.anexo);
        var ap = aliqEfetiva(anexo, rbt);
        var d = ra * ap.efetiva;
        das += d;
        if (key === 'IV') shareIV += a.share;
        det.push({ id: a.id, anexo: key, faixa: ap.faixa + 1, nominal: ap.nominal, deduzir: ap.deduzir, efetiva: ap.efetiva, receita: ra, das: d });
      });
      e = encargosMes(aliq, c, i);
      var cppFora = shareIV * (e.cpp + e.rat);
      totalDas += das;
      totalCpp += cppFora;
      meses.push({ mes: i, receita: rec, rbt12: rbt, fator_r: fatorR, das: das, cpp_fora: cppFora, atividades: det });
      if (rbt > S.limite_receita_anual) estourou = true;
      if (rbt > S.sublimite_icms_iss && !avisouSub) {
        avisouSub = true;
        avisos.push('RBT12 acima do sublimite de ' + brl(S.sublimite_icms_iss) + ' em ' + MESES[i] + ': ICMS e ISS passam a ser recolhidos fora do DAS. O motor não modela essa partilha, então o DAS pode estar superestimado e ICMS/ISS subestimados.');
      }
    }

    var receitaAnual = sum(c.sim);
    if (estourou) motivos.push('RBT12 acima do limite de ' + brl(S.limite_receita_anual) + ' em algum mês.');
    else if (receitaAnual > S.limite_receita_anual) avisos.push('Receita do ano acima de ' + brl(S.limite_receita_anual) + ': a exclusão do Simples vale a partir de 1º de janeiro do ano seguinte (ou retroativa, se o excesso passar de 20%). Conferir a Resolução CGSN 140/2018.');
    if (vedado) motivos.push('Atividade marcada como vedada ao Simples Nacional.');

    // Lucro distribuível isento (aproximado): presunção do IRPJ menos o DAS.
    var P = aliq.lucro_presumido || { presuncao: {} };
    var baseIsento = 0;
    c.atividades.forEach(function (a) {
      var t = P.presuncao[a.tipo];
      if (t) baseIsento += receitaAnual * a.share * t.irpj;
    });

    var itens = { das: totalDas, cpp: totalCpp };
    var cbsIbsTot = 0;
    if (c.cbsIbs) {
      if (c.cbsIbs.simples) {
        itens.cbs = receitaAnual * c.cbsIbs.cbs;
        itens.ibs = receitaAnual * c.cbsIbs.ibs;
        cbsIbsTot = itens.cbs + itens.ibs;
      } else {
        avisos.push('CBS e IBS NÃO somados ao Simples: o aliquotas.json não traz regra clara para cobrança por fora do DAS (reforma_consumo.simples_por_fora_do_das.aplicar). Valem só para Presumido e Real.');
      }
    }
    return {
      id: 'simples',
      elegivel: motivos.length === 0,
      motivos: motivos,
      avisos: avisos,
      itens: itens,
      detalhe: { meses: meses, rbt12_max: rbtMax },
      lucro_isento_aprox: Math.max(0, baseIsento - totalDas - cbsIbsTot),
      lucro_isento_tipo: 'Presunção do IRPJ menos o DAS total (aproximação conservadora)'
    };
  }

  /* ------------------------------------------------------------------ */
  /* Lucro Presumido                                                      */
  /* ------------------------------------------------------------------ */
  function calcPresumido(aliq, c) {
    var P = aliq.lucro_presumido;
    var ac = P.acrescimo_presuncao || {};
    var avisos = [], motivos = [];
    var pI = 0, pC = 0;
    c.atividades.forEach(function (a) {
      var t = P.presuncao[a.tipo];
      if (!t) throw new Error('tipo_presumido inválido na atividade "' + a.id + '": ' + a.tipo);
      pI += a.share * t.irpj;
      pC += a.share * t.csll;
    });
    var issPct = 0, icmsPct = 0;
    c.atividades.forEach(function (a) { issPct += a.share * a.iss; icmsPct += a.share * a.icms; });

    var meses = [], cumPrev = 0, i;
    var tot = { irpj: 0, csll: 0, pis: 0, cofins: 0, iss: 0, icms: 0, cpp: 0, terceiros: 0 };
    if (c.cbsIbs) { tot.cbs = 0; tot.ibs = 0; }
    for (i = 0; i < 12; i++) {
      var rec = c.sim[i];
      var cumNow = cumPrev + rec;
      var lim = num(ac.limite_receita_anual);
      var exced = ac.ativo === false ? 0 : Math.max(0, cumNow - lim) - Math.max(0, cumPrev - lim);
      var acI = (ac.ativo !== false && vigente(c.ano, i + 1, ac.vigencia_irpj)) ? exced * pI * num(ac.percentual) : 0;
      var acC = (ac.ativo !== false && vigente(c.ano, i + 1, ac.vigencia_csll)) ? exced * pC * num(ac.percentual) : 0;
      var e = encargosMes(aliq, c, i);
      var mp = {
        mes: i, receita: rec, excedente: exced,
        base_irpj: rec * pI + acI, base_csll: rec * pC + acC,
        pis: rec * P.pis_aliquota, cofins: rec * P.cofins_aliquota,
        iss: rec * issPct, icms: rec * icmsPct,
        cpp: e.cpp + e.rat, terceiros: e.terc
      };
      if (c.cbsIbs) { mp.cbs = rec * c.cbsIbs.cbs; mp.ibs = rec * c.cbsIbs.ibs; }
      meses.push(mp);
      cumPrev = cumNow;
    }
    var tri = [];
    for (var q = 0; q < 4; q++) {
      var ms = meses.slice(q * 3, q * 3 + 3);
      var bI = sum(ms.map(function (m) { return m.base_irpj; }));
      var bC = sum(ms.map(function (m) { return m.base_csll; }));
      var ativos = 3;
      if (c.emAb) ativos = ms.filter(function (m, k) { return q * 3 + k >= c.primeiro; }).length;
      var irpjBase = P.irpj_aliquota * bI;
      var adic = P.irpj_adicional_aliquota * Math.max(0, bI - P.irpj_adicional_limite_mensal * ativos);
      var csll = P.csll_aliquota * bC;
      tri.push({
        tri: q + 1, receita: sum(ms.map(function (m) { return m.receita; })),
        base_irpj: bI, irpj: irpjBase, adicional: adic, base_csll: bC, csll: csll
      });
      tot.irpj += irpjBase + adic;
      tot.csll += csll;
    }
    meses.forEach(function (m) {
      tot.pis += m.pis; tot.cofins += m.cofins; tot.iss += m.iss; tot.icms += m.icms;
      tot.cpp += m.cpp; tot.terceiros += m.terceiros;
      if (c.cbsIbs) { tot.cbs += m.cbs; tot.ibs += m.ibs; }
    });

    var receitaAnual = sum(c.sim);
    if (receitaAnual > num(P.limite_opcao_receita_anual, 78000000)) motivos.push('Receita anual acima do limite de ' + brl(P.limite_opcao_receita_anual) + ' para opção pelo Lucro Presumido.');
    if (sum(meses.map(function (m) { return m.excedente; })) > 0) {
      avisos.push('Receita acima de ' + brl(ac.limite_receita_anual) + ' no ano: acréscimo de ' + (num(ac.percentual) * 100) + '% na presunção aplicado ao excedente (LC 224/2025, status a confirmar).');
    }
    var baseAnual = sum(tri.map(function (t) { return t.base_irpj; }));
    var lucroIsento = baseAnual - tot.irpj - tot.csll - tot.pis - tot.cofins;
    var itens = { irpj: tot.irpj, csll: tot.csll, pis: tot.pis, cofins: tot.cofins, iss: tot.iss, icms: tot.icms, cpp: tot.cpp, terceiros: tot.terceiros };
    if (c.cbsIbs) { itens.cbs = tot.cbs; itens.ibs = tot.ibs; lucroIsento = lucroIsento - tot.cbs - tot.ibs; }

    return {
      id: 'presumido',
      elegivel: motivos.length === 0,
      motivos: motivos,
      avisos: avisos,
      itens: itens,
      detalhe: { meses: meses, trimestres: tri, presuncao_irpj_media: pI, presuncao_csll_media: pC },
      lucro_isento_aprox: Math.max(0, lucroIsento),
      lucro_isento_tipo: 'Base presumida do IRPJ menos IRPJ, CSLL, PIS e COFINS'
    };
  }

  /* ------------------------------------------------------------------ */
  /* Lucro Real (apuração trimestral)                                     */
  /* ------------------------------------------------------------------ */
  function calcReal(aliq, c) {
    var R = aliq.lucro_real;
    var avisos = [], motivos = [];
    var issPct = 0, icmsPct = 0;
    c.atividades.forEach(function (a) { issPct += a.share * a.iss; icmsPct += a.share * a.icms; });
    var meses = [], i;
    var credExcedeu = false;
    for (i = 0; i < 12; i++) {
      var rec = c.sim[i];
      var e = encargosMes(aliq, c, i);
      var compras = mv(c.custos.compras_insumos_mensal, i);
      var comprasCred = mv(c.custos.compras_com_direito_credito_pis_cofins_mensal, i);
      var desp = mv(c.custos.outras_despesas_operacionais_mensal, i);
      var despCred = mv(c.custos.despesas_com_direito_credito_pis_cofins_mensal, i);
      var credBase = comprasCred + despCred;
      var pisDeb = rec * R.pis_aliquota, cofDeb = rec * R.cofins_aliquota;
      var pisCred = credBase * R.pis_aliquota, cofCred = credBase * R.cofins_aliquota;
      if (pisCred > pisDeb || cofCred > cofDeb) credExcedeu = true;
      var pis = Math.max(0, pisDeb - pisCred), cof = Math.max(0, cofDeb - cofCred);
      var iss = rec * issPct, icms = rec * icmsPct;
      var folhaCusto = e.sal + e.prol + e.fgts + e.cpp + e.rat + e.terc;
      var ajuste = mv(c.lreal.ajustes_adicoes_exclusoes_mensal, i);
      var lucro = rec - pis - cof - iss - icms - compras - desp - folhaCusto + ajuste;
      var cbsM = c.cbsIbs ? rec * c.cbsIbs.cbs : 0, ibsM = c.cbsIbs ? rec * c.cbsIbs.ibs : 0;
      if (c.cbsIbs) lucro = lucro - cbsM - ibsM; // CBS e IBS são dedutíveis como os demais tributos sobre a receita (hipótese)
      var mr = {
        mes: i, receita: rec, pis: pis, cofins: cof, iss: iss, icms: icms,
        cpp: e.cpp + e.rat, terceiros: e.terc, folha_custo: folhaCusto, lucro_antes_ir: lucro
      };
      if (c.cbsIbs) { mr.cbs = cbsM; mr.ibs = ibsM; }
      meses.push(mr);
    }
    var prej = num(c.lreal.prejuizo_fiscal_acumulado);
    var tri = [];
    var tot = { irpj: 0, csll: 0, pis: 0, cofins: 0, iss: 0, icms: 0, cpp: 0, terceiros: 0 };
    if (c.cbsIbs) { tot.cbs = 0; tot.ibs = 0; }
    var lucroTotal = 0;
    for (var q = 0; q < 4; q++) {
      var ms = meses.slice(q * 3, q * 3 + 3);
      var lq = sum(ms.map(function (m) { return m.lucro_antes_ir; }));
      var ativos = 3;
      if (c.emAb) ativos = ms.filter(function (m, k) { return q * 3 + k >= c.primeiro; }).length;
      var comp = 0, base = 0;
      if (lq <= 0) { prej += -lq; }
      else {
        comp = Math.min(prej, R.limite_compensacao_prejuizo * lq);
        prej -= comp;
        base = lq - comp;
      }
      var irpjBase = R.irpj_aliquota * base;
      var adic = R.irpj_adicional_aliquota * Math.max(0, base - R.irpj_adicional_limite_mensal * ativos);
      var csll = R.csll_aliquota * base;
      tri.push({ tri: q + 1, lucro_antes_ir: lq, compensacao: comp, base: base, irpj: irpjBase, adicional: adic, csll: csll });
      tot.irpj += irpjBase + adic; tot.csll += csll;
      lucroTotal += lq;
    }
    meses.forEach(function (m) {
      tot.pis += m.pis; tot.cofins += m.cofins; tot.iss += m.iss; tot.icms += m.icms;
      tot.cpp += m.cpp; tot.terceiros += m.terceiros;
      if (c.cbsIbs) { tot.cbs += m.cbs; tot.ibs += m.ibs; }
    });
    var custosVazios = ['compras_insumos_mensal', 'outras_despesas_operacionais_mensal'].every(function (k) { return sum(meses.map(function (_, ix) { return mv(c.custos[k], ix); })) === 0; });
    if (custosVazios) avisos.push('Lucro Real sem custos e despesas informados: o lucro tende a ser superestimado e o resultado deste regime não é confiável.');
    if (credExcedeu) avisos.push('Créditos de PIS/COFINS superam os débitos em algum mês. O motor limitou o PIS/COFINS a zero e não acumula o saldo credor.');
    if (lucroTotal < 0) avisos.push('Prejuízo fiscal no ano: o motor não modela outras vedações ou obrigações do Lucro Real.');
    var lucroApos = lucroTotal - tot.irpj - tot.csll;

    var itens = { irpj: tot.irpj, csll: tot.csll, pis: tot.pis, cofins: tot.cofins, iss: tot.iss, icms: tot.icms, cpp: tot.cpp, terceiros: tot.terceiros };
    if (c.cbsIbs) { itens.cbs = tot.cbs; itens.ibs = tot.ibs; }

    return {
      id: 'real',
      elegivel: true,
      motivos: motivos,
      avisos: avisos,
      itens: itens,
      detalhe: { meses: meses, trimestres: tri },
      lucro_isento_aprox: Math.max(0, lucroApos),
      lucro_isento_tipo: 'Lucro antes do IR menos IRPJ e CSLL'
    };
  }

  /* ------------------------------------------------------------------ */
  /* Lucros distribuídos                                                  */
  /* ------------------------------------------------------------------ */
  function calcDividendos(aliq, c, key) {
    var D = aliq.dividendos || {};
    var n = num(c.socios.quantidade);
    var calc = 0, totalDist = 0;
    for (var i = 0; i < 12; i++) {
      var d = mv(c.socios.distribuicao_mensal_por_socio, i);
      var iso = mv(c.socios.isento_lucros_ate_2025_mensal_por_socio, i);
      totalDist += d * n;
      var sujeito = Math.max(0, d - iso);
      if (c.ano >= num(D.vigencia_ano, 2026) && sujeito > num(D.limite_mensal_por_beneficiario)) {
        calc += sujeito * num(D.retencao_aliquota) * n;
      }
    }
    var aplica = key === 'simples' ? D.simples_sujeito_retencao === true : true;
    return { calculada: calc, aplicada: aplica ? calc : 0, aplica: aplica, total_distribuido: totalDist };
  }

  function fechar(aliq, c, r, receitaAnual) {
    var dv = calcDividendos(aliq, c, r.id);
    var totalEmp = 0;
    Object.keys(r.itens).forEach(function (k) { totalEmp += r.itens[k] || 0; });
    r.nome = NOMES[r.id];
    r.dividendos = dv;
    r.total_empresa = totalEmp;
    r.retencao_aplicada = dv.aplicada;
    r.carga_total = totalEmp + dv.aplicada;
    r.pct_receita = receitaAnual > 0 ? r.carga_total / receitaAnual : 0;
    r.pct_empresa = receitaAnual > 0 ? totalEmp / receitaAnual : 0;
    if (dv.total_distribuido > 0 && dv.total_distribuido > r.lucro_isento_aprox) {
      r.avisos.push('Distribuição anual de ' + brl(dv.total_distribuido) + ' acima do lucro isento estimado de ' + brl(r.lucro_isento_aprox) + ' (base da estimativa: ' + r.lucro_isento_tipo + '). O excedente exige escrituração contábil completa que o comprove, ou pode ser tributado.');
    }
    if (r.id === 'simples' && dv.calculada > 0 && !dv.aplica) {
      r.avisos.push('Retenção de ' + brl(dv.calculada) + ' sobre lucros calculada como hipótese e NÃO somada ao total, porque as alíquotas indicam que o Simples não está sujeito (ponto controvertido, a confirmar).');
    }
    return r;
  }

  /* ------------------------------------------------------------------ */
  /* Orquestração                                                         */
  /* ------------------------------------------------------------------ */
  // opcoes.aplicarCbsIbs (padrão false): inclui CBS e IBS na carga. Desligado, o resultado é o de sempre.
  function calcular(aliq, dados, opcoes) {
    var c = normalizar(dados);
    var receitaAnual = sum(c.sim);
    var res = { versao: VERSAO, ano: c.ano, receita_anual: receitaAnual, regimes: {}, avisos: [], ranking: [] };
    var pc = (opcoes && opcoes.aplicarCbsIbs === true) ? paramsCbsIbs(aliq) : null;
    c.cbsIbs = pc;
    if (pc) res.cbs_ibs = { aplicado: true, cbs: pc.cbs, ibs: pc.ibs, simples_incluido: pc.simples, origem: pc.origem };
    var calcs = { simples: calcSimples, presumido: calcPresumido, real: calcReal };
    c.regimes.forEach(function (k) {
      if (calcs[k]) res.regimes[k] = fechar(aliq, c, calcs[k](aliq, c), receitaAnual);
    });
    res.ranking = Object.keys(res.regimes)
      .filter(function (k) { return res.regimes[k].elegivel; })
      .sort(function (a, b) { return res.regimes[a].carga_total - res.regimes[b].carga_total; })
      .map(function (k) { return k; });

    // Avisos gerais
    var RC = aliq.reforma_consumo || {};
    if (pc) {
      pc.avisos.forEach(function (t) { res.avisos.push({ nivel: 'atencao', texto: t }); });
      res.avisos.push({ nivel: 'atencao', texto: 'CBS ' + pctTxt(pc.cbs) + ' e IBS ' + pctTxt(pc.ibs) + ' aplicados sobre a receita bruta, com valores AINDA EM DEFINIÇÃO (hipótese do operador, lidos de reforma_consumo no aliquotas.json). ' + (pc.simples ? 'Também somados ao Simples, conforme o aliquotas.json.' : 'Somados apenas ao Presumido e ao Real; o Simples fica sem CBS/IBS por falta de regra clara no aliquotas.json.') });
      res.avisos.push({ nivel: 'atencao', texto: 'Compensação na transição não modelada: PIS, COFINS, ICMS e ISS continuam calculados integralmente e CBS/IBS entram por cima, sem créditos nem exclusões de base. Pode haver dupla contagem e carga superestimada.' });
      if (c.ano === num(RC.ano_teste, 2026) && RC.gera_carga_adicional_no_ano_teste === false) {
        res.avisos.push({ nivel: 'info', texto: 'Segundo as fontes do aliquotas.json, em ' + c.ano + ' (ano de teste) não há carga adicional de CBS/IBS. Este modo é uma simulação hipotética.' });
      }
    } else if (c.ano === num(RC.ano_teste, 2026)) {
      res.avisos.push({ nivel: 'info', texto: 'Reforma do consumo: em ' + c.ano + ' as notas destacam CBS ' + (num(RC.cbs_teste) * 100).toFixed(1).replace('.', ',') + '% e IBS ' + (num(RC.ibs_teste) * 100).toFixed(1).replace('.', ',') + '% como teste. Segundo as fontes, sem carga adicional no ano. Não modelado.' });
    } else if (c.ano > num(RC.ano_teste, 2026)) {
      res.avisos.push({ nivel: 'atencao', texto: 'Ano-calendário ' + c.ano + ': CBS e IBS (que substituem PIS, COFINS, ICMS e ISS) NÃO estão modelados. Os resultados refletem as regras anteriores à reforma e podem estar defasados.' });
    }
    var D = aliq.dividendos || {};
    var n = Math.max(1, num(c.socios.quantidade, 1));
    var distAnual = 0, prolAnual = 0;
    for (var i = 0; i < 12; i++) { distAnual += mv(c.socios.distribuicao_mensal_por_socio, i); prolAnual += mv(c.folha.prolabore_total_mensal, i) / n; }
    if (distAnual + prolAnual > num(D.irpfm_limite_anual, 600000)) {
      res.avisos.push({ nivel: 'atencao', texto: 'Renda estimada por sócio acima de ' + brl(D.irpfm_limite_anual) + ' no ano (pró-labore + lucros): pode haver tributação mínima de altas rendas (IRPFM), não calculada aqui.' });
    }
    res.avisos.push({ nivel: 'info', texto: 'Fora do escopo do motor: ICMS-ST, produtos monofásicos, exportação, incentivos fiscais, JCP, parcelamentos, retenções na fonte sobre serviços e a tributação do pró-labore (igual nos três regimes).' });
    res.avisos.push({ nivel: 'info', texto: 'FGTS não entra na carga, pois é igual nos três regimes. Ele reduz o lucro apenas no cálculo do Lucro Real.' });
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* Sensibilidade                                                        */
  /* ------------------------------------------------------------------ */
  var CENARIOS_PADRAO = [
    { id: 'base', nome: 'Cenário base', receita: 1, prolabore: 1 },
    { id: 'rec_mais', nome: 'Receita +10%', receita: 1.1, prolabore: 1 },
    { id: 'rec_menos', nome: 'Receita -10%', receita: 0.9, prolabore: 1 },
    { id: 'prol_mais', nome: 'Pró-labore +20%', receita: 1, prolabore: 1.2 },
    { id: 'prol_menos', nome: 'Pró-labore -20%', receita: 1, prolabore: 0.8 }
  ];

  function escalar(x, f) { return Array.isArray(x) ? x.map(function (v) { return num(v) * f; }) : num(x) * f; }

  function sensibilidade(aliq, dados, cenarios, opcoes) {
    var lista = cenarios || CENARIOS_PADRAO;
    return lista.map(function (cn) {
      var d = JSON.parse(JSON.stringify(dados));
      d.receitas = d.receitas || {};
      d.receitas.simulacao_12_meses = escalar(d.receitas.simulacao_12_meses || [], cn.receita);
      d.receitas.historico_12_meses_anteriores = escalar(d.receitas.historico_12_meses_anteriores || [], cn.receita);
      if (d.folha) d.folha.prolabore_total_mensal = escalar(d.folha.prolabore_total_mensal, cn.prolabore);
      var r = calcular(aliq, d, opcoes);
      var out = { id: cn.id, nome: cn.nome, totais: {}, melhor: r.ranking[0] || null };
      Object.keys(r.regimes).forEach(function (k) { out.totais[k] = { carga_total: r.regimes[k].carga_total, elegivel: r.regimes[k].elegivel }; });
      return out;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Validação e listas de revisão                                        */
  /* ------------------------------------------------------------------ */
  function validar(aliq, dados) {
    var erros = [], avisos = [];
    if (!aliq || typeof aliq !== 'object') { erros.push('Alíquotas: JSON inválido.'); return { erros: erros, avisos: avisos }; }
    if (!dados || typeof dados !== 'object') { erros.push('Dados da empresa: JSON inválido.'); return { erros: erros, avisos: avisos }; }
    ['simples_nacional', 'lucro_presumido', 'lucro_real', 'encargos_folha', 'dividendos'].forEach(function (k) {
      if (!aliq[k]) erros.push('Alíquotas: bloco "' + k + '" ausente.');
    });
    var S = aliq.simples_nacional;
    if (S && (!S.anexos || ['I', 'II', 'III', 'IV', 'V'].some(function (k) { return !S.anexos[k] || !S.anexos[k].faixas || S.anexos[k].faixas.length === 0; }))) {
      erros.push('Alíquotas: Simples Nacional precisa dos anexos I a V com faixas.');
    }
    var ano = dados.ano_calendario;
    if (!(Number(ano) >= 2000)) erros.push('Dados: "ano_calendario" ausente ou inválido.');
    var sim = (dados.receitas || {}).simulacao_12_meses;
    if (!Array.isArray(sim) || sim.length !== 12) erros.push('Dados: "receitas.simulacao_12_meses" deve ter exatamente 12 valores (janeiro a dezembro).');
    else {
      if (sim.some(function (v) { return v === null || v === '' || !isFinite(Number(v)) || Number(v) < 0; })) erros.push('Dados: "receitas.simulacao_12_meses" tem valor vazio, não numérico ou negativo.');
      else if (sum(sim.map(Number)) === 0) erros.push('Dados: receita simulada total é zero.');
    }
    var emAb = (dados.empresa || {}).situacao === 'em_abertura';
    var hist = (dados.receitas || {}).historico_12_meses_anteriores;
    if (!emAb && !Array.isArray(hist)) avisos.push('Dados: sem "historico_12_meses_anteriores". Para empresa ativa o RBT12 do Simples fica incompleto.');
    var ats = dados.atividades;
    if (!Array.isArray(ats) || ats.length === 0) erros.push('Dados: informe ao menos uma atividade em "atividades".');
    else {
      var soma = ats.reduce(function (s, a) { return s + num(a.percentual_receita); }, 0);
      if (Math.abs(soma - 100) > 0.01) erros.push('Dados: "percentual_receita" das atividades soma ' + soma.toFixed(2) + ', deve somar 100.');
      ats.forEach(function (a, k) {
        var nome = a.id || ('atividade ' + (k + 1));
        var anexos = S && S.anexos ? Object.keys(S.anexos).concat(['III_ou_V_fator_r', 'vedado']) : [];
        if (anexos.indexOf(a.anexo_simples) < 0) erros.push('Dados: atividade "' + nome + '" com "anexo_simples" inválido (use I, II, III, IV, V, III_ou_V_fator_r ou vedado).');
        var P = aliq.lucro_presumido;
        if (P && P.presuncao && !P.presuncao[a.tipo_presumido]) erros.push('Dados: atividade "' + nome + '" com "tipo_presumido" inválido (' + Object.keys(P.presuncao).join(', ') + ').');
        ['iss_percentual', 'icms_liquido_percentual_receita'].forEach(function (f) {
          if (a[f] === null || a[f] === undefined) erros.push('Dados: atividade "' + nome + '" sem "' + f + '" (use 0 se não se aplica).');
        });
      });
    }
    var regs = dados.regimes_a_comparar;
    if (regs && regs.some(function (r) { return REGIMES.indexOf(r) < 0; })) erros.push('Dados: "regimes_a_comparar" aceita simples, presumido e real.');
    var f = dados.folha;
    if (!f) erros.push('Dados: bloco "folha" ausente.');
    else ['salarios_empregados_mensal', 'prolabore_total_mensal', 'rat_percentual', 'terceiros_percentual'].forEach(function (k) {
      if (f[k] === null || f[k] === undefined) erros.push('Dados: "folha.' + k + '" vazio (use 0 se não se aplica).');
    });
    var regsAtivos = regs && regs.length ? regs : REGIMES;
    if (regsAtivos.indexOf('real') >= 0) {
      var cu = dados.custos;
      if (!cu) erros.push('Dados: bloco "custos" ausente (necessário para o Lucro Real).');
      else ['compras_insumos_mensal', 'compras_com_direito_credito_pis_cofins_mensal', 'outras_despesas_operacionais_mensal', 'despesas_com_direito_credito_pis_cofins_mensal'].forEach(function (k) {
        if (cu[k] === null || cu[k] === undefined) erros.push('Dados: "custos.' + k + '" vazio (use 0 se não se aplica).');
      });
    }
    var so = dados.socios;
    if (!so || !(Number(so.quantidade) >= 1)) avisos.push('Dados: "socios.quantidade" ausente. A retenção sobre lucros distribuídos ficará zerada.');
    else if (so.distribuicao_mensal_por_socio === null || so.distribuicao_mensal_por_socio === undefined) erros.push('Dados: "socios.distribuicao_mensal_por_socio" vazio (use 0 se não há distribuição).');
    var pend = listarPendencias(aliq).length;
    if (pend > 0) avisos.push('Alíquotas: ' + pend + ' bloco(s) com status a confirmar. Ver lista de pendências.');
    return { erros: erros, avisos: avisos };
  }

  function listarPendencias(aliq) {
    var out = [];
    (function walk(o, path) {
      if (o && typeof o === 'object') {
        if (!Array.isArray(o) && typeof o.status === 'string' && o.status.indexOf('conferido') !== 0) {
          out.push({ caminho: path.join('.'), status: o.status, nota: o.nota || o.simples_nota || '' });
        }
        Object.keys(o).forEach(function (k) { walk(o[k], path.concat(k)); });
      }
    })(aliq, []);
    return out;
  }

  function listarRevisoes(dados) {
    var meta = (dados && dados.meta) || {};
    return Object.keys(meta).filter(function (k) { return meta[k] && meta[k].origem && meta[k].origem !== 'informado'; })
      .map(function (k) { return Object.assign({ campo: k }, meta[k]); });
  }

  function brl(v) {
    return 'R$ ' + num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return {
    versao: VERSAO, calcular: calcular, validar: validar, sensibilidade: sensibilidade,
    listarPendencias: listarPendencias, listarRevisoes: listarRevisoes,
    NOMES: NOMES, ROTULOS: ROTULOS, MESES: MESES, CENARIOS_PADRAO: CENARIOS_PADRAO
  };
});
