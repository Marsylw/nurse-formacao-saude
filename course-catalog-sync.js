(function () {
  'use strict';

  var SUPABASE_URL = 'https://uzitnphltzblfccmiecf.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_8_3FrRYH5JSpdpi9sSv9Wg_T2ST8IGW';
  var db = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;
  var courseByName = new Map();
  window.courseCatalogByName = courseByName;

  function norm(value) {
    return String(value || '').trim().toLocaleLowerCase();
  }

  function text(parent, tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value || '';
    parent.appendChild(node);
    return node;
  }

  function formatMoney(value) {
    if (value == null || value === '') return 'A consultar';
    return new Intl.NumberFormat('pt-PT').format(Number(value)) + ' Kz';
  }

  function durationBadge(duration, home) {
    var badge = document.createElement('span');
    var value = String(duration || 'A definir');
    var days = parseInt(value, 10);
    var cls = days <= 3 ? (home ? 'badge-dur-short' : 'badge-3d')
      : days <= 7 ? (home ? 'badge-dur-mid' : 'badge-7d')
        : (home ? 'badge-dur-long' : 'badge-7d');
    badge.className = (home ? 'table-badge ' : 'dur-badge ') + cls;
    badge.textContent = value;
    return badge;
  }

  function rowTitle(row, home) {
    var selector = home ? '.table-course-title' : '.c-title';
    var node = row.querySelector(selector);
    return node ? node.textContent : '';
  }

  function rowMatchesCourse(row, course, home) {
    var title = norm(rowTitle(row, home));
    var name = norm(course.nome);
    if (title === name) return true;
    var aliases = {
      'sbv + dea': ['suporte básico de vida de adulto (sbv) + dea', 'suporte básico de vida (sbv) + dea'],
      'sav': ['suporte avançado de vida de adulto (sav)', 'suporte avançado de vida (sav)'],
      'atuação em bloco operatório': ['atuação em bloco operatório (básico)']
    };
    return (aliases[name] || []).some(function (alias) { return norm(alias) === title; });
  }

  function updateExistingRow(row, course, home) {
    var description = row.querySelector(home ? '.table-course-sub' : '.c-desc');
    if (description && course.descricao) description.textContent = course.descricao;
    var duration = row.querySelector(home ? '.table-badge' : '.dur-badge');
    if (duration && course.duracao) duration.textContent = course.duracao;
    var price = row.querySelector(home ? '.table-price-main' : '.c-price-val');
    if (price && course.preco != null) price.textContent = formatMoney(course.preco);
    var certificate = row.querySelector(home ? '.table-price-cert' : '.c-price-cert');
    if (certificate && course.certificado != null) {
      certificate.textContent = '+ ' + formatMoney(course.certificado) + ' certificado';
    }
    row.dataset.search = norm([course.nome, course.descricao, course.duracao, row.textContent].join(' '));
  }

  function makeCatalogRow(course, home) {
    var row = document.createElement('tr');
    var cat = 'clinica';
    row.dataset[home ? 'category' : 'cat'] = cat;
    row.dataset.search = norm([course.nome, course.descricao, course.duracao].join(' '));
    if (course.duracao) row.dataset[home ? 'duration' : 'duration'] = course.duracao;

    var titleCell = document.createElement('td');
    text(titleCell, 'div', home ? 'table-course-title' : 'c-title', course.nome);
    text(titleCell, 'div', home ? 'table-course-sub' : 'c-desc', course.descricao || 'Formação profissional em saúde.');
    row.appendChild(titleCell);

    var areaCell = document.createElement('td');
    var area = text(areaCell, 'span', home ? '' : 'c-area', 'Formação em Saúde');
    if (home) area.style.cssText = 'color:var(--muted);font-size:0.8rem;';
    row.appendChild(areaCell);

    var durationCell = document.createElement('td');
    durationCell.appendChild(durationBadge(course.duracao, home));
    row.appendChild(durationCell);

    var enrollmentCell = document.createElement('td');
    var enrollment = course.inscricao > 0 ? 'Taxa de ' + formatMoney(course.inscricao) : 'Consultar inscrição';
    var enrollmentLabel = text(enrollmentCell, 'span', '', enrollment);
    enrollmentLabel.style.cssText = home
      ? 'color:#3cd05e;font-size:0.8rem;font-weight:600;'
      : 'color:#168653;font-weight:700;font-size:0.8rem;';
    row.appendChild(enrollmentCell);

    var priceCell = document.createElement('td');
    var priceWrap = document.createElement('div');
    priceWrap.className = home ? '' : 'c-price-box';
    text(priceWrap, 'div', home ? 'table-price-main' : 'c-price-val', formatMoney(course.preco));
    if (course.certificado != null) text(priceWrap, 'div', home ? 'table-price-cert' : 'c-price-cert', '+ ' + formatMoney(course.certificado) + ' certificado');
    priceCell.appendChild(priceWrap);
    row.appendChild(priceCell);

    var actionCell = document.createElement('td');
    actionCell.style.textAlign = 'right';
    var button = text(actionCell, 'button', home ? 'btn-table-action' : 'btn-enroll-action', home ? 'Inscrever' : 'Solicitar Vaga');
    button.type = 'button';
    button.addEventListener('click', function () {
      if (home && typeof window.inscreverCursoDireto === 'function') window.inscreverCursoDireto(course.nome);
      else if (!home && typeof window.abrirModalInscricao === 'function') window.abrirModalInscricao(course.nome, formatMoney(course.preco), course.duracao || 'A definir');
    });
    actionCell.appendChild(button);
    row.appendChild(actionCell);
    return row;
  }

  function syncSignupOptions(courses) {
    var select = document.getElementById('campo-curso');
    if (!select) return;
    var group = select.querySelector('optgroup[data-db-courses]');
    if (!group) {
      group = document.createElement('optgroup');
      group.label = 'Outras formações disponíveis';
      group.dataset.dbCourses = 'true';
      select.appendChild(group);
    }
    courses.forEach(function (course) {
      var option = Array.from(select.options).find(function (item) { return norm(item.value) === norm(course.nome) || norm(item.textContent) === norm(course.nome); });
      if (option) {
        option.dataset.courseId = course.id;
        return;
      }
      var dynamicOption = document.createElement('option');
      dynamicOption.value = course.nome;
      dynamicOption.textContent = course.nome;
      dynamicOption.dataset.courseId = course.id;
      group.appendChild(dynamicOption);
    });
  }

  function syncCatalog(courses, home) {
    var body = document.getElementById(home ? 'coursesTableBody' : 'portalTableBody');
    if (!body) return;
    var existingRows = Array.from(body.querySelectorAll('tr'));
    courses.forEach(function (course) {
      var match = existingRows.find(function (row) { return rowMatchesCourse(row, course, home); });
      if (match) updateExistingRow(match, course, home);
      else body.appendChild(makeCatalogRow(course, home));
    });
    var allRows = body.querySelectorAll('tr').length;
    var allButton = document.querySelector(home
      ? '.filter-pill[data-category="all"]'
      : '.cat-btn[data-cat="all"]');
    if (allButton) allButton.textContent = (home ? 'Todas as Áreas (' : 'Todas as Áreas (') + allRows + ')';
    if (home && typeof window.refreshHomepageCourseCards === 'function') window.refreshHomepageCourseCards();
    if (!home && typeof window.refreshCatalogCourseCards === 'function') window.refreshCatalogCourseCards();
    if (home && typeof window.filtrarCatalogo === 'function') window.filtrarCatalogo();
    if (!home && typeof window.filtrarCursosPortal === 'function') window.filtrarCursosPortal();
  }

  async function load() {
    if (!db) return;
    var result = await db.from('cursos')
      .select('id,nome,descricao,duracao,preco,inscricao,certificado,ativo,visivel,data_inicio,data_fim,ordem')
      .eq('ativo', true)
      .eq('visivel', true)
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true });
    if (result.error) {
      console.error('Não foi possível sincronizar o catálogo de cursos:', result.error.message);
      return;
    }
    var courses = result.data || [];
    courses.forEach(function (course) { courseByName.set(norm(course.nome), course); });
    syncCatalog(courses, true);
    syncCatalog(courses, false);
    syncSignupOptions(courses);
  }

  load();
})();
