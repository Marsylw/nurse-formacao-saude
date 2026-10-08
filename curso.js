(async function () {
  'use strict';

  const client = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(
        'https://uzitnphltzblfccmiecf.supabase.co',
        'sb_publishable_8_3FrRYH5JSpdpi9sSv9Wg_T2ST8IGW'
      )
    : null;

  const $ = (id) => document.getElementById(id);
  const status = $('course-status');
  const title = $('course-title');
  const description = $('course-description');
  const feedback = $('course-feedback');
  const materialsTarget = $('materials-list');
  let activeUserId = null;
  let activeCourseId = null;

  function setState(label, message) {
    if (status) status.textContent = label;
    if (feedback) feedback.textContent = message || '';
  }

  function setEmpty(target, message) {
    if (!target) return;
    const empty = document.createElement('div');
    empty.className = 'course-empty';
    empty.textContent = message;
    target.replaceChildren(empty);
  }

  function renderProgress(modules, completedIds) {
    const total = modules.length;
    const completed = modules.filter((module) => completedIds.has(String(module.id))).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    const percentEl = $('progress-percent');
    const bar = $('progress-bar');
    const summary = $('progress-summary');
    const nextModule = $('next-module');
    const nextState = $('next-state');

    if (percentEl) percentEl.textContent = percent + '%';
    if (bar) bar.style.width = percent + '%';
    if (summary) summary.textContent = total
      ? completed + ' de ' + total + ' módulos concluídos'
      : 'Ainda não existem módulos publicados.';

    const next = modules.find((module) => !completedIds.has(String(module.id)));
    if (nextModule) nextModule.textContent = next ? next.titulo : (total ? 'Curso concluído' : 'Sem módulos disponíveis');
    if (nextState) nextState.textContent = next
      ? (completed ? 'Continua a partir do próximo módulo.' : 'Começa pelo primeiro módulo.')
      : (total ? 'Parabéns por concluíres todos os módulos.' : 'Os módulos deste curso ainda não foram publicados.');
  }

  function appendOtherEnrollments(entries, current) {
    const target = $('other-enrollments');
    if (!target) return;
    target.replaceChildren();
    const others = entries.filter((entry) => entry !== current);
    if (!others.length) return;

    const label = document.createElement('p');
    label.className = 'eyebrow';
    label.style.marginTop = '28px';
    label.textContent = 'Outras inscrições';
    target.appendChild(label);

    others.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'course-option';
      const wrapper = document.createElement('div');
      const courseName = document.createElement('strong');
      const courseState = document.createElement('span');
      courseName.textContent = entry.cursos && entry.cursos.nome ? entry.cursos.nome : (entry.curso || 'Curso');
      courseState.textContent = entry.estado === 'confirmado' ? 'Confirmado' : 'Pendente';
      wrapper.append(courseName, courseState);
      row.appendChild(wrapper);
      target.appendChild(row);
    });
  }

  function appendExternalLink(parent, url, label) {
    const link = document.createElement('a');
    link.className = 'material-open-link';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    parent.appendChild(link);
    return link;
  }

  function safeHttpsUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      return url.href;
    } catch (_) {
      return null;
    }
  }

  async function createMaterialCard(material) {
    const card = document.createElement('article');
    card.className = 'material-item';

    const materialTitle = document.createElement('strong');
    materialTitle.textContent = material.titulo || 'Material do curso';
    const typeLabel = document.createElement('span');
    const typeNames = {
      pdf: 'PDF', video: 'Vídeo', imagem: 'Imagem', audio: 'Áudio',
      link: 'Link', apresentacao: 'Apresentação'
    };
    typeLabel.textContent = typeNames[material.tipo] || 'Material';
    card.append(materialTitle, typeLabel);

    if (material.tipo === 'link') {
      const externalUrl = safeHttpsUrl(material.storage_path);
      if (!externalUrl) {
        const unavailable = document.createElement('span');
        unavailable.textContent = 'Este link não está disponível.';
        card.appendChild(unavailable);
        return card;
      }
      appendExternalLink(card, externalUrl, 'Abrir link');
      return card;
    }

    const path = String(material.storage_path || '').trim();
    const segments = path.split('/');
    if (!path || path.startsWith('/') || path.includes('\\') || /^https?:/i.test(path) || segments.some((part) => !part || part === '..')) {
      const invalid = document.createElement('span');
      invalid.textContent = 'O ficheiro não tem um caminho válido.';
      card.appendChild(invalid);
      return card;
    }

    let signedUrl;
    try {
      const result = await client.storage.from('course-materials').createSignedUrl(path, 3600);
      if (result.error || !result.data || !result.data.signedUrl) throw result.error || new Error('URL temporário indisponível');
      signedUrl = result.data.signedUrl;
    } catch (error) {
      console.warn('Não foi possível gerar um URL temporário para um material.', error);
      const unavailable = document.createElement('span');
      unavailable.textContent = 'Este ficheiro está temporariamente indisponível.';
      card.appendChild(unavailable);
      return card;
    }

    if (material.tipo === 'video') {
      const video = document.createElement('video');
      video.className = 'material-player';
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.src = signedUrl;
      video.setAttribute('aria-label', materialTitle.textContent);
      card.appendChild(video);
    } else if (material.tipo === 'audio') {
      const audio = document.createElement('audio');
      audio.className = 'material-player';
      audio.controls = true;
      audio.preload = 'metadata';
      audio.src = signedUrl;
      audio.setAttribute('aria-label', materialTitle.textContent);
      card.appendChild(audio);
    } else if (material.tipo === 'imagem') {
      const image = document.createElement('img');
      image.className = 'material-image-preview';
      image.src = signedUrl;
      image.alt = materialTitle.textContent;
      image.loading = 'lazy';
      card.appendChild(image);
      appendExternalLink(card, signedUrl, 'Ver imagem');
    } else {
      const label = material.tipo === 'pdf' ? 'Abrir PDF'
        : material.tipo === 'apresentacao' ? 'Abrir apresentação' : 'Abrir ficheiro';
      appendExternalLink(card, signedUrl, label);
    }
    return card;
  }

  async function toggleModuleCompletion(module, button, message, completedIds, modules) {
    if (!client || !activeUserId || !activeCourseId || button.disabled) return;
    button.disabled = true;
    button.textContent = 'A guardar…';
    message.textContent = '';

    try {
      const current = await client
        .from('progresso_modulos')
        .select('estado')
        .eq('user_id', activeUserId)
        .eq('curso_id', activeCourseId)
        .eq('modulo_id', module.id)
        .maybeSingle();
      if (current.error) throw current.error;

      const nextState = current.data && current.data.estado === 'concluido' ? 'em_progresso' : 'concluido';
      const write = await client.from('progresso_modulos')
        .upsert({ user_id: activeUserId, curso_id: activeCourseId, modulo_id: module.id, estado: nextState }, {
          onConflict: 'user_id,modulo_id'
        })
        .select('estado')
        .single();

      if (write.error || !write.data) throw write.error || new Error('O progresso não foi atualizado.');
      if (nextState === 'concluido') completedIds.add(String(module.id));
      else completedIds.delete(String(module.id));

      button.dataset.completed = String(nextState === 'concluido');
      button.setAttribute('aria-pressed', String(nextState === 'concluido'));
      button.textContent = nextState === 'concluido' ? 'Reabrir módulo' : 'Marcar como concluído';
      button.disabled = false;
      message.textContent = nextState === 'concluido' ? 'Módulo marcado como concluído.' : 'Módulo reaberto.';
      renderProgress(modules, completedIds);
    } catch (error) {
      console.error('Não foi possível guardar o progresso do módulo:', error);
      button.textContent = button.dataset.completed === 'true' ? 'Reabrir módulo' : 'Marcar como concluído';
      button.disabled = false;
      message.textContent = 'Não foi possível guardar. Tenta novamente.';
    }
  }

  async function renderModules(modules, materials, completedIds, progressError, materialError) {
    if (!materialsTarget) return;
    materialsTarget.replaceChildren();

    if (!modules.length) {
      setEmpty(materialsTarget, 'Ainda não existem módulos publicados para este curso.');
      return;
    }

    const materialsByModule = new Map();
    (materials || []).forEach((material) => {
      const key = String(material.modulo_id);
      if (!materialsByModule.has(key)) materialsByModule.set(key, []);
      materialsByModule.get(key).push(material);
    });

    for (const module of modules) {
      const group = document.createElement('section');
      group.className = 'material-module-group';
      group.id = 'module-materials-' + String(module.id);

      const header = document.createElement('div');
      header.className = 'material-module-header';
      const moduleTitle = document.createElement('h3');
      moduleTitle.className = 'material-module-heading';
      moduleTitle.textContent = module.titulo || 'Módulo';
      header.appendChild(moduleTitle);

      const complete = completedIds.has(String(module.id));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button button-ghost module-completion-toggle';
      button.textContent = complete ? 'Reabrir módulo' : 'Marcar como concluído';
      button.dataset.completed = String(complete);
      button.setAttribute('aria-pressed', String(complete));
      button.disabled = Boolean(progressError);
      header.appendChild(button);

      const progressMessage = document.createElement('p');
      progressMessage.className = 'module-progress-feedback';
      progressMessage.setAttribute('role', 'status');
      progressMessage.setAttribute('aria-live', 'polite');
      if (progressError) progressMessage.textContent = 'Não foi possível carregar o progresso.';
      button.addEventListener('click', () => toggleModuleCompletion(module, button, progressMessage, completedIds, modules));

      const details = document.createElement('div');
      details.className = 'material-module-details';
      if (module.descricao) {
        const moduleDescription = document.createElement('p');
        moduleDescription.textContent = module.descricao;
        details.appendChild(moduleDescription);
      }
      const youtubeId = String(module.youtube_id || '');
      if (/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) {
        appendExternalLink(details, 'https://www.youtube.com/watch?v=' + encodeURIComponent(youtubeId), 'Ver vídeo do módulo');
      }

      const list = document.createElement('div');
      list.className = 'material-module-list';
      if (materialError) {
        const errorMessage = document.createElement('p');
        errorMessage.className = 'course-empty';
        errorMessage.textContent = 'Não foi possível carregar os materiais deste curso.';
        list.appendChild(errorMessage);
      } else {
        const rows = materialsByModule.get(String(module.id)) || [];
        if (!rows.length) {
          const empty = document.createElement('p');
          empty.className = 'course-empty';
          empty.textContent = 'Ainda não existem materiais publicados neste módulo.';
          list.appendChild(empty);
        } else {
          const cards = await Promise.all(rows.map(createMaterialCard));
          cards.forEach((card) => list.appendChild(card));
        }
      }

      group.append(header, progressMessage, details, list);
      materialsTarget.appendChild(group);
    }
  }

  if (!client) {
    setState('Erro', 'Não foi possível ligar ao serviço de cursos.');
    return;
  }

  const authResult = await client.auth.getUser();
  const user = authResult && authResult.data ? authResult.data.user : null;
  if (authResult.error || !user) {
    window.location.href = 'login.html?redirect=meu-curso.html';
    return;
  }
  activeUserId = user.id;

  const enrollmentResult = await client
    .from('inscricoes')
    .select('curso,curso_id,estado,created_at,cursos(id,nome,descricao)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (enrollmentResult.error) {
    setState('Erro', 'Não foi possível carregar as tuas inscrições.');
    if (title) title.textContent = 'Erro ao carregar o curso';
    if (description) description.textContent = 'Tenta atualizar a página.';
    setEmpty(materialsTarget, 'Não foi possível carregar as inscrições.');
    return;
  }

  const entries = enrollmentResult.data || [];
  const confirmed = entries.filter((entry) => entry.estado === 'confirmado');
  const pending = entries.filter((entry) => entry.estado !== 'confirmado');
  const current = confirmed[0];

  if (!current) {
    setState(pending.length ? 'Pendente' : 'Sem inscrição', pending.length
      ? 'A tua inscrição está pendente de aprovação.'
      : 'Ainda não tens uma inscrição confirmada.');
    if (title) title.textContent = 'Ainda não tens um curso inscrito';
    if (description) description.textContent = 'Consulta o catálogo completo para escolheres uma formação.';
    if ($('next-module')) $('next-module').textContent = 'Escolhe uma formação';
    if ($('next-state')) $('next-state').textContent = 'Todos os cursos disponíveis estão listados no catálogo Nurse.';
    if ($('progress-percent')) $('progress-percent').textContent = '0%';
    if ($('progress-bar')) $('progress-bar').style.width = '0%';
    if ($('progress-summary')) $('progress-summary').textContent = 'O progresso fica disponível após a confirmação da inscrição.';
    setEmpty(materialsTarget, 'Os materiais aparecem após a confirmação da inscrição.');
    return;
  }

  activeCourseId = current.curso_id;
  const course = current.cursos || {};
  setState('Confirmado', 'Inscrição confirmada.');
  if (title) title.textContent = course.nome || current.curso || 'Curso inscrito';
  if (description) description.textContent = course.descricao || 'Os teus módulos e materiais estão disponíveis abaixo.';
  appendOtherEnrollments(entries, current);

  const [modulesResult, progressResult, materialsResult] = await Promise.all([
    client.from('modulos')
      .select('id,titulo,descricao,ordem,youtube_id,curso_id')
      .eq('curso_id', activeCourseId)
      .order('ordem', { ascending: true }),
    client.from('progresso_modulos')
      .select('modulo_id,estado')
      .eq('curso_id', activeCourseId)
      .eq('user_id', user.id),
    client.from('materiais')
      .select('modulo_id,titulo,tipo,storage_path,ordem')
      .eq('curso_id', activeCourseId)
      .eq('publicado', true)
      .order('modulo_id', { ascending: true })
      .order('ordem', { ascending: true })
  ]);

  if (modulesResult.error) {
    console.error('Não foi possível carregar os módulos:', modulesResult.error);
    setState('Erro', 'Não foi possível carregar os módulos deste curso.');
    setEmpty(materialsTarget, 'Não foi possível carregar os módulos. Tenta atualizar a página.');
    return;
  }

  const modules = modulesResult.data || [];
  const progressError = progressResult.error || null;
  if (progressError) console.error('Não foi possível carregar o progresso:', progressError);
  const completedIds = new Set((progressResult.data || [])
    .filter((entry) => entry.estado === 'concluido')
    .map((entry) => String(entry.modulo_id)));
  renderProgress(modules, completedIds);
  if (progressError && $('progress-summary')) $('progress-summary').textContent = 'Não foi possível carregar o progresso. Tenta atualizar a página.';
  const materialError = materialsResult.error || null;
  if (materialError) console.error('Não foi possível carregar os materiais:', materialError);

  await renderModules(modules, materialsResult.data || [], completedIds, progressError, materialError);
})();
