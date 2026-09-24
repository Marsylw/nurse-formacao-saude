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
    var effective = selected === 'auto' && systemIsDark ? 'dark' : selected;
    document.body.classList.remove('theme-auto', 'theme-light', 'theme-dark');
    document.body.classList.add('theme-' + selected);
    if (effective === 'dark' && selected === 'auto') document.body.classList.add('theme-dark');
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
})();
