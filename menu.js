(function () {
  'use strict';

  var supabaseClient = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(
        'https://uzitnphltzblfccmiecf.supabase.co',
        'sb_publishable_8_3FrRYH5JSpdpi9sSv9Wg_T2ST8IGW'
      )
    : null;

  var avatarTrigger = document.getElementById('avatarTrigger');
  var avatarMenu = document.getElementById('avatarMenu');
  var menuOpenBtn = document.getElementById('menuOpenBtn');
  var sheetCloseBtn = document.getElementById('sheetCloseBtn');
  var sheet = document.getElementById('mobileSheet');
  var overlay = document.getElementById('overlay');
  var mobileLogout = document.getElementById('mobileLogout');
  var avatarLogout = document.getElementById('avatarLogout');
  var settingsOverlay = document.getElementById('settingsOverlay');
  var settingsClose = document.getElementById('settingsClose');
  var themeSelect = document.getElementById('themeSelect');

  function closeAvatarMenu() {
    if (!avatarMenu || !avatarTrigger) return;
    avatarMenu.classList.remove('open');
    avatarTrigger.setAttribute('aria-expanded', 'false');
  }

  function toggleAvatarMenu(event) {
    if (!avatarMenu || !avatarTrigger) return;
    event.stopPropagation();
    var isOpen = avatarMenu.classList.toggle('open');
    avatarTrigger.setAttribute('aria-expanded', String(isOpen));
  }

  function closeMobileMenu() {
    if (!sheet) return;
    sheet.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    if (menuOpenBtn) menuOpenBtn.setAttribute('aria-expanded', 'false');
  }

  function openMobileMenu() {
    if (!sheet) return;
    closeAvatarMenu();
    sheet.classList.add('open');
    if (overlay) overlay.classList.add('open');
    if (menuOpenBtn) menuOpenBtn.setAttribute('aria-expanded', 'true');
  }

  function applyTheme(theme) {
    var selected = ['auto', 'light', 'dark'].indexOf(theme) >= 0 ? theme : 'auto';
    var systemIsDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var effective = (selected === 'auto') ? (systemIsDark ? 'dark' : 'light') : selected;
    document.body.classList.remove('theme-auto', 'theme-light', 'theme-dark');
    document.body.classList.add('theme-' + selected);
    if (effective === 'dark') {
      document.body.classList.add('theme-dark');
      document.documentElement.classList.add('theme-dark');
    } else {
      document.documentElement.classList.remove('theme-dark');
    }
    if (themeSelect) themeSelect.value = selected;
  }

  function loadTheme() {
    applyTheme(localStorage.getItem('nurse-theme') || 'auto');
  }

  function openSettings() {
    closeAvatarMenu();
    closeMobileMenu();
    if (!settingsOverlay) return;
    settingsOverlay.hidden = false;
    if (settingsClose) settingsClose.focus();
  }

  function closeSettings() {
    if (settingsOverlay) settingsOverlay.hidden = true;
  }

  async function logout() {
    var buttons = [mobileLogout, avatarLogout].filter(Boolean);
    buttons.forEach(function (button) {
      button.disabled = true;
      button.textContent = 'A sair…';
    });
    if (supabaseClient) await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  }

  if (avatarTrigger) avatarTrigger.addEventListener('click', toggleAvatarMenu);
  if (avatarMenu) avatarMenu.addEventListener('click', function (event) { event.stopPropagation(); });
  if (menuOpenBtn) menuOpenBtn.addEventListener('click', openMobileMenu);
  if (sheetCloseBtn) sheetCloseBtn.addEventListener('click', closeMobileMenu);
  if (overlay) overlay.addEventListener('click', closeMobileMenu);
  if (mobileLogout) mobileLogout.addEventListener('click', logout);
  if (avatarLogout) avatarLogout.addEventListener('click', logout);
  if (settingsClose) settingsClose.addEventListener('click', closeSettings);
  if (settingsOverlay) settingsOverlay.addEventListener('click', function (event) {
    if (event.target === settingsOverlay) closeSettings();
  });
  if (themeSelect) themeSelect.addEventListener('change', function () {
    localStorage.setItem('nurse-theme', themeSelect.value);
    applyTheme(themeSelect.value);
  });

  document.querySelectorAll('[data-action="settings"]').forEach(function (button) {
    button.addEventListener('click', openSettings);
  });

  document.addEventListener('click', function () {
    closeAvatarMenu();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeAvatarMenu();
      closeMobileMenu();
      closeSettings();
    }
  });

  document.querySelectorAll('a[href]').forEach(function (link) {
    link.addEventListener('click', function () {
      closeAvatarMenu();
      if (sheet && sheet.classList.contains('open')) closeMobileMenu();
    });
  });

  loadTheme();
  if (window.matchMedia) {
    var colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    colorScheme.addEventListener && colorScheme.addEventListener('change', function () {
      if ((localStorage.getItem('nurse-theme') || 'auto') === 'auto') applyTheme('auto');
    });
  }

  // Sincronização do Aluno com a Sessão do Supabase
  async function carregarDadosDoAluno() {
    if (!supabaseClient) {
      console.warn('Supabase não inicializado');
      return;
    }

    try {
      var authResult = await supabaseClient.auth.getUser();
      var user = authResult && authResult.data ? authResult.data.user : null;

      if (!user) {
        // Redireciona utilizador não autenticado para o login
        window.location.href = 'login.html?redirect=menu.html';
        return;
      }

      // 1. Obter nome e dados do aluno
      var metadata = user.user_metadata || {};
      var fullName = metadata.full_name || metadata.name || '';

      var avatarUrl = metadata.avatar_url || '';

      // Tenta obter da tabela perfis se disponível
      try {
        var profileRes = await supabaseClient.from('perfis').select('nome, avatar_url').eq('id', user.id).maybeSingle();
        if (profileRes && profileRes.data) {
          if (profileRes.data.nome) fullName = profileRes.data.nome;
          if (profileRes.data.avatar_url) avatarUrl = profileRes.data.avatar_url;
        }
      } catch (err) {
        // Ignora caso a tabela ainda não tenha registo
      }

      var displayName = fullName || (user.email ? user.email.split('@')[0] : 'Aluno');
      var primeirNome = displayName.trim().split(' ')[0];
      var inicial = primeirNome.charAt(0).toUpperCase() || 'A';

      // Atualizar Avatar e Nomes no Topo e Menu Móvel
      var avatarInitialEl = document.getElementById('userAvatarInitial');
      if (avatarInitialEl) {
        if (avatarUrl) {
          avatarInitialEl.innerHTML = '<img src="' + avatarUrl + '" alt="' + displayName + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">';
        } else {
          avatarInitialEl.textContent = inicial;
        }
      }

      var profileLabelEl = document.getElementById('userProfileLabel');
      if (profileLabelEl) profileLabelEl.textContent = primeirNome;

      var avatarUserNameEl = document.getElementById('avatarUserName');
      if (avatarUserNameEl) avatarUserNameEl.textContent = displayName;

      var avatarUserEmailEl = document.getElementById('avatarUserEmail');
      if (avatarUserEmailEl) avatarUserEmailEl.textContent = user.email || '';

      var mobileGreetingEl = document.getElementById('mobileGreetingName');
      if (mobileGreetingEl) mobileGreetingEl.textContent = 'Olá, ' + primeirNome;

      var heroGreetingEl = document.getElementById('heroStudentGreeting');
      if (heroGreetingEl) heroGreetingEl.textContent = 'Bem-vindo(a), ' + primeirNome + ' · Portal do Aluno';

      // 2. Obter Curso Ativo e Atualizar o Painel Hero e Badge do Menu
      var inscricoesResult = await supabaseClient
        .from('inscricoes')
        .select('id, curso, estado, created_at, curso_id, cursos(id, nome, descricao)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      var badgeEl = document.getElementById('navCourseBadge');
      var panelKickerEl = document.getElementById('panelKicker');
      var panelNumberEl = document.getElementById('panelStateNumber');
      var panelTitleEl = document.getElementById('panelCourseTitle');
      var panelDescEl = document.getElementById('panelCourseDesc');
      var panelLinkEl = document.getElementById('panelLink');

      var enrollments = (inscricoesResult && inscricoesResult.data) ? inscricoesResult.data : [];

      if (enrollments.length > 0) {
        var activeEnrollment = enrollments.find(function (e) { return e.estado === 'confirmado'; }) || enrollments[0];
        var courseTitle = (activeEnrollment.cursos && activeEnrollment.cursos.nome) || activeEnrollment.curso || 'Curso de Saúde';
        var isConfirmed = activeEnrollment.estado === 'confirmado';

        if (badgeEl) {
          badgeEl.textContent = isConfirmed ? 'Confirmado' : 'Pendente';
          badgeEl.className = 'badge ' + (isConfirmed ? 'badge-success' : 'badge-warning');
        }

        if (panelKickerEl) panelKickerEl.textContent = isConfirmed ? 'Matrícula Confirmada' : 'Inscrição em Validação';
        if (panelNumberEl) panelNumberEl.textContent = isConfirmed ? 'Ativo' : '01';
        if (panelTitleEl) panelTitleEl.textContent = courseTitle;
        if (panelDescEl) {
          panelDescEl.textContent = isConfirmed
            ? 'Os módulos práticos e materiais de estudo estão prontos para consulta.'
            : 'O teu registo foi submetido e aguarda validação da coordenação pedagógica.';
        }
        if (panelLinkEl) {
          panelLinkEl.href = 'meu-curso.html';
          panelLinkEl.innerHTML = 'Aceder ao curso <span>↗</span>';
        }
      } else {
        if (badgeEl) {
          badgeEl.textContent = 'Catálogo';
          badgeEl.className = 'badge badge-info';
        }
        if (panelKickerEl) panelKickerEl.textContent = 'Formação Contínua';
        if (panelNumberEl) panelNumberEl.textContent = '00';
        if (panelTitleEl) panelTitleEl.textContent = 'Nenhum curso ativo no momento';
        if (panelDescEl) panelDescEl.textContent = 'Explora o catálogo completo para escolheres a tua próxima especialização.';
        if (panelLinkEl) {
          panelLinkEl.href = 'cursos.html';
          panelLinkEl.innerHTML = 'Ver catálogo de cursos <span>↗</span>';
        }
      }

    } catch (e) {
      console.error('Erro ao autenticar e sincronizar aluno:', e);
    }
  }

  carregarDadosDoAluno();
})();
