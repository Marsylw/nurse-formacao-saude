(function () {
  'use strict';
  var SUPABASE_URL = 'https://uzitnphltzblfccmiecf.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8_3FrRYH5JSpdpi9sSv9Wg_T2ST8IGW';
  var db = window.supabase && window.supabase.createClient ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;
  var $ = function (selector, root) { return (root || document).querySelector(selector); };
  var state = { courses: [], modules: new Map(), topics: new Map(), questionCounter: 0 };

  function setNotice(text, kind) {
    var node = $('#admin-notice');
    node.textContent = text || '';
    node.dataset.kind = kind || 'success';
    node.hidden = !text;
  }
  function addOption(select, value, label) {
    var option = document.createElement('option');
    option.value = String(value);
    option.textContent = label;
    select.appendChild(option);
  }
  function empty(target, message) {
    target.replaceChildren();
    var p = document.createElement('p'); p.className = 'empty-state'; p.textContent = message; target.appendChild(p);
  }
  function populateCourses() {
    ['#topic-course', '#topic-list-course', '#assessment-course', '#assessment-list-course'].forEach(function (selector) {
      var select = $(selector), old = select.value;
      select.replaceChildren(); addOption(select, '', 'Seleciona um curso');
      state.courses.forEach(function (course) { addOption(select, course.id, course.nome); });
      if (state.courses.some(function (course) { return String(course.id) === old; })) select.value = old;
      else if (state.courses.length) select.value = String(state.courses[0].id);
    });
  }
  async function loadModules(courseId, select, placeholder) {
    select.replaceChildren(); addOption(select, '', placeholder);
    if (!courseId) { select.disabled = true; return []; }
    var result = await db.from('modulos').select('id,curso_id,titulo,ordem').eq('curso_id', courseId).order('ordem').order('id');
    if (result.error) throw result.error;
    var rows = result.data || []; state.modules.set(String(courseId), rows);
    rows.forEach(function (module) { addOption(select, module.id, (module.ordem || 0) + ' · ' + module.titulo); });
    select.disabled = !rows.length;
    return rows;
  }
  async function loadTopics(courseId) {
    var target = $('#topic-list');
    if (!courseId) { empty(target, 'Seleciona um curso.'); return; }
    empty(target, 'A carregar tópicos…');
    var result = await db.from('topicos').select('id,curso_id,modulo_id,titulo,resumo,ordem,publicado').eq('curso_id', courseId).order('modulo_id').order('ordem').order('created_at');
    if (result.error) throw result.error;
    var topics = result.data || []; state.topics.set(String(courseId), topics);
    if (!topics.length) { empty(target, 'Ainda não existem tópicos neste curso.'); return; }
    target.replaceChildren();
    var modules = state.modules.get(String(courseId)) || [];
    topics.forEach(function (topic) {
      var card = document.createElement('article'); card.className = 'topic-admin-row'; card.dataset.topicId = topic.id; card.dataset.published = String(topic.publicado);
      var body = document.createElement('div');
      var title = document.createElement('strong'); title.textContent = topic.titulo;
      var module = modules.find(function (item) { return String(item.id) === String(topic.modulo_id); });
      var meta = document.createElement('p'); meta.textContent = (module ? module.titulo : 'Módulo') + ' · Ordem ' + topic.ordem + ' · ' + (topic.publicado ? 'Publicado' : 'Rascunho');
      body.append(title, meta);
      var toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'button button-quiet'; toggle.dataset.action = 'toggle-topic'; toggle.textContent = topic.publicado ? 'Retirar publicação' : 'Publicar';
      card.append(body, toggle); target.appendChild(card);
    });
  }
  async function loadAssessments(courseId) {
    var target = $('#assessment-list');
    if (!courseId) { empty(target, 'Seleciona um curso.'); return; }
    empty(target, 'A carregar avaliações…');
    var result = await db.rpc('admin_list_assessments', { p_curso_id: courseId });
    if (result.error) throw result.error;
    var rows = result.data || [];
    if (!rows.length) { empty(target, 'Ainda não existem avaliações neste curso.'); return; }
    var modules = state.modules.get(String(courseId)) || [];
    target.replaceChildren();
    rows.forEach(function (assessment) {
      var row = document.createElement('article'); row.className = 'assessment-admin-row';
      var title = document.createElement('strong'); title.textContent = assessment.titulo;
      var module = modules.find(function (item) { return String(item.id) === String(assessment.modulo_id); });
      var meta = document.createElement('p'); meta.textContent = (module ? module.titulo : 'Avaliação final') + ' · ' + assessment.pergunta_count + ' pergunta(s) · aprovação ' + assessment.minimo_percentual + '% · ' + (assessment.publicado ? 'Publicado' : 'Rascunho');
      row.append(title, meta); target.appendChild(row);
    });
  }
  function buildQuestion() {
    state.questionCounter += 1;
    var index = state.questionCounter;
    var box = document.createElement('fieldset'); box.className = 'question-editor'; box.dataset.questionId = window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'q-' + Date.now() + '-' + index;
    var legend = document.createElement('legend'); legend.textContent = 'Pergunta ' + index;
    var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button button-quiet question-remove'; remove.textContent = 'Remover'; remove.dataset.action = 'remove-question';
    var head = document.createElement('div'); head.className = 'question-editor-head'; head.append(legend, remove);
    var label = document.createElement('label'); label.className = 'field field-wide'; label.append(document.createTextNode('Enunciado'));
    var prompt = document.createElement('textarea'); prompt.className = 'question-prompt'; prompt.rows = 2; prompt.maxLength = 1000; prompt.required = true; label.appendChild(prompt);
    var options = document.createElement('div'); options.className = 'question-options';
    for (var i = 0; i < 4; i += 1) {
      var optionLine = document.createElement('div'); optionLine.className = 'question-option-row';
      var radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'correct-' + index; radio.value = String(i); radio.setAttribute('aria-label', 'Marcar opção ' + (i + 1) + ' como correta'); if (i === 0) radio.checked = true;
      var input = document.createElement('input'); input.type = 'text'; input.className = 'question-option-text'; input.maxLength = 500; input.placeholder = 'Opção ' + (i + 1); input.setAttribute('aria-label', 'Texto da opção ' + (i + 1)); input.required = i < 2;
      optionLine.append(radio, input); options.appendChild(optionLine);
    }
    var hint = document.createElement('p'); hint.className = 'helper-text'; hint.textContent = 'Marca o círculo ao lado da resposta correta; preenche pelo menos duas opções.';
    box.append(head, label, options, hint); return box;
  }
  function collectQuestions() {
    var cards = Array.from(document.querySelectorAll('.question-editor'));
    if (!cards.length) throw new Error('Adiciona pelo menos uma pergunta.');
    return cards.map(function (card) {
      var prompt = $('.question-prompt', card).value.trim();
      var optionRows = Array.from(card.querySelectorAll('.question-option-row'));
      var options = optionRows.map(function (row, index) { return { id: card.dataset.questionId + '-o-' + index, text: $('.question-option-text', row).value.trim(), correct: $('input[type="radio"]', row).checked }; }).filter(function (option) { return option.text; });
      if (!prompt) throw new Error('Preenche o enunciado de todas as perguntas.');
      if (options.length < 2) throw new Error('Cada pergunta precisa de pelo menos duas opções preenchidas.');
      if (options.filter(function (option) { return option.correct; }).length !== 1) throw new Error('Marca uma única resposta correta em cada pergunta.');
      return { id: card.dataset.questionId, prompt: prompt, options: options };
    });
  }
  async function createTopic(event) {
    event.preventDefault(); var button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true;
    try {
      var courseId = $('#topic-course').value, moduleId = $('#topic-module').value;
      if (!courseId || !moduleId) throw new Error('Seleciona o curso e o módulo.');
      var order = Number($('#topic-order').value);
      if (!Number.isInteger(order) || order < 0) throw new Error('A ordem deve ser um número inteiro não negativo.');
      var result = await db.from('topicos').insert({ curso_id: courseId, modulo_id: Number(moduleId), titulo: $('#topic-title').value.trim(), resumo: $('#topic-summary').value.trim(), conteudo: $('#topic-content').value.trim(), ordem: order, publicado: $('#topic-published').value === 'true' }).select('id').single();
      if (result.error) throw result.error;
      var form = event.currentTarget; form.reset(); $('#topic-order').value = '10'; $('#topic-published').value = 'false'; $('#topic-course').value = courseId;
      $('#topic-list-course').value = courseId;
      await loadModules(courseId, $('#topic-module'), 'Seleciona um módulo'); await loadTopics(courseId);
      setNotice('Tópico criado. Para lhe associares um vídeo, usa Materiais na Gestão geral e seleciona este tópico.', 'success');
    } catch (error) { console.error(error); setNotice(error.message || 'Não foi possível criar o tópico.', 'error'); }
    finally { button.disabled = false; }
  }
  async function createAssessment(event) {
    event.preventDefault(); var button = $('#assessment-submit'); button.disabled = true;
    try {
      var courseId = $('#assessment-course').value, moduleValue = $('#assessment-module').value;
      if (!courseId) throw new Error('Seleciona um curso.');
      var passScore = Number($('#assessment-pass-score').value);
      if (!Number.isInteger(passScore) || passScore < 1 || passScore > 100) throw new Error('A nota mínima deve estar entre 1 e 100.');
      var questions = collectQuestions();
      var result = await db.rpc('admin_create_assessment', {
        p_curso_id: courseId, p_modulo_id: moduleValue ? Number(moduleValue) : null,
        p_titulo: $('#assessment-title').value.trim(), p_descricao: $('#assessment-description').value.trim(),
        p_minimo_percentual: passScore, p_questoes: questions, p_publicado: true, p_ordem: 0
      });
      if (result.error) throw result.error;
      var form = event.currentTarget; form.reset(); $('#assessment-pass-score').value = '80';
      $('#assessment-course').value = courseId; $('#question-list').replaceChildren(buildQuestion());
      $('#assessment-list-course').value = courseId;
      await loadModules(courseId, $('#assessment-module'), 'Avaliação final do curso');
      await loadAssessments($('#assessment-list-course').value);
      setNotice('Avaliação criada e publicada. A correção das respostas é feita no servidor.', 'success');
    } catch (error) { console.error(error); setNotice(error.message || 'Não foi possível criar a avaliação.', 'error'); }
    finally { button.disabled = false; }
  }
  async function toggleTopic(card, button) {
    var topicId = card.dataset.topicId, next = card.dataset.published !== 'true'; button.disabled = true;
    try {
      var result = await db.from('topicos').update({ publicado: next }).eq('id', topicId).select('id').maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error('O tópico não foi atualizado.');
      await loadTopics($('#topic-list-course').value); setNotice(next ? 'Tópico publicado para alunos inscritos.' : 'Tópico retirado da publicação.', 'success');
    } catch (error) { setNotice(error.message || 'Não foi possível atualizar o tópico.', 'error'); }
    finally { button.disabled = false; }
  }
  async function start() {
    if (!db) { $('#auth-status').textContent = 'Não foi possível ligar ao Supabase.'; return; }
    try {
      var auth = await db.auth.getUser(), user = auth.data && auth.data.user;
      if (auth.error) throw auth.error;
      if (!user || !user.app_metadata || user.app_metadata.role !== 'admin') {
        $('#auth-status').hidden = true; $('#admin-app').hidden = true; $('#access-denied').hidden = false;
        if (user) $('#access-message').textContent = 'Esta conta não tem a role app_metadata.role=admin.';
        return;
      }
      $('#auth-status').hidden = true; $('#access-denied').hidden = true; $('#admin-app').hidden = false;
      $('#admin-identity').textContent = user.email || 'Administrador'; $('#admin-identity').hidden = false; $('#admin-logout').hidden = false;
      var courses = await db.from('cursos').select('id,nome').order('nome');
      if (courses.error) throw courses.error; state.courses = courses.data || []; populateCourses();
      $('#question-list').appendChild(buildQuestion());
      await Promise.all([
        loadModules($('#topic-course').value, $('#topic-module'), 'Seleciona um módulo'),
        loadModules($('#assessment-course').value, $('#assessment-module'), 'Avaliação final do curso'),
        loadModules($('#topic-list-course').value, document.createElement('select'), ''),
        loadModules($('#assessment-list-course').value, document.createElement('select'), '')
      ]);
      await loadTopics($('#topic-list-course').value); await loadAssessments($('#assessment-list-course').value);
      $('#topic-course').addEventListener('change', function () { loadModules(this.value, $('#topic-module'), 'Seleciona um módulo').catch(function (e) { setNotice(e.message, 'error'); }); });
      $('#assessment-course').addEventListener('change', function () { loadModules(this.value, $('#assessment-module'), 'Avaliação final do curso').catch(function (e) { setNotice(e.message, 'error'); }); });
      $('#topic-list-course').addEventListener('change', async function () { try { await loadModules(this.value, document.createElement('select'), ''); await loadTopics(this.value); } catch (e) { setNotice(e.message, 'error'); } });
      $('#assessment-list-course').addEventListener('change', async function () { try { await loadModules(this.value, document.createElement('select'), ''); await loadAssessments(this.value); } catch (e) { setNotice(e.message, 'error'); } });
      $('#topic-form').addEventListener('submit', createTopic); $('#assessment-form').addEventListener('submit', createAssessment);
      $('#add-question').addEventListener('click', function () { $('#question-list').appendChild(buildQuestion()); });
      $('#question-list').addEventListener('click', function (event) { var button = event.target.closest('[data-action="remove-question"]'); if (!button) return; var cards = document.querySelectorAll('.question-editor'); if (cards.length <= 1) { setNotice('A avaliação precisa de pelo menos uma pergunta.', 'error'); return; } button.closest('.question-editor').remove(); });
      $('#topic-list').addEventListener('click', function (event) { var button = event.target.closest('[data-action="toggle-topic"]'); if (button) toggleTopic(button.closest('.topic-admin-row'), button); });
      $('#reload-topics').addEventListener('click', function () { loadTopics($('#topic-list-course').value).catch(function (e) { setNotice(e.message, 'error'); }); });
      $('#reload-assessments').addEventListener('click', function () { loadAssessments($('#assessment-list-course').value).catch(function (e) { setNotice(e.message, 'error'); }); });
      $('#admin-logout').addEventListener('click', async function () { var result = await db.auth.signOut(); if (result.error) setNotice('Não foi possível terminar sessão.', 'error'); else window.location.href = 'login.html'; });
    } catch (error) { console.error(error); $('#auth-status').textContent = error.message || 'Não foi possível carregar as ferramentas de gestão.'; }
  }
  start();
})();
