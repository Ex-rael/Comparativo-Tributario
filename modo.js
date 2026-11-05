/*
 * Modo de uso, para não misturar duas operações de ritmos diferentes:
 *   comparativo: dia a dia, um cliente por vez (ficha -> resultado), com as alíquotas já aprovadas;
 *   aliquotas:   raro, na virada do ano ou quando uma norma muda (prompt 1 -> revisão -> aprovação).
 * Cada página marca com data-modo-so="comparativo|aliquotas|nenhum" o que só vale num modo.
 * A escolha fica neste navegador (localStorage). Sem escolha, a página com data-exigir leva a inicio.html.
 * ?modo=comparativo|aliquotas na URL também escolhe, e é repassado nos links quando o navegador não guarda dados.
 */
(function () {
  'use strict';
  var CHAVE = 'ct:modo';
  var NOMES = { comparativo: 'Comparar regimes', aliquotas: 'Atualizar alíquotas' };
  var eu = document.currentScript;
  var guarda = true, modo = null;
  try { modo = localStorage.getItem(CHAVE); } catch (e) { guarda = false; }
  var daUrl = new URLSearchParams(location.search).get('modo');
  if (NOMES[daUrl]) {
    modo = daUrl;
    try { localStorage.setItem(CHAVE, modo); } catch (e) { guarda = false; }
  }
  if (!NOMES[modo]) modo = null;
  if (modo) document.documentElement.setAttribute('data-modo', modo);

  /* Primeiro acesso: a página de decisão vem antes de qualquer outra. Sem armazenamento, mostra tudo. */
  if (!modo && guarda && eu && eu.hasAttribute('data-exigir')) {
    location.replace('inicio.html');
    return;
  }

  function escolher(m) {
    if (!NOMES[m]) return false;
    try { localStorage.setItem(CHAVE, m); return true; } catch (e) { return false; }
  }

  document.addEventListener('DOMContentLoaded', function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-modo-barra]'), function (el) {
      el.innerHTML = modo
        ? 'Modo: <b>' + NOMES[modo] + '</b> · <a href="inicio.html">Trocar</a>'
        : '<a href="inicio.html">Escolher o modo</a>';
    });
    /* Sem localStorage, o modo só sobrevive na URL: repassa nos links internos. */
    if (modo && !guarda) {
      Array.prototype.forEach.call(document.querySelectorAll('a[href$=".html"], a[href*=".html#"]'), function (a) {
        var h = a.getAttribute('href');
        if (/^[a-z]+:/i.test(h) || /inicio\.html/.test(h)) return;
        var i = h.indexOf('#');
        a.setAttribute('href', (i < 0 ? h : h.slice(0, i)) + '?modo=' + modo + (i < 0 ? '' : h.slice(i)));
      });
    }
  });

  window.CTModo = { atual: modo, nomes: NOMES, escolher: escolher, guarda: guarda };
})();
