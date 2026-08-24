/* =========================================================
   ResíduoSafe — landing de validação
   Sem dependências. Tudo roda após o parse (script defer).
   ========================================================= */
(function () {
  'use strict';

  /* -------------------------------------------------------
     CONFIGURAÇÃO

     LEADS_ENDPOINT: URL do app da web do Google Apps Script
     (ver README.md — "Enviar os leads para uma planilha").
     Enquanto for null, o envio é simulado e o lead fica em
     localStorage para inspeção.

     ENDPOINT_MODE:
       'apps_script' -> envia como text/plain. O navegador trata
                        como requisição simples e não dispara o
                        preflight OPTIONS, que o Apps Script não
                        sabe responder. O conteúdo continua sendo
                        JSON e chega íntegro em e.postData.contents.
       'json'        -> Content-Type: application/json, para uma
                        API própria que trate CORS normalmente.
     ------------------------------------------------------- */
  var CONFIG = {
    LEADS_ENDPOINT: "https://script.google.com/macros/s/AKfycbwhh-DbAIR2jqecV0igK_xWaGKwtFyZ4TAJ5YzrAveus0DpjOs0Y4elxVdg-xvWpLyslw/exec",          // ex.: 'https://script.google.com/macros/s/AKfy.../exec'
    ENDPOINT_MODE: 'apps_script',  // 'apps_script' | 'json'
    SIMULATED_DELAY_MS: 900,       // usado apenas no modo simulado
    STORAGE_KEY: 'residuosafe_leads'
  };

  /* =======================================================
     1. CAMADA DE ANALYTICS
     Eventos conceituais, prontos para GA4 / Meta Pixel / GTM.
     Basta incluir os scripts das plataformas no <head>; esta
     função repassa automaticamente para o que estiver presente.
     ======================================================= */
  var EVENTS = {
    HERO_CTA: 'hero_cta_clicked',
    FORM_STARTED: 'form_started',
    FORM_COMPLETED: 'form_completed',
    PRICING_ANSWERED: 'pricing_question_answered',
    INTEREST_HIGH: 'interest_high',
    CONTROL_ANSWERED: 'current_control_answered'
  };

  // Mapa opcional: evento interno -> evento padrão do Meta Pixel
  var META_MAP = {
    form_completed: 'Lead'
  };

  function track(eventName, params) {
    var payload = params || {};

    // Google Tag Manager / dataLayer
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: eventName }, payload));

    // Google Analytics 4 (gtag.js)
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, payload);
    }

    // Meta Pixel
    if (typeof window.fbq === 'function') {
      if (META_MAP[eventName]) {
        window.fbq('track', META_MAP[eventName], payload);
      } else {
        window.fbq('trackCustom', eventName, payload);
      }
    }

    if (window.RESIDUOSAFE_DEBUG) console.log('[track]', eventName, payload);
  }

  // Exposto para uso externo/depuração
  window.ResiduoSafe = { track: track, events: EVENTS, config: CONFIG };

  /* =======================================================
     2. HEADER + SCROLL SUAVE
     ======================================================= */
  var header = document.getElementById('siteHeader');

  function onScroll() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 40);
    updateMobileCta();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Scroll suave para âncoras internas + tracking de CTA
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;

    var id = link.getAttribute('href');
    if (!id || id === '#') return;

    var target = document.querySelector(id);
    if (!target) return;

    e.preventDefault();

    var origin = link.getAttribute('data-cta');
    if (origin) {
      track(EVENTS.HERO_CTA, { cta_location: origin, destination: id });
    }

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var top = target.getBoundingClientRect().top + window.scrollY - 68;
    window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });

    if (history.replaceState) history.replaceState(null, '', id);
  });

  /* =======================================================
     3. REVEAL NO SCROLL
     ======================================================= */
  var revealables = document.querySelectorAll('.reveal-on-scroll');

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* =======================================================
     4. CTA FIXO NO MOBILE
     Aparece depois do hero; some quando o formulário está à vista.
     ======================================================= */
  var mobileCta = document.getElementById('mobileCta');
  var hero = document.getElementById('hero');
  var validation = document.getElementById('validacao');

  if (mobileCta) {
    mobileCta.hidden = false;
    document.body.classList.add('has-mobile-cta');
  }

  function updateMobileCta() {
    if (!mobileCta || window.innerWidth > 860) return;

    var pastHero = hero ? window.scrollY > hero.offsetHeight * 0.7 : true;
    var formVisible = false;

    if (validation) {
      var r = validation.getBoundingClientRect();
      formVisible = r.top < window.innerHeight * 0.9 && r.bottom > 0;
    }

    var show = pastHero && !formVisible;
    mobileCta.classList.toggle('is-visible', show);
    document.body.classList.toggle('has-mobile-cta', show);
  }
  window.addEventListener('resize', updateMobileCta);

  /* =======================================================
     5. MÁSCARA DE WHATSAPP
     ======================================================= */
  var phone = document.getElementById('whatsapp');

  function maskPhone(value) {
    var d = (value || '').replace(/\D/g, '').slice(0, 11);
    if (d.length === 0) return '';
    if (d.length <= 2) return '(' + d;
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  if (phone) {
    phone.addEventListener('input', function () {
      var atEnd = this.selectionStart === this.value.length;
      this.value = maskPhone(this.value);
      if (atEnd) this.setSelectionRange(this.value.length, this.value.length);
    });
    phone.addEventListener('paste', function () {
      var input = this;
      setTimeout(function () { input.value = maskPhone(input.value); }, 0);
    });
  }

  /* =======================================================
     6. FORMULÁRIO — validação, tracking e envio
     ======================================================= */
  var form = document.getElementById('leadForm');
  if (!form) return;

  var submitBtn = document.getElementById('submitBtn');
  var formError = document.getElementById('formError');
  var formStarted = false;
  var controlAnswered = false;

  var RULES = {
    nome: {
      test: function (v) { return v.trim().length >= 2; },
      message: 'Informe seu nome.'
    },
    email: {
      test: function (v) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()); },
      message: 'Informe um e-mail válido.'
    },
    whatsapp: {
      test: function (v) { return v.replace(/\D/g, '').length >= 10; },
      message: 'Informe um WhatsApp com DDD.'
    },
    segmento: {
      test: function (v) { return v !== ''; },
      message: 'Selecione uma opção.'
    },
    unidades: {
      test: function (v) { return v !== ''; },
      message: 'Selecione quantas unidades você gerencia.'
    },
    controle: {
      test: function (v) { return Array.isArray(v) ? v.length > 0 : v !== ''; },
      message: 'Marque pelo menos uma forma de controle.'
    },
    interesse: {
      test: function (v) { return v !== ''; },
      message: 'Escolha uma das opções acima.'
    }
  };

  function fieldWrapper(name) {
    var el = form.querySelector('[name="' + name + '"]');
    return el ? el.closest('.field') : null;
  }

  function getValue(name) {
    var nodes = form.querySelectorAll('[name="' + name + '"]');
    if (!nodes.length) return '';

    var first = nodes[0];
    if (first.type === 'radio') {
      var checked = form.querySelector('[name="' + name + '"]:checked');
      return checked ? checked.value : '';
    }
    if (first.type === 'checkbox') {
      return Array.prototype.filter.call(nodes, function (n) { return n.checked; })
        .map(function (n) { return n.value; });
    }
    return first.value;
  }

  function showError(name, message) {
    var msgEl = form.querySelector('[data-err-for="' + name + '"]');
    var wrapper = fieldWrapper(name);
    if (msgEl) {
      msgEl.textContent = message;
      msgEl.classList.add('is-visible');
    }
    if (wrapper) wrapper.classList.add('has-error');
  }

  function clearError(name) {
    var msgEl = form.querySelector('[data-err-for="' + name + '"]');
    var wrapper = fieldWrapper(name);
    if (msgEl) msgEl.classList.remove('is-visible');
    if (wrapper) wrapper.classList.remove('has-error');
  }

  function validateField(name) {
    var rule = RULES[name];
    if (!rule) return true;

    var value = getValue(name);
    var ok = rule.test(value);

    if (ok) clearError(name);
    else showError(name, rule.message);

    return ok;
  }

  function validateAll() {
    var firstInvalid = null;
    Object.keys(RULES).forEach(function (name) {
      if (!validateField(name) && !firstInvalid) firstInvalid = name;
    });
    return firstInvalid;
  }

  // form_started — dispara uma única vez na primeira interação real
  form.addEventListener('input', markStarted, true);
  form.addEventListener('change', markStarted, true);

  function markStarted() {
    if (formStarted) return;
    formStarted = true;
    track(EVENTS.FORM_STARTED, { form_id: 'lead_validacao' });
  }

  // Limpa erro assim que o campo é corrigido
  form.addEventListener('input', function (e) {
    var name = e.target.name;
    if (name && RULES[name]) validateField(name);
  });

  form.addEventListener('change', function (e) {
    var name = e.target.name;
    if (name && RULES[name]) validateField(name);

    if (name === 'preco') {
      track(EVENTS.PRICING_ANSWERED, { price_range: e.target.value });
    }
    if (name === 'interesse' && e.target.value === 'Sim, teria bastante interesse') {
      track(EVENTS.INTEREST_HIGH, { interest_level: e.target.value });
    }
    // Uma vez só: a pergunta é multi-seleção e dispararia a cada clique
    if (name === 'controle' && !controlAnswered) {
      controlAnswered = true;
      var controle = getValue('controle');
      track(EVENTS.CONTROL_ANSWERED, {
        controle_atual: controle,
        terceirizado: controle.indexOf('Empresa terceirizada') !== -1
      });
    }
  });

  // Blur nos campos de texto
  ['nome', 'email', 'whatsapp'].forEach(function (name) {
    var el = form.querySelector('[name="' + name + '"]');
    if (el) el.addEventListener('blur', function () { validateField(name); });
  });

  function collectPayload() {
    return {
      nome: getValue('nome').trim(),
      email: getValue('email').trim().toLowerCase(),
      whatsapp: getValue('whatsapp'),
      whatsapp_digits: getValue('whatsapp').replace(/\D/g, ''),
      segmento: getValue('segmento'),
      unidades: getValue('unidades'),
      controle_atual: getValue('controle'),
      dificuldade: getValue('dificuldade').trim(),
      interesse: getValue('interesse'),
      preco: getValue('preco') || null,
      website: getValue('website'), // honeypot — deve chegar vazio

      meta: {
        enviado_em: new Date().toISOString(),
        pagina: location.href,
        referrer: document.referrer || null,
        utm: readUtm(),
        user_agent: navigator.userAgent
      }
    };
  }

  function readUtm() {
    var p = new URLSearchParams(location.search);
    var out = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
      if (p.get(k)) out[k] = p.get(k);
    });
    return out;
  }

  function sendLead(payload) {
    // Modo conectado: POST para o endpoint configurado
    if (CONFIG.LEADS_ENDPOINT) {
      var appsScript = CONFIG.ENDPOINT_MODE === 'apps_script';

      return fetch(CONFIG.LEADS_ENDPOINT, {
        method: 'POST',
        redirect: 'follow', // o Apps Script redireciona para googleusercontent.com
        headers: appsScript
          ? { 'Content-Type': 'text/plain;charset=utf-8' }
          : { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        })
        .then(function (texto) {
          // O Apps Script responde 200 mesmo quando falha ao gravar,
          // então o resultado real vem no corpo: { ok: true | false }
          var resposta;
          try {
            resposta = JSON.parse(texto);
          } catch (err) {
            throw new Error('Resposta inesperada do endpoint de leads.');
          }
          if (resposta && resposta.ok === false) {
            throw new Error(resposta.error || 'A planilha não confirmou a gravação.');
          }
          return resposta;
        });
    }

    // Modo simulado: guarda localmente para inspeção durante a validação
    return new Promise(function (resolve) {
      setTimeout(function () {
        try {
          var saved = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
          saved.push(payload);
          localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(saved));
        } catch (err) { /* modo privado ou storage bloqueado — segue o fluxo */ }
        resolve();
      }, CONFIG.SIMULATED_DELAY_MS);
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formError.hidden = true;

    var firstInvalid = validateAll();
    if (firstInvalid) {
      var el = form.querySelector('[name="' + firstInvalid + '"]');
      var wrapper = fieldWrapper(firstInvalid);
      if (wrapper) {
        var top = wrapper.getBoundingClientRect().top + window.scrollY - 110;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
      if (el && el.focus) el.focus({ preventScroll: true });
      return;
    }

    var payload = collectPayload();
    submitBtn.classList.add('is-loading');
    submitBtn.setAttribute('aria-busy', 'true');
    submitBtn.querySelector('.btn-label').textContent = 'Enviando...';

    sendLead(payload)
      .then(function () {
        track(EVENTS.FORM_COMPLETED, {
          segmento: payload.segmento,
          unidades: payload.unidades,
          controle_atual: payload.controle_atual,
          terceirizado: payload.controle_atual.indexOf('Empresa terceirizada') !== -1,
          interesse: payload.interesse,
          price_range: payload.preco
        });
        openModal();
        form.reset();
        controlAnswered = false;
        form.querySelectorAll('.has-error').forEach(function (n) { n.classList.remove('has-error'); });
        form.querySelectorAll('.err.is-visible').forEach(function (n) { n.classList.remove('is-visible'); });
      })
      .catch(function (err) {
        formError.textContent =
          'Não foi possível enviar agora. Verifique sua conexão e tente novamente em instantes.';
        formError.hidden = false;
        // O visitante vê a mensagem amigável; o motivo real fica no console
        // e no evento — é o que permite diagnosticar a ligação com a planilha.
        console.error('[ResíduoSafe] falha ao enviar o lead:', err);
        track('form_error', { message: String(err && err.message || err) });
      })
      .then(function () {
        submitBtn.classList.remove('is-loading');
        submitBtn.removeAttribute('aria-busy');
        submitBtn.querySelector('.btn-label').textContent = 'Quero participar da validação';
      });
  });

  /* =======================================================
     7. MODAL DE SUCESSO
     ======================================================= */
  var modal = document.getElementById('successModal');
  var lastFocused = null;

  function openModal() {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    var closeBtn = modal.querySelector('button[data-close]');
    if (closeBtn) closeBtn.focus();
    document.addEventListener('keydown', onModalKeydown);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onModalKeydown);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function onModalKeydown(e) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;

    // Foco preso dentro do modal
    var focusables = modal.querySelectorAll('button, [href], input, select, textarea');
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  modal.addEventListener('click', function (e) {
    if (e.target.hasAttribute('data-close')) closeModal();
  });
})();
