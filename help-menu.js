/**
 * help-menu.js â€” Sidebar Help popover + modals for myLineage.
 * The button #sidebarHelpBtn must exist in the sidebar-footer.
 */
(function () {
  'use strict';

  /* â”€â”€ Injected styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var css = [
    '.sidebar-help-btn{display:flex;align-items:center;gap:12px;padding:9px 8px;border-radius:var(--radius-sm);color:var(--text-secondary);font-weight:500;font-size:0.875rem;background:none;border:none;cursor:pointer;width:100%;text-align:left;overflow:hidden;flex-shrink:0;transition:background var(--transition),color var(--transition);}',
    '.sidebar-help-btn .mdi{font-size:1.15rem;flex-shrink:0;min-width:calc(var(--rail-w) - 20px - 16px + 12px);text-align:center;transition:color var(--transition);}',
    '.sidebar-help-btn:hover{background:var(--accent-hover);color:var(--text-main);}',
    '.sidebar-help-btn:hover .mdi{color:var(--accent);}',
    '.help-popover{position:fixed;z-index:600;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow-lg);min-width:220px;display:none;flex-direction:column;overflow:hidden;}',
    '.help-popover.open{display:flex;}',
    '.help-popover-header{padding:7px 14px;font-size:0.7rem;font-weight:700;color:var(--text-disabled);text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid var(--border-subtle);pointer-events:none;}',
    '.help-popover-item{display:flex;align-items:center;gap:10px;padding:9px 14px;font-size:0.875rem;color:var(--text-secondary);cursor:pointer;background:none;border:none;width:100%;text-align:left;transition:background .15s,color .15s;}',
    '.help-popover-item:hover{background:var(--accent-hover);color:var(--text-main);}',
    '.help-popover-item .mdi{font-size:1.05rem;min-width:20px;text-align:center;}',
    '.help-modal-overlay{display:none;position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.6);align-items:center;justify-content:center;}',
    '.help-modal-overlay.open{display:flex;}',
    '.help-modal{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:28px 32px 32px;width:100%;max-width:760px;box-shadow:var(--shadow-lg);position:relative;max-height:90vh;overflow-y:auto;}',
    '.help-modal.help-modal-sm{max-width:520px;}',
    '.help-modal h2{margin:0 0 6px;font-size:1.1rem;display:flex;align-items:center;gap:8px;}',
    '.help-modal-subtitle{font-size:0.8rem;color:var(--text-disabled);margin:0 0 20px;}',
    '.help-modal-close{position:absolute;top:14px;right:14px;background:none;border:none;cursor:pointer;font-size:1.2rem;color:var(--text-secondary);padding:4px;border-radius:var(--radius-sm);line-height:1;transition:color .15s;}',
    '.help-modal-close:hover{color:var(--text-main);}',
    '.help-modal-body{font-size:0.875rem;color:var(--text-secondary);line-height:1.65;}',
    '.qs-steps{display:flex;flex-direction:column;gap:0;}',
    '.qs-step{display:flex;gap:0;position:relative;}',
    '.qs-step:not(:last-child) .qs-line{position:absolute;left:19px;top:40px;bottom:0;width:2px;background:var(--border);}',
    '.qs-num{flex-shrink:0;width:38px;height:38px;border-radius:50%;background:var(--accent-soft);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:700;color:var(--accent);margin-top:2px;position:relative;z-index:1;}',
    '.qs-body{flex:1;padding:0 0 28px 16px;}',
    '.qs-title{font-size:0.95rem;font-weight:700;color:var(--text-main);margin:4px 0 4px;}',
    '.qs-why{font-size:0.78rem;color:var(--accent);font-weight:600;margin-bottom:2px;}',
    '.qs-text{font-size:0.84rem;color:var(--text-secondary);margin:0 0 10px;line-height:1.6;}',
    '.qs-where{display:inline-flex;align-items:center;gap:5px;font-size:0.75rem;color:var(--text-disabled);background:rgba(255,255,255,.04);border:1px solid var(--border-subtle);border-radius:4px;padding:3px 8px;margin-bottom:10px;}',
    '.qs-where .mdi{font-size:0.95rem;}',
    '.qs-diagram{background:rgba(255,255,255,.03);border:1px solid var(--border-subtle);border-radius:8px;padding:14px 16px;margin-bottom:4px;font-family:monospace;font-size:0.78rem;color:var(--text-secondary);line-height:1.8;overflow-x:auto;white-space:pre;}',
    '.qs-tip{display:flex;align-items:flex-start;gap:7px;background:rgba(68,147,248,.07);border:1px solid rgba(68,147,248,.18);border-radius:6px;padding:8px 10px;font-size:0.79rem;color:var(--text-secondary);margin-top:6px;}',
    '.qs-tip .mdi{color:var(--accent);flex-shrink:0;margin-top:1px;}',
    '.qs-pdf-bar{display:flex;justify-content:flex-end;margin-top:8px;padding-top:16px;border-top:1px solid var(--border-subtle);}',
    '.qs-pdf-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border-radius:var(--radius-sm);background:var(--accent-soft);color:var(--accent);border:1px solid rgba(68,147,248,.3);font-size:0.82rem;font-weight:600;cursor:pointer;transition:background .15s;}',
    '.qs-pdf-btn:hover{background:rgba(68,147,248,.18);}',
    '@media print{body > *:not(.help-modal-overlay){display:none !important;} .help-modal-overlay{display:flex !important;position:static !important;background:none !important;} .help-modal{max-height:none !important;box-shadow:none !important;border:none !important;max-width:100% !important;padding:16px !important;} .help-modal-close,.qs-pdf-bar,.help-modal-subtitle{display:none !important;} .qs-diagram{white-space:pre;font-size:0.72rem;} .qs-step{break-inside:avoid;}}',
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* â”€â”€ Popover â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var ITEMS = [
    { id: 'helpModal-quickstart', label: 'In\u00EDcio R\u00E1pido',  icon: 'mdi-lightning-bolt-outline' },
    { id: 'helpModal-manual',     label: 'Manual',                    icon: 'mdi-book-open-page-variant-outline' },
    { id: 'helpModal-bug',        label: 'Reportar um bug',           icon: 'mdi-bug-outline' },
    { id: 'helpModal-about',      label: 'Sobre o myLineage',         icon: 'mdi-information-outline' },
  ];

  var popoverEl = document.createElement('div');
  popoverEl.className = 'help-popover';
  popoverEl.id = 'helpPopover';
  var popHtml = '<div class="help-popover-header">Ajuda</div>';
  ITEMS.forEach(function (item) {
    popHtml += '<button class="help-popover-item" data-modal="' + item.id + '">'
      + '<i class="mdi ' + item.icon + '" aria-hidden="true"></i>' + item.label + '</button>';
  });
  popoverEl.innerHTML = popHtml;
  document.body.appendChild(popoverEl);

  /* â”€â”€ Modals (empty shells) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  ITEMS.forEach(function (m) {
    var overlay = document.createElement('div');
    overlay.className = 'help-modal-overlay';
    overlay.id = m.id;
    var sm = (m.id !== 'helpModal-quickstart') ? ' help-modal-sm' : '';
    overlay.innerHTML = '<div class="help-modal' + sm + '">'
      + '<button class="help-modal-close" data-close="' + m.id + '">'
      + '<i class="mdi mdi-close" aria-hidden="true"></i></button>'
      + '<h2><i class="mdi ' + m.icon + '" style="color:var(--accent);" aria-hidden="true"></i>'
      + m.label + '</h2>'
      + '<p class="help-modal-subtitle" id="' + m.id + '-subtitle"></p>'
      + '<div class="help-modal-body" id="' + m.id + '-body"></div>'
      + '</div>';
    document.body.appendChild(overlay);
  });

  /* â”€â”€ Core interaction (set up BEFORE content injection) â”€â”€â”€â”€â”€â”€â”€â”€ */
  var btn = document.getElementById('sidebarHelpBtn');

  function openModal(id) {
    closePopover();
    var el = document.getElementById(id);
    if (el) el.classList.add('open');
  }
  function closePopover() { popoverEl.classList.remove('open'); }

  if (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var rect = btn.getBoundingClientRect();
      popoverEl.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
      popoverEl.style.left   = rect.left + 'px';
      popoverEl.classList.toggle('open');
    });
  }

  popoverEl.addEventListener('click', function (e) {
    var item = e.target.closest('.help-popover-item');
    if (item) openModal(item.getAttribute('data-modal'));
  });

  document.addEventListener('click', function (e) {
    var closeBtn = e.target.closest('.help-modal-close');
    if (closeBtn) {
      var el = document.getElementById(closeBtn.getAttribute('data-close'));
      if (el) el.classList.remove('open');
      return;
    }
    if (e.target.classList.contains('help-modal-overlay')) {
      e.target.classList.remove('open');
      return;
    }
    if (popoverEl.classList.contains('open') &&
        !popoverEl.contains(e.target) &&
        e.target !== btn && !(btn && btn.contains(e.target))) {
      closePopover();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closePopover();
    document.querySelectorAll('.help-modal-overlay.open').forEach(function (el) {
      el.classList.remove('open');
    });
  });

  /* â”€â”€ Quickstart content (in try/catch so errors never break the button) â”€â”€ */
  try {
    function esc(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    var STEPS = [
      {
        num: 1,
        title: 'Criar uma conta e iniciar sess\u00e3o',
        why: 'Porque precisa de uma conta?',
        whyText: 'A sua \u00e1rvore geneal\u00f3gica fica guardada em seguran\u00e7a na nuvem. Uma conta garante que s\u00f3 voc\u00ea (e quem convidar) tem acesso aos seus dados.',
        how: 'Aceda \u00e0 p\u00e1gina inicial e clique em <strong>Registar</strong>. Preencha o seu nome, email e uma palavra-passe. Depois confirme o email recebido e fa\u00e7a <strong>Iniciar sess\u00e3o</strong>.',
        where: { icon: 'mdi-login', label: 'P\u00e1gina inicial \u2192 Registar / Iniciar sess\u00e3o' },
        diagram: '  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n  \u2502         \ud83c\udf10  myLineage                \u2502\n  \u2502                                     \u2502\n  \u2502   Email   [ you@example.com       ] \u2502\n  \u2502   Pass    [ \u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022      ] \u2502\n  \u2502                                     \u2502\n  \u2502    [ Registar ]   [ Iniciar sess\u00e3o ]\u2502\n  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518',
        tip: 'Use um email que consulta regularmente \u2014 ser\u00e1 usado para convites e recupera\u00e7\u00e3o de conta.',
      },
      {
        num: 2,
        title: 'Criar a sua primeira \u00e1rvore',
        why: 'O que \u00e9 uma \u00e1rvore?',
        whyText: 'Uma \u00e1rvore \u00e9 um espa\u00e7o independente para uma fam\u00edlia. Pode ter v\u00e1rias \u00e1rvores \u2014 por exemplo, uma para o lado materno e outra para o paterno.',
        how: 'Ap\u00f3s o login, clique em <strong>Nova \u00e1rvore</strong>, d\u00ea-lhe um nome (ex.: "Fam\u00edlia Silva") e uma breve descri\u00e7\u00e3o opcional. Clique em <strong>Criar</strong>.',
        where: { icon: 'mdi-tree', label: 'Painel inicial \u2192 Nova \u00e1rvore' },
        diagram: '  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n  \u2502  As minhas \u00e1rvores                   \u2502\n  \u2502  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510 \u2502\n  \u2502  \u2502 \ud83c\udf33 Fam\u00edlia Silva\u2502  \u2502 \u2795 Nova     \u2502 \u2502\n  \u2502  \u2502  (0 pessoas)   \u2502  \u2502  \u00e1rvore    \u2502 \u2502\n  \u2502  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518 \u2502\n  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518',
        tip: 'Pode criar tantas \u00e1rvores quantas quiser. Cada \u00e1rvore tem os seus pr\u00f3prios dados e membros.',
      },
      {
        num: 3,
        title: 'Adicionar a primeira pessoa',
        why: 'Por onde come\u00e7ar?',
        whyText: 'Comece por si pr\u00f3prio. A partir de si, vai ligar pais, av\u00f3s, filhos \u2014 construindo a \u00e1rvore em ambas as dire\u00e7\u00f5es.',
        how: 'No menu lateral clique em <strong>Cadastro</strong>. Depois clique em <strong>+ Adicionar pessoa</strong>. Preencha o nome, datas de nascimento/\u00f3bito e outros dados que conhecer. Clique em <strong>Guardar</strong>.',
        where: { icon: 'mdi-account-multiple', label: 'Menu lateral \u2192 Cadastro \u2192 + Adicionar pessoa' },
        diagram: '  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510     \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n  \u2502 \u2630  Menu     \u2502     \u2502  Nova Pessoa         \u2502\n  \u2502\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2502     \u2502\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2502\n  \u2502 \ud83d\udc65 Cadastro \u2502\u2500\u2500\u2500\u25b6\u2502  Nome: Jo\u00e3o Silva    \u2502\n  \u2502 \ud83d\udcca Indicad. \u2502     \u2502  Nasc.: 15/03/1985   \u2502\n  \u2502 \ud83c\udf33 \u00c1rvore   \u2502     \u2502  Pa\u00eds:  Portugal     \u2502\n  \u2502  \u2026          \u2502     \u2502  [ Guardar ]         \u2502\n  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518     \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518',
        tip: 'N\u00e3o precisa de saber tudo de imediato. Preencha o que souber \u2014 pode sempre editar depois.',
      },
      {
        num: 4,
        title: 'Ligar familiares (criar rela\u00e7\u00f5es)',
        why: 'Porque ligar pessoas?',
        whyText: 'Uma lista de nomes n\u00e3o \u00e9 uma \u00e1rvore. As liga\u00e7\u00f5es entre pessoas (pai, m\u00e3e, filho, c\u00f4njuge) s\u00e3o o que d\u00e1 significado \u00e0 genealogia.',
        how: 'Abra a ficha de uma pessoa (clique no seu nome no Cadastro). No painel lateral encontrar\u00e1 as sec\u00e7\u00f5es <strong>Pais</strong>, <strong>C\u00f4njuges</strong> e <strong>Filhos</strong>. Clique em <strong>+ Adicionar</strong> em cada sec\u00e7\u00e3o para criar as liga\u00e7\u00f5es.',
        where: { icon: 'mdi-account-details', label: 'Cadastro \u2192 clique numa pessoa \u2192 painel de rela\u00e7\u00f5es' },
        diagram: '        [Av\u00f4 Paterno] \u2500\u2500 [Av\u00f3 Paterna]\n               \u2502\n           [Pai] \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 [M\u00e3e]\n               \u2502\n    [Irm\u00e3o] \u2500\u2500 [Voc\u00ea] \u2500\u2500 [C\u00f4njuge]\n                   \u2502\n               [Filho/a]',
        tip: 'Comece sempre pela liga\u00e7\u00e3o pai/m\u00e3e. Os av\u00f3s e outros parentes v\u00e3o sendo adicionados \u00e0 medida que expande a \u00e1rvore.',
      },
      {
        num: 5,
        title: 'Visualizar a \u00e1rvore',
        why: 'Para que serve a visualiza\u00e7\u00e3o?',
        whyText: 'O diagrama da \u00e1rvore mostra graficamente como todas as pessoas est\u00e3o ligadas, facilitando a identifica\u00e7\u00e3o de rela\u00e7\u00f5es e lacunas de informa\u00e7\u00e3o.',
        how: 'Clique em <strong>\u00c1rvore</strong> no menu lateral. A \u00e1rvore aparece centrada na <em>Pessoa em Foco</em>. Pode navegar clicando em qualquer pessoa ou usando o rato para arrastar o diagrama.',
        where: { icon: 'mdi-sitemap', label: 'Menu lateral \u2192 \u00c1rvore' },
        diagram: '  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n  \u2502  \ud83c\udf33  Vista da \u00c1rvore                   \u2502\n  \u2502                                        \u2502\n  \u2502     [Av\u00f4]\u2500\u2500[Av\u00f3]   [Av\u00f4]\u2500\u2500[Av\u00f3]       \u2502\n  \u2502        \u2502               \u2502               \u2502\n  \u2502      [Pai] \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500[M\u00e3e]               \u2502\n  \u2502             \u2502                          \u2502\n  \u2502           [Voc\u00ea] \u25c0\u2500\u2500 foco atual        \u2502\n  \u2502                                        \u2502\n  \u2502  \ud83d\udd0d zoom    \u270b arrastar    \ud83d\uddb1 clicar    \u2502\n  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518',
        tip: 'Nas <strong>Defini\u00e7\u00f5es da \u00c1rvore</strong> pode definir quem \u00e9 a "Pessoa em Foco" \u2014 a pessoa central do diagrama.',
      },
      {
        num: 6,
        title: 'Adicionar fotos e documentos',
        why: 'Porqu\u00ea adicionar multim\u00e9dia?',
        whyText: 'Fotografias e documentos (certid\u00f5es, registos, etc.) enriquecem a \u00e1rvore e tornam-na um verdadeiro arquivo familiar.',
        how: 'Para fotos, aceda ao <strong>\u00c1lbum</strong> no menu lateral e clique em <strong>Adicionar foto</strong>. Para documentos, aceda a <strong>Documentos</strong>. Cada ficheiro pode ser associado a uma ou mais pessoas.',
        where: { icon: 'mdi-image-multiple', label: 'Menu lateral \u2192 \u00c1lbum  /  Documentos' },
        diagram: '  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510   \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510   \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n  \u2502 \ud83d\uddbc foto1 \u2502   \u2502 \ud83d\uddbc foto2 \u2502   \u2502 \u2795 Nova   \u2502\n  \u2502 Jo\u00e3o c.85 \u2502   \u2502 Ana c.88  \u2502   \u2502   foto   \u2502\n  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518   \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518   \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n       \u2195 associada a pessoas da \u00e1rvore',
        tip: 'Formatos aceites: JPG, PNG, WEBP para fotos; PDF, DOC para documentos.',
      },
      {
        num: 7,
        title: 'Convidar familiares para colaborar',
        why: 'Porqu\u00ea partilhar?',
        whyText: 'A genealogia \u00e9 uma tarefa de fam\u00edlia. Convidar parentes permite que todos contribuam com informa\u00e7\u00f5es e fotografias que s\u00f3 eles t\u00eam.',
        how: 'Aceda a <strong>Defini\u00e7\u00f5es da \u00c1rvore</strong> (bot\u00e3o \u00c1rvore no rodap\u00e9 do menu). Na sec\u00e7\u00e3o <strong>Convidar por email</strong>, escreva o email do familiar, escolha a permiss\u00e3o e clique <strong>Enviar</strong>.',
        where: { icon: 'mdi-email-plus-outline', label: 'Menu lateral (rodap\u00e9) \u2192 \u00c1rvore \u2192 Convidar por email' },
        diagram: '  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n  \u2502  Convidar para a \u00e1rvore                  \u2502\n  \u2502                                          \u2502\n  \u2502  Email  [ maria@example.com           ]  \u2502\n  \u2502  Papel  [ Editor \u25bc ]  [ Enviar ]         \u2502\n  \u2502                                          \u2502\n  \u2502  \ud83d\udce7 Email enviado \u2192 familiar aceita \u2192    \u2502\n  \u2502     aparece nos Membros da \u00e1rvore         \u2502\n  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518',
        tip: '<strong>Editor</strong> pode adicionar e editar dados. <strong>Leitor</strong> s\u00f3 pode consultar.',
      },
      {
        num: 8,
        title: 'Exportar a sua \u00e1rvore (GEDCOM)',
        why: 'Para que serve exportar?',
        whyText: 'O formato GEDCOM \u00e9 o padr\u00e3o universal de genealogia. Exportar permite guardar uma c\u00f3pia de seguran\u00e7a ou abrir a sua \u00e1rvore noutras aplica\u00e7\u00f5es (Ancestry, FamilySearch, etc.).',
        how: 'V\u00e1 a <strong>Defini\u00e7\u00f5es da \u00c1rvore</strong> \u2192 sec\u00e7\u00e3o <strong>GEDCOM</strong> \u2192 separador <strong>Exportar</strong> \u2192 clique em <strong>Exportar GEDCOM</strong>.',
        where: { icon: 'mdi-dna', label: '\u00c1rvore (rodap\u00e9) \u2192 GEDCOM \u2192 Exportar' },
        diagram: '  myLineage  \u2500\u2500export\u2500\u2500\u25b6  ficheiro .ged\n                              \u2502\n              \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n              \u25bc               \u25bc              \u25bc\n          Ancestry       FamilySearch    MacFamilyTree\n          (c\u00f3pia de seguran\u00e7a na nuvem)',
        tip: 'Fa\u00e7a uma exporta\u00e7\u00e3o sempre que fizer altera\u00e7\u00f5es importantes. \u00c9 a melhor forma de ter um backup.',
      },
    ];

    var sub = document.getElementById('helpModal-quickstart-subtitle');
    if (sub) sub.textContent = 'Guia passo a passo para criar a sua primeira \u00e1rvore geneal\u00f3gica';

    var body = document.getElementById('helpModal-quickstart-body');
    if (body) {
      var html = '<div class="qs-steps">';
      STEPS.forEach(function (s) {
        html += '<div class="qs-step">'
          + '<div class="qs-line"></div>'
          + '<div class="qs-num">' + s.num + '</div>'
          + '<div class="qs-body">'
          + '<div class="qs-title">' + esc(s.title) + '</div>'
          + '<p class="qs-why">' + esc(s.why) + '</p>'
          + '<p class="qs-text">' + esc(s.whyText) + '</p>'
          + '<p class="qs-text">' + s.how + '</p>'
          + '<div class="qs-where"><i class="mdi ' + s.where.icon + '"></i>' + esc(s.where.label) + '</div>'
          + '<div class="qs-diagram">' + esc(s.diagram) + '</div>'
          + '<div class="qs-tip"><i class="mdi mdi-lightbulb-outline"></i><span>' + s.tip + '</span></div>'
          + '</div></div>';
      });
      html += '</div>'
        + '<div class="qs-pdf-bar"><button class="qs-pdf-btn" id="qsPdfBtn">'
        + '<i class="mdi mdi-file-pdf-box" aria-hidden="true"></i> Exportar para PDF</button></div>';
      body.innerHTML = html;

      var pdfBtn = document.getElementById('qsPdfBtn');
      if (pdfBtn) {
        pdfBtn.addEventListener('click', function () { window.print(); });
      }
    }
  } catch (e) {
    console.warn('[help-menu] Quickstart content error:', e);
  }

})();
