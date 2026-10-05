(function () {
  'use strict';

  // Chave publicável do mesmo projeto Supabase já usado pelo portal; nunca usar service_role no browser.
  var SUPABASE_URL = 'https://uzitnphltzblfccmiecf.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8_3FrRYH5JSpdpi9sSv9Wg_T2ST8IGW';
  var db = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    : null;

  var $ = function (selector, root) { return (root || document).querySelector(selector); };
  var state = {
    courses: [],
    modulesByCourse: new Map(),
    selectedModuleCourseId: '',
    selectedMaterialCourseId: ''
  };

  var fileExtensions = {
    pdf: ['.pdf'],
    video: ['.mp4', '.webm', '.mov'],
    imagem: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    audio: ['.mp3', '.wav', '.ogg', '.m4a'],
    apresentacao: ['.ppt', '.pptx', '.pdf']
  };
  var allowedMimes = {
    pdf: ['application/pdf'],
    video: ['video/mp4', 'video/webm', 'video/quicktime'],
    imagem: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'],
    apresentacao: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/pdf']
  };
  var fileAccept = {
    pdf: '.pdf,application/pdf',
    video: '.mp4,.webm,.mov,video/mp4,video/webm,video/quicktime',
    imagem: '.jpg,.jpeg,.png,.webp,.gif,image/*',
    audio: '.mp3,.wav,.ogg,.m4a,audio/*',
    apresentacao: '.ppt,.pptx,.pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf'
  };
  var typeLabels = { pdf: 'PDF', video: 'Vídeo', imagem: 'Imagem', audio: 'Áudio', apresentacao: 'Apresentação', link: 'Ligação' };

  function setNotice(message, kind) {
    var notice = $('#admin-notice');
    if (!notice) return;
    notice.textContent = message || '';
    notice.dataset.kind = kind || 'success';
    notice.hidden = !message;
  }

  function setBusy(button, busy, busyLabel) {
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = busyLabel || 'A guardar…';
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
      delete button.dataset.originalText;
    }
  }

  function integerValue(value, label, allowEmpty) {
    var text = String(value == null ? '' : value).trim();
    if (!text && allowEmpty) return null;
    if (!/^\d+$/.test(text)) throw new Error(label + ' deve ser um número inteiro não negativo.');
    var parsed = Number(text);
    if (!Number.isSafeInteger(parsed)) throw new Error(label + ' excede o intervalo permitido.');
    return parsed;
  }

  function formatCourseStatus(course) {
    var parts = [];
    parts.push(course.ativo ? 'Ativo' : 'Inativo');
    parts.push(course.visivel ? 'Visível' : 'Oculto');
    return parts.join(' · ');
  }

  function addOption(select, value, label) {
    var option = document.createElement('option');
    option.value = String(value);
    option.textContent = label;
    select.appendChild(option);
  }

  function populateCourseSelect(select, placeholder, preferredValue) {
    if (!select) return;
    select.replaceChildren();
    addOption(select, '', placeholder);
    state.courses.forEach(function (course) { addOption(select, course.id, course.nome); });
    if (preferredValue && state.courses.some(function (course) { return String(course.id) === String(preferredValue); })) {
      select.value = String(preferredValue);
    } else if (state.courses.length) {
      select.value = String(state.courses[0].id);
    }
    select.disabled = !state.courses.length;
  }

  function currentCourse(courseId) {
    return state.courses.find(function (course) { return String(course.id) === String(courseId); }) || null;
  }

  function displayEmpty(container, message) {
    if (!container) return;
    container.replaceChildren();
    var p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = message;
    container.appendChild(p);
  }

  async function loadCourses(preferredId) {
    var target = $('#course-list');
    if (target) displayEmpty(target, 'A carregar cursos…');
    var result = await db.from('cursos')
      .select('id,nome,descricao,duracao,preco,inscricao,certificado,ativo,visivel,data_inicio,data_fim,ordem')
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true });
    if (result.error) throw result.error;
    state.courses = result.data || [];

    var moduleSelect = $('#module-course');
    var materialSelect = $('#material-course');
    var oldModuleId = moduleSelect && moduleSelect.value;
    var oldMaterialId = materialSelect && materialSelect.value;
    populateCourseSelect(moduleSelect, 'Seleciona um curso', preferredId || oldModuleId);
    populateCourseSelect(materialSelect, 'Seleciona um curso', preferredId || oldMaterialId);
    state.selectedModuleCourseId = moduleSelect ? moduleSelect.value : '';
    state.selectedMaterialCourseId = materialSelect ? materialSelect.value : '';

    renderCourses();
    if (state.selectedModuleCourseId) await loadModules(state.selectedModuleCourseId);
    else displayEmpty($('#module-list'), 'Cria primeiro um curso para adicionares módulos.');
    if (state.selectedMaterialCourseId) {
      await loadModules(state.selectedMaterialCourseId);
      await loadMaterials(state.selectedMaterialCourseId);
    } else {
      populateModuleSelect($('#material-module'), '', 'Seleciona primeiro um curso');
      displayEmpty($('#material-list'), 'Cria primeiro um curso para adicionares materiais.');
    }
  }

  function renderCourses() {
    var target = $('#course-list');
    if (!target) return;
    if (!state.courses.length) {
      displayEmpty(target, 'Ainda não existem cursos. Usa o formulário para criar o primeiro.');
      return;
    }
    target.replaceChildren();
    state.courses.forEach(function (course) {
      var row = document.createElement('article');
      row.className = 'course-row';
      var content = document.createElement('div');
      var title = document.createElement('strong');
      title.textContent = course.nome || 'Curso sem nome';
      var meta = document.createElement('p');
      meta.textContent = [course.duracao, course.ordem != null ? 'Ordem ' + course.ordem : ''].filter(Boolean).join(' · ') || 'Sem detalhes adicionais';
      content.append(title, meta);
      var status = document.createElement('span');
      status.className = 'course-state';
      status.textContent = formatCourseStatus(course);
      row.append(content, status);
      target.appendChild(row);
    });
  }

  function populateModuleSelect(select, courseId, placeholder) {
    if (!select) return;
    select.replaceChildren();
    addOption(select, '', placeholder || 'Seleciona um módulo');
    var modules = state.modulesByCourse.get(String(courseId)) || [];
    modules.forEach(function (module) {
      addOption(select, module.id, (module.ordem != null ? module.ordem + ' · ' : '') + module.titulo);
    });
    select.disabled = !modules.length;
  }

  async function loadModules(courseId) {
    if (!courseId) return [];
    var result = await db.from('modulos')
      .select('id,curso,curso_id,titulo,ordem,youtube_id,descricao')
      .eq('curso_id', courseId)
      .order('ordem', { ascending: true })
      .order('id', { ascending: true });
    if (result.error) throw result.error;
    var modules = result.data || [];
    state.modulesByCourse.set(String(courseId), modules);
    if ($('#module-course') && String($('#module-course').value) === String(courseId)) renderModules(modules);
    if ($('#material-course') && String($('#material-course').value) === String(courseId)) {
      var previousModule = $('#material-module').value;
      populateModuleSelect($('#material-module'), courseId, 'Seleciona um módulo');
      if (modules.some(function (module) { return String(module.id) === String(previousModule); })) $('#material-module').value = String(previousModule);
    }
    return modules;
  }

  function renderModules(modules) {
    var target = $('#module-list');
    if (!target) return;
    if (!modules.length) {
      displayEmpty(target, 'Este curso ainda não tem módulos. Usa o formulário para criar o primeiro.');
      return;
    }
    target.replaceChildren();
    modules.forEach(function (module, index) {
      var row = document.createElement('article');
      row.className = 'module-row';
      var info = document.createElement('div');
      var title = document.createElement('strong');
      title.textContent = module.titulo || 'Módulo sem título';
      var meta = document.createElement('p');
      meta.textContent = 'ID ' + module.id + ' · Ordem ' + module.ordem;
      info.append(title, meta);
      var controls = document.createElement('div');
      controls.className = 'module-move';
      var up = document.createElement('button');
      up.type = 'button'; up.className = 'button button-quiet'; up.textContent = '↑';
      up.setAttribute('aria-label', 'Mover ' + (module.titulo || 'módulo') + ' para cima');
      up.dataset.moduleMove = 'up'; up.dataset.moduleId = String(module.id); up.disabled = index === 0;
      var down = document.createElement('button');
      down.type = 'button'; down.className = 'button button-quiet'; down.textContent = '↓';
      down.setAttribute('aria-label', 'Mover ' + (module.titulo || 'módulo') + ' para baixo');
      down.dataset.moduleMove = 'down'; down.dataset.moduleId = String(module.id); down.disabled = index === modules.length - 1;
      controls.append(up, down);
      row.append(info, controls);
      target.appendChild(row);
    });
  }

  async function loadMaterials(courseId) {
    var target = $('#material-list');
    if (!target || !courseId) return;
    displayEmpty(target, 'A carregar materiais…');
    var result = await db.from('materiais')
      .select('id,curso_id,modulo_id,titulo,tipo,storage_path,ordem,publicado,created_at,updated_at')
      .eq('curso_id', courseId)
      .order('modulo_id', { ascending: true })
      .order('ordem', { ascending: true });
    if (result.error) throw result.error;
    if (String($('#material-course').value) !== String(courseId)) return;
    renderMaterials(courseId, result.data || []);
  }

  function makeControl(labelText, control, className) {
    var label = document.createElement('label');
    label.className = 'inline-control' + (className ? ' ' + className : '');
    var text = document.createElement('span');
    text.textContent = labelText;
    label.append(text, control);
    return label;
  }

  function renderMaterials(courseId, materials) {
    var target = $('#material-list');
    if (!target) return;
    if (!materials.length) {
      displayEmpty(target, 'Ainda não existem materiais para este curso. Os novos materiais ficam privados até serem publicados.');
      return;
    }
    var modules = state.modulesByCourse.get(String(courseId)) || [];
    target.replaceChildren();
    materials.forEach(function (material) {
      var card = document.createElement('article');
      card.className = 'material-card';
      card.dataset.materialId = String(material.id);
      card.dataset.materialType = material.tipo;
      card.dataset.materialPath = material.storage_path || '';
      card.dataset.materialModuleId = String(material.modulo_id);
      card.dataset.materialPublished = String(Boolean(material.publicado));

      var head = document.createElement('div'); head.className = 'material-card-head';
      var titleWrap = document.createElement('div');
      var title = document.createElement('strong'); title.textContent = material.titulo || 'Material sem título';
      var module = modules.find(function (item) { return String(item.id) === String(material.modulo_id); });
      var status = document.createElement('p'); status.className = 'material-status';
      status.textContent = (module ? module.titulo : 'Módulo ' + material.modulo_id) + ' · Ordem ' + material.ordem + ' · ' + (material.publicado ? 'Publicado' : 'Rascunho');
      titleWrap.append(title, status);
      var type = document.createElement('span'); type.className = 'material-type'; type.textContent = typeLabels[material.tipo] || material.tipo;
      head.append(titleWrap, type);

      var controls = document.createElement('div'); controls.className = 'inline-controls';
      var moduleSelect = document.createElement('select'); moduleSelect.className = 'material-module-select'; moduleSelect.setAttribute('aria-label', 'Módulo de ' + material.titulo);
      addOption(moduleSelect, '', 'Seleciona módulo');
      modules.forEach(function (item) { addOption(moduleSelect, item.id, item.titulo); });
      moduleSelect.value = String(material.modulo_id);
      var orderInput = document.createElement('input'); orderInput.type = 'number'; orderInput.min = '0'; orderInput.step = '1'; orderInput.value = String(material.ordem); orderInput.className = 'material-order-input'; orderInput.setAttribute('aria-label', 'Ordem de ' + material.titulo);
      var saveLocation = document.createElement('button'); saveLocation.type = 'button'; saveLocation.className = 'button button-quiet'; saveLocation.textContent = 'Guardar'; saveLocation.dataset.action = 'save-location';
      controls.append(makeControl('Módulo', moduleSelect), makeControl('Ordem', orderInput), saveLocation);

      var actions = document.createElement('div'); actions.className = 'material-actions';
      var publish = document.createElement('button'); publish.type = 'button'; publish.className = 'button button-quiet'; publish.textContent = material.publicado ? 'Retirar publicação' : 'Publicar'; publish.dataset.action = 'toggle-published'; actions.appendChild(publish);

      if (material.tipo === 'link') {
        var linkInput = document.createElement('input'); linkInput.type = 'url'; linkInput.className = 'material-link-input'; linkInput.value = material.storage_path || ''; linkInput.setAttribute('aria-label', 'URL HTTPS do material ' + material.titulo);
        var saveLink = document.createElement('button'); saveLink.type = 'button'; saveLink.className = 'button button-quiet'; saveLink.textContent = 'Guardar ligação'; saveLink.dataset.action = 'replace-link';
        actions.append(makeControl('URL externa (HTTPS)', linkInput, 'material-link-control'), saveLink);
      } else {
        var fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.className = 'material-replacement-file'; fileInput.accept = fileAccept[material.tipo] || ''; fileInput.setAttribute('aria-label', 'Novo ficheiro para substituir ' + material.titulo);
        var replace = document.createElement('button'); replace.type = 'button'; replace.className = 'button button-quiet'; replace.textContent = 'Substituir ficheiro'; replace.dataset.action = 'replace-file';
        actions.append(makeControl('Novo ficheiro', fileInput, 'material-file-control'), replace);
      }

      var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button button-danger'; remove.textContent = 'Eliminar material'; remove.dataset.action = 'delete-material'; actions.appendChild(remove);
      card.append(head, controls, actions);
      target.appendChild(card);
    });
  }

  function extensionOf(filename) {
    var match = String(filename || '').toLowerCase().match(/\.[a-z0-9]{1,8}$/);
    return match ? match[0] : '';
  }

  function validateFile(file, type) {
    var allowed = fileExtensions[type] || [];
    var ext = extensionOf(file && file.name);
    if (!file || !allowed.includes(ext)) {
      throw new Error('O ficheiro não corresponde ao tipo selecionado. Formatos aceites: ' + allowed.join(', ') + '.');
    }
    var mime = String(file.type || '').toLowerCase();
    if (mime && !(allowedMimes[type] || []).includes(mime)) {
      throw new Error('O tipo MIME declarado pelo browser não corresponde ao tipo de material selecionado.');
    }
  }

  function safeFilename(filename) {
    var base = String(filename || 'ficheiro')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^\.+/, '')
      .slice(-100);
    return base || 'ficheiro';
  }

  function makeStoragePath(courseId, moduleId, file) {
    var token = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
    return String(courseId) + '/' + String(moduleId) + '/' + token + '-' + safeFilename(file.name);
  }

  async function uploadFile(courseId, moduleId, file, type) {
    validateFile(file, type);
    var path = makeStoragePath(courseId, moduleId, file);
    var result = await db.storage.from('course-materials').upload(path, file, {
      upsert: false,
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream'
    });
    if (result.error) throw result.error;
    return path;
  }

  function normalizeHttpsUrl(value) {
    var url;
    try { url = new URL(String(value || '').trim()); }
    catch (_) { throw new Error('Indica uma ligação válida.'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('A ligação externa tem de usar HTTPS e não pode incluir credenciais.');
    return url.href;
  }

  async function createCourse(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var button = form.querySelector('button[type="submit"]');
    setNotice('', 'success'); setBusy(button, true, 'A criar curso…');
    try {
      var payload = {
        nome: $('#course-name').value.trim(),
        descricao: $('#course-description').value.trim() || null,
        duracao: $('#course-duration').value.trim() || null,
        preco: integerValue($('#course-price').value, 'Preço', true),
        inscricao: integerValue($('#course-enrollment-fee').value, 'Inscrição', true),
        certificado: integerValue($('#course-certificate-fee').value, 'Certificado', true),
        ordem: integerValue($('#course-order').value, 'Ordem do curso', false),
        ativo: $('#course-active').checked,
        visivel: $('#course-visible').checked,
        data_inicio: $('#course-start').value || null,
        data_fim: $('#course-end').value || null
      };
      if (!payload.nome) throw new Error('Indica o nome do curso.');
      if (payload.data_inicio && payload.data_fim && payload.data_fim < payload.data_inicio) throw new Error('A data de fim não pode anteceder a data de início.');
      var result = await db.from('cursos').insert(payload).select('id').single();
      if (result.error) throw result.error;
      form.reset();
      await loadCourses(result.data.id);
      setNotice('Curso criado com sucesso. Já podes adicionar módulos.', 'success');
    } catch (error) {
      console.error('Falha ao criar curso:', error);
      setNotice(error.message || 'Não foi possível criar o curso.', 'error');
    } finally { setBusy(button, false); }
  }

  function parseYoutubeId(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
    try {
      var url = new URL(raw);
      var id = url.hostname === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0] : url.searchParams.get('v');
      if (!id && /(^|\.)youtube(?:-nocookie)?\.com$/i.test(url.hostname)) id = url.pathname.split('/').filter(Boolean).pop();
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return id;
    } catch (_) { /* Uma entrada não-URL é validada abaixo. */ }
    throw new Error('Indica um ID YouTube de 11 caracteres ou uma URL válida do YouTube.');
  }

  async function createModule(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var button = form.querySelector('button[type="submit"]');
    setNotice('', 'success'); setBusy(button, true, 'A criar módulo…');
    try {
      var course = currentCourse($('#module-course').value);
      if (!course) throw new Error('Seleciona um curso válido.');
      var payload = {
        curso_id: course.id,
        curso: course.nome,
        titulo: $('#module-title').value.trim(),
        descricao: $('#module-description').value.trim() || null,
        ordem: integerValue($('#module-order').value, 'Ordem do módulo', false),
        youtube_id: parseYoutubeId($('#module-youtube-id').value)
      };
      if (!payload.titulo) throw new Error('Indica o título do módulo.');
      var result = await db.from('modulos').insert(payload).select('id').single();
      if (result.error) throw result.error;
      var courseId = String(course.id);
      form.reset();
      $('#module-course').value = courseId;
      $('#module-order').value = '10';
      await loadModules(courseId);
      setNotice('Módulo criado (ID ' + result.data.id + ').', 'success');
    } catch (error) {
      console.error('Falha ao criar módulo:', error);
      setNotice(error.message || 'Não foi possível criar o módulo.', 'error');
    } finally { setBusy(button, false); }
  }

  async function reorderModule(moduleId, direction) {
    var courseId = $('#module-course').value;
    var modules = (state.modulesByCourse.get(String(courseId)) || []).slice();
    var index = modules.findIndex(function (module) { return String(module.id) === String(moduleId); });
    var otherIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || otherIndex < 0 || otherIndex >= modules.length) return;
    var moved = modules.splice(index, 1)[0];
    modules.splice(otherIndex, 0, moved);
    setNotice('', 'success');
    var buttons = document.querySelectorAll('[data-module-move]');
    buttons.forEach(function (button) { button.disabled = true; });
    try {
      var result = await db.rpc('admin_reorder_modules', {
        p_curso_id: courseId,
        p_module_ids: modules.map(function (module) { return module.id; })
      });
      if (result.error) throw result.error;
      await loadModules(courseId);
      setNotice('Ordem dos módulos atualizada.', 'success');
    } catch (error) {
      console.error('Falha ao reordenar módulos:', error);
      setNotice(error.message || 'Não foi possível reordenar os módulos.', 'error');
      await loadModules(courseId);
    }
  }

  async function createMaterial(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var button = $('#material-submit');
    setNotice('', 'success'); setBusy(button, true, 'A guardar material…');
    var newPath = '';
    var cleanupFailed = false;
    try {
      var courseId = $('#material-course').value;
      var moduleId = $('#material-module').value;
      var type = $('#material-type').value;
      var title = $('#material-title').value.trim();
      if (!courseId || !moduleId) throw new Error('Seleciona o curso e o módulo.');
      if (!title) throw new Error('Indica o título do material.');
      var path;
      if (type === 'link') {
        path = normalizeHttpsUrl($('#material-link').value);
      } else {
        var file = $('#material-file').files[0];
        if (!file) throw new Error('Seleciona um ficheiro para carregar.');
        newPath = await uploadFile(courseId, moduleId, file, type);
        path = newPath;
      }
      var payload = {
        curso_id: courseId,
        modulo_id: moduleId,
        titulo: title,
        tipo: type,
        storage_path: path,
        ordem: integerValue($('#material-order').value, 'Ordem do material', false),
        publicado: $('#material-published').checked
      };
      var result = await db.from('materiais').insert(payload).select('id').single();
      if (result.error) throw result.error;
      newPath = '';
      form.reset();
      $('#material-order').value = '10';
      $('#material-type').value = 'pdf';
      updateMaterialTypeFields();
      $('#material-course').value = String(courseId);
      await loadModules(courseId);
      await loadMaterials(courseId);
      setNotice(payload.publicado ? 'Material carregado e publicado.' : 'Material carregado como rascunho. Publica-o quando estiver pronto.', 'success');
    } catch (error) {
      if (newPath) {
        var cleanup = await db.storage.from('course-materials').remove([newPath]);
        if (cleanup.error) {
          cleanupFailed = true;
          console.warn('Não foi possível remover o ficheiro após falha no registo.', cleanup.error);
        }
      }
      console.error('Falha ao criar material:', error);
      setNotice((error.message || 'Não foi possível guardar o material.') + (cleanupFailed ? ' A limpeza do objeto de Storage falhou; verifica o bucket privado.' : ''), cleanupFailed ? 'warning' : 'error');
    } finally { setBusy(button, false); }
  }

  async function saveMaterialLocation(card) {
    var courseId = $('#material-course').value;
    var moduleId = $('.material-module-select', card).value;
    var order = integerValue($('.material-order-input', card).value, 'Ordem do material', false);
    if (!moduleId) throw new Error('Seleciona um módulo.');
    var result = await db.from('materiais').update({ modulo_id: moduleId, ordem: order, updated_at: new Date().toISOString() })
      .eq('id', card.dataset.materialId).eq('curso_id', courseId).select('id').maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new Error('O material não foi atualizado.');
    await loadMaterials(courseId);
    setNotice('Módulo e ordem do material atualizados.', 'success');
  }

  async function togglePublished(card) {
    var courseId = $('#material-course').value;
    var next = card.dataset.materialPublished !== 'true';
    if (next) {
      if (card.dataset.materialType === 'link') {
        normalizeHttpsUrl(card.dataset.materialPath);
      } else {
        var filePath = card.dataset.materialPath;
        if (!filePath || filePath.startsWith('/') || filePath.split('/').includes('..') || /^https?:/i.test(filePath)) {
          throw new Error('Este material não tem um caminho privado válido; não pode ser publicado.');
        }
        var fileCheck = await db.storage.from('course-materials').createSignedUrl(filePath, 60);
        if (fileCheck.error || !fileCheck.data || !fileCheck.data.signedUrl) {
          throw new Error('O ficheiro não está disponível no bucket privado; verifica o carregamento antes de publicar.');
        }
      }
    }
    var result = await db.from('materiais').update({ publicado: next, updated_at: new Date().toISOString() })
      .eq('id', card.dataset.materialId).eq('curso_id', courseId).select('id').maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new Error('O estado do material não foi atualizado.');
    await loadMaterials(courseId);
    setNotice(next ? 'Material publicado para alunos com inscrição confirmada.' : 'Material retirado da publicação.', 'success');
  }

  async function replaceMaterialFile(card) {
    var file = $('.material-replacement-file', card).files[0];
    if (!file) throw new Error('Seleciona primeiro o novo ficheiro.');
    var type = card.dataset.materialType;
    var courseId = $('#material-course').value;
    var moduleId = card.dataset.materialModuleId || 'sem-modulo';
    var oldPath = card.dataset.materialPath;
    var newPath = await uploadFile(courseId, moduleId, file, type);
    var result = await db.from('materiais').update({ storage_path: newPath, updated_at: new Date().toISOString() })
      .eq('id', card.dataset.materialId).eq('curso_id', courseId).select('id').maybeSingle();
    if (result.error || !result.data) {
      var cleanup = await db.storage.from('course-materials').remove([newPath]);
      if (cleanup.error) console.warn('Não foi possível remover o novo ficheiro após falha na substituição.', cleanup.error);
      if (result.error) throw result.error;
      throw new Error('O registo do material não foi atualizado.');
    }
    var removed = oldPath && !/^https?:\/\//i.test(oldPath)
      ? await db.storage.from('course-materials').remove([oldPath])
      : { error: null };
    await loadMaterials(courseId);
    if (removed.error) setNotice('Ficheiro substituído, mas não foi possível remover o objeto antigo do Storage. Verifica-o no bucket privado.', 'warning');
    else setNotice('Ficheiro substituído com sucesso.', 'success');
  }

  async function replaceMaterialLink(card) {
    var courseId = $('#material-course').value;
    var link = normalizeHttpsUrl($('.material-link-input', card).value);
    var result = await db.from('materiais').update({ storage_path: link, updated_at: new Date().toISOString() })
      .eq('id', card.dataset.materialId).eq('curso_id', courseId).select('id').maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new Error('A ligação não foi atualizada.');
    await loadMaterials(courseId);
    setNotice('Ligação atualizada.', 'success');
  }

  async function deleteMaterial(card) {
    var title = $('strong', card).textContent;
    if (!window.confirm('Eliminar o material “' + title + '”? Esta ação remove o registo do catálogo.')) return;
    var courseId = $('#material-course').value;
    var type = card.dataset.materialType;
    var path = card.dataset.materialPath;
    var result = await db.from('materiais').delete().eq('id', card.dataset.materialId).eq('curso_id', courseId).select('id').maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new Error('O material não foi eliminado.');
    var storageResult = type !== 'link' && path && !/^https?:\/\//i.test(path)
      ? await db.storage.from('course-materials').remove([path])
      : { error: null };
    await loadMaterials(courseId);
    if (storageResult.error) setNotice('Registo eliminado, mas o objeto antigo não foi removido do Storage. Verifica-o no bucket privado.', 'warning');
    else setNotice('Material eliminado.', 'success');
  }

  function updateMaterialTypeFields() {
    var type = $('#material-type').value;
    var isLink = type === 'link';
    $('#material-file-group').hidden = isLink;
    $('#material-link-group').hidden = !isLink;
    $('#material-file').required = !isLink;
    $('#material-link').required = isLink;
    $('#material-file').accept = fileAccept[type] || '';
  }

  function bindEvents() {
    $('#course-form').addEventListener('submit', createCourse);
    $('#module-form').addEventListener('submit', createModule);
    $('#material-form').addEventListener('submit', createMaterial);
    $('#material-type').addEventListener('change', updateMaterialTypeFields);
    $('#module-course').addEventListener('change', async function (event) {
      state.selectedModuleCourseId = event.target.value;
      try { await loadModules(event.target.value); }
      catch (error) { setNotice(error.message || 'Não foi possível carregar os módulos.', 'error'); }
    });
    $('#material-course').addEventListener('change', async function (event) {
      state.selectedMaterialCourseId = event.target.value;
      try {
        await loadModules(event.target.value);
        await loadMaterials(event.target.value);
      } catch (error) { setNotice(error.message || 'Não foi possível carregar os materiais.', 'error'); }
    });
    $('#reload-courses').addEventListener('click', async function () {
      try { await loadCourses(); setNotice('Lista de cursos atualizada.', 'success'); }
      catch (error) { setNotice(error.message || 'Não foi possível atualizar os cursos.', 'error'); }
    });
    $('#reload-modules').addEventListener('click', async function () {
      try { await loadModules($('#module-course').value); setNotice('Lista de módulos atualizada.', 'success'); }
      catch (error) { setNotice(error.message || 'Não foi possível atualizar os módulos.', 'error'); }
    });
    $('#reload-materials').addEventListener('click', async function () {
      try { await loadModules($('#material-course').value); await loadMaterials($('#material-course').value); setNotice('Lista de materiais atualizada.', 'success'); }
      catch (error) { setNotice(error.message || 'Não foi possível atualizar os materiais.', 'error'); }
    });
    $('#module-list').addEventListener('click', function (event) {
      var button = event.target.closest('[data-module-move]');
      if (!button || button.disabled) return;
      reorderModule(button.dataset.moduleId, button.dataset.moduleMove);
    });
    $('#material-list').addEventListener('click', async function (event) {
      var button = event.target.closest('button[data-action]');
      if (!button) return;
      var card = button.closest('.material-card');
      if (!card) return;
      button.disabled = true;
      try {
        var action = button.dataset.action;
        if (action === 'save-location') await saveMaterialLocation(card);
        else if (action === 'toggle-published') await togglePublished(card);
        else if (action === 'replace-file') await replaceMaterialFile(card);
        else if (action === 'replace-link') await replaceMaterialLink(card);
        else if (action === 'delete-material') await deleteMaterial(card);
      } catch (error) {
        console.error('Falha na gestão do material:', error);
        setNotice(error.message || 'Não foi possível concluir a operação.', 'error');
      } finally { button.disabled = false; }
    });
    $('#admin-logout').addEventListener('click', async function () {
      var result = await db.auth.signOut();
      if (result.error) setNotice('Não foi possível terminar sessão.', 'error');
      else window.location.href = 'login.html';
    });
  }

  function showAccessDenied(message) {
    $('#auth-status').hidden = true;
    $('#admin-app').hidden = true;
    $('#access-denied').hidden = false;
    if (message) $('#access-message').textContent = message;
  }

  async function start() {
    if (!db) {
      showAccessDenied('Não foi possível inicializar a ligação ao Supabase. Verifica a ligação e tenta novamente.');
      return;
    }
    try {
      var result = await db.auth.getUser();
      if (result.error) throw result.error;
      var user = result.data && result.data.user;
      if (!user) {
        showAccessDenied('A tua sessão não está iniciada. Inicia sessão; a permissão de administração continua a ser validada no servidor.');
        return;
      }
      if (!user.app_metadata || user.app_metadata.role !== 'admin') {
        showAccessDenied('Esta conta não tem a claim app_metadata.role=admin. O perfil de aluno (perfis) não é usado para conceder privilégios; pede a um administrador autorizado para configurar a role no Supabase Auth.');
        return;
      }
      $('#auth-status').hidden = true;
      $('#access-denied').hidden = true;
      $('#admin-app').hidden = false;
      $('#admin-identity').textContent = user.email || 'Administrador';
      $('#admin-identity').hidden = false;
      $('#admin-logout').hidden = false;
      bindEvents();
      updateMaterialTypeFields();
      await loadCourses();
    } catch (error) {
      console.error('Não foi possível validar a sessão administrativa:', error);
      showAccessDenied(error.message || 'Não foi possível validar a sessão administrativa.');
    }
  }

  start();
})();
