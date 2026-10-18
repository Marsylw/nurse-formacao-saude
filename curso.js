(async function () {
  'use strict';
  const client = window.supabase && window.supabase.createClient
    ? window.supabase.createClient('https://uzitnphltzblfccmiecf.supabase.co', 'sb_publishable_8_3FrRYH5JSpdpi9sSv9Wg_T2ST8IGW')
    : null;
  const $ = (id) => document.getElementById(id);
  const els = {
    status: $('course-status'), title: $('course-title'), description: $('course-description'), feedback: $('course-feedback'),
    outline: $('learning-outline'), outlineCount: $('outline-count'), lessonKicker: $('lesson-kicker'), lessonTitle: $('lesson-title'),
    lessonSummary: $('lesson-summary'), player: $('lesson-player'), content: $('lesson-content'), materials: $('lesson-materials'),
    assessment: $('assessment-panel'), assessmentTitle: $('assessment-title'), assessmentDescription: $('assessment-description'),
    assessmentForm: $('assessment-form'), assessmentQuestions: $('assessment-questions'), assessmentResult: $('assessment-result'),
    previous: $('lesson-previous'), next: $('lesson-next'), complete: $('module-complete')
  };
  let userId = null, courseId = null, modules = [], items = [], activeIndex = 0, completed = new Set(), assessmentItems = [];

  function setMessage(node, text) { if (node) node.textContent = text || ''; }
  function setEmpty(node, text) { if (!node) return; const p = document.createElement('p'); p.className = 'course-empty'; p.textContent = text; node.replaceChildren(p); }
  function addTextBlock(parent, text) {
    String(text || '').split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).forEach((part) => {
      const p = document.createElement('p'); p.textContent = part; parent.appendChild(p);
    });
  }
  function isSafePath(path) {
    const value = String(path || '').trim();
    return value && !value.startsWith('/') && !value.includes('\\') && !/^https?:/i.test(value) && !value.split('/').some((part) => !part || part === '..');
  }
  function youtubeId(url) {
    try {
      const parsed = new URL(url);
      if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'].includes(parsed.hostname)) return null;
      let id = parsed.hostname.includes('youtu.be') ? parsed.pathname.slice(1) : (parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop());
      return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
    } catch (_) { return null; }
  }
  function vimeoId(url) {
    try {
      const parsed = new URL(url);
      if (!['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(parsed.hostname)) return null;
      const match = parsed.pathname.match(/(?:video\/)?(\d{6,12})/);
      return match ? match[1] : null;
    } catch (_) { return null; }
  }
  function makeIframe(src, title) {
    const frame = document.createElement('iframe');
    frame.className = 'lesson-iframe'; frame.src = src; frame.title = title || 'Vídeo da aula';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen = true; frame.loading = 'lazy'; frame.referrerPolicy = 'strict-origin-when-cross-origin';
    return frame;
  }
  async function signedUrl(path) {
    if (!isSafePath(path)) throw new Error('Caminho do ficheiro inválido.');
    const result = await client.storage.from('course-materials').createSignedUrl(path, 3600);
    if (result.error || !result.data || !result.data.signedUrl) throw result.error || new Error('Ficheiro indisponível.');
    return result.data.signedUrl;
  }
  async function renderMaterial(material, parent, isMain) {
    const card = document.createElement('article'); card.className = isMain ? 'lesson-media-card lesson-media-main' : 'lesson-resource-card';
    const heading = document.createElement(isMain ? 'span' : 'strong'); heading.className = isMain ? 'lesson-media-label' : 'lesson-resource-title';
    heading.textContent = material.titulo || 'Material da aula'; card.appendChild(heading);
    try {
      if (material.tipo === 'link') {
        const url = new URL(String(material.storage_path || '').trim());
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Ligação insegura ou inválida.');
        const yt = youtubeId(url.href), vimeo = vimeoId(url.href);
        if (yt && isMain) card.appendChild(makeIframe('https://www.youtube-nocookie.com/embed/' + encodeURIComponent(yt), material.titulo));
        else if (vimeo && isMain) card.appendChild(makeIframe('https://player.vimeo.com/video/' + encodeURIComponent(vimeo), material.titulo));
        else { const link = document.createElement('a'); link.className = 'material-open-link'; link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Abrir material'; card.appendChild(link); }
      } else {
        const url = await signedUrl(material.storage_path);
        if (material.tipo === 'video') {
          const yt = youtubeId(url), vimeo = vimeoId(url);
          if ((yt || vimeo) && isMain) card.appendChild(makeIframe(yt ? 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(yt) : 'https://player.vimeo.com/video/' + encodeURIComponent(vimeo), material.titulo));
          else { const video = document.createElement('video'); video.className = 'lesson-video'; video.controls = true; video.playsInline = true; video.preload = 'metadata'; video.src = url; video.setAttribute('aria-label', material.titulo || 'Vídeo da aula'); card.appendChild(video); }
        } else if (material.tipo === 'audio') {
          const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'metadata'; audio.src = url; card.appendChild(audio);
        } else if (material.tipo === 'imagem') {
          const image = document.createElement('img'); image.src = url; image.alt = material.titulo || 'Imagem da aula'; image.loading = 'lazy'; image.className = 'lesson-image'; card.appendChild(image);
        }
        const link = document.createElement('a'); link.className = 'material-open-link'; link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = material.tipo === 'video' ? 'Abrir vídeo noutra janela' : 'Abrir ficheiro'; card.appendChild(link);
      }
    } catch (error) {
      console.warn('Não foi possível carregar um material do curso.', error);
      const unavailable = document.createElement('span'); unavailable.className = 'course-empty'; unavailable.textContent = 'Este material está temporariamente indisponível.'; card.appendChild(unavailable);
    }
    parent.appendChild(card);
  }
  function makeItems(topicRows, materialRows, assessmentRows) {
    const byModule = new Map(modules.map((module) => [String(module.id), []]));
    topicRows.forEach((topic) => {
      const attached = materialRows.filter((material) => String(material.topico_id || '') === String(topic.id));
      const target = byModule.get(String(topic.modulo_id));
      if (target) target.push({ kind: 'topic', id: String(topic.id), title: topic.titulo, summary: topic.resumo || '', content: topic.conteudo || '', materials: attached, moduleId: String(topic.modulo_id), order: Number(topic.ordem) || 0 });
    });
    modules.forEach((module) => {
      const target = byModule.get(String(module.id));
      const unattached = materialRows.filter((material) => String(material.modulo_id) === String(module.id) && !material.topico_id);
      unattached.forEach((material) => {
        target.push({ kind: 'topic', id: 'material-' + material.id, title: material.titulo || 'Material da aula', summary: '', content: '', materials: [material], moduleId: String(module.id), order: Number(material.ordem) || 0 });
      });
      target.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'pt'));
      if (/^[A-Za-z0-9_-]{11}$/.test(String(module.youtube_id || ''))) {
        const hasEmbeddedLessonVideo = target.some((item) => (item.materials || []).some((material) => material.tipo === 'video' || (material.tipo === 'link' && (youtubeId(material.storage_path) || vimeoId(material.storage_path)))));
        if (target.length && !hasEmbeddedLessonVideo) target[0].youtubeId = module.youtube_id;
        else if (!target.length) target.push({ kind: 'topic', id: 'module-video-' + module.id, title: 'Vídeo do módulo', summary: module.descricao || '', content: '', materials: [], youtubeId: module.youtube_id, moduleId: String(module.id), order: 0 });
      }
      assessmentRows.filter((assessment) => String(assessment.modulo_id || '') === String(module.id)).forEach((assessment) => {
        target.push({ kind: 'assessment', id: 'assessment-' + assessment.id, title: assessment.titulo, summary: assessment.descricao || '', assessment: assessment, moduleId: String(module.id) });
      });
    });
    const result = [];
    modules.forEach((module) => {
      const moduleItems = byModule.get(String(module.id)) || [];
      if (!moduleItems.length) moduleItems.push({ kind: 'empty', id: 'empty-' + module.id, title: 'Conteúdo em preparação', summary: 'Este módulo ainda não tem aulas publicadas.', moduleId: String(module.id) });
      moduleItems.forEach((item) => { item.module = module; result.push(item); });
    });
    assessmentRows.filter((assessment) => !assessment.modulo_id).forEach((assessment) => result.push({ kind: 'assessment', id: 'assessment-' + assessment.id, title: assessment.titulo, summary: assessment.descricao || '', assessment: assessment, moduleId: null, module: null }));
    return result;
  }
  function updateProgress() {
    const total = modules.length, done = modules.filter((module) => completed.has(String(module.id))).length;
    const percent = total ? Math.round(done / total * 100) : 0;
    $('progress-percent').textContent = percent + '%'; $('progress-bar').style.width = percent + '%';
    $('progress-summary').textContent = total ? done + ' de ' + total + ' módulos concluídos' : 'Ainda não existem módulos publicados.';
  }
  function renderOutline() {
    if (!items.length) { setEmpty(els.outline, 'Ainda não existem módulos publicados neste curso.'); return; }
    els.outline.replaceChildren();
    const sectionByModule = new Map();
    modules.forEach((module) => {
      const details = document.createElement('details'); details.className = 'outline-module'; details.open = sectionByModule.size === 0;
      const summary = document.createElement('summary');
      const title = document.createElement('span'); title.textContent = module.titulo;
      const count = document.createElement('small'); count.textContent = items.filter((item) => item.moduleId === String(module.id)).length + ' itens';
      summary.append(title, count); details.appendChild(summary);
      const list = document.createElement('div'); list.className = 'outline-module-items'; details.appendChild(list);
      els.outline.appendChild(details); sectionByModule.set(String(module.id), list);
    });
    const finalAssessments = document.createElement('div'); finalAssessments.className = 'outline-module-items outline-final-assessments';
    items.forEach((item, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'outline-item'; button.dataset.itemIndex = String(index);
      button.setAttribute('aria-current', index === activeIndex ? 'step' : 'false');
      const icon = document.createElement('span'); icon.className = 'outline-item-icon'; icon.textContent = item.kind === 'assessment' ? '✓' : item.materials && item.materials.some((m) => m.tipo === 'video') || item.youtubeId ? '▶' : '▤';
      const label = document.createElement('span'); label.textContent = item.title;
      button.append(icon, label);
      if (item.moduleId && sectionByModule.has(item.moduleId)) sectionByModule.get(item.moduleId).appendChild(button);
      else finalAssessments.appendChild(button);
    });
    if (finalAssessments.childElementCount) {
      const heading = document.createElement('p'); heading.className = 'outline-final-title'; heading.textContent = 'Avaliação final'; els.outline.append(heading, finalAssessments);
    }
    const count = items.length; els.outlineCount.textContent = count + (count === 1 ? ' item' : ' itens');
    setActiveOutline();
  }
  function setActiveOutline() {
    els.outline.querySelectorAll('.outline-item').forEach((button) => {
      const active = Number(button.dataset.itemIndex) === activeIndex;
      button.classList.toggle('is-active', active); button.setAttribute('aria-current', active ? 'step' : 'false');
      if (active) button.closest('details') && (button.closest('details').open = true);
    });
  }
  async function renderTopic(item) {
    els.assessment.hidden = true; els.player.replaceChildren(); els.content.replaceChildren(); els.materials.replaceChildren();
    setMessage(els.lessonKicker, (item.module ? item.module.titulo + ' · ' : '') + 'Aula');
    setMessage(els.lessonTitle, item.title); setMessage(els.lessonSummary, item.summary);
    const videos = (item.materials || []).filter((material) => material.tipo === 'video');
    const linkedVideos = (item.materials || []).filter((material) => material.tipo === 'link' && (youtubeId(material.storage_path) || vimeoId(material.storage_path)));
    const primary = videos[0] || linkedVideos[0] || null;
    if (primary) await renderMaterial(primary, els.player, true);
    else if (item.youtubeId) els.player.appendChild(makeIframe('https://www.youtube-nocookie.com/embed/' + encodeURIComponent(item.youtubeId), item.title));
    else setEmpty(els.player, item.kind === 'empty' ? 'O administrador ainda não publicou uma aula neste módulo.' : 'Esta aula não tem um vídeo associado.');
    addTextBlock(els.content, item.content);
    const resources = (item.materials || []).filter((material) => !primary || String(material.id) !== String(primary.id));
    if (resources.length) {
      const heading = document.createElement('h3'); heading.className = 'lesson-resources-heading'; heading.textContent = 'Materiais desta aula'; els.materials.appendChild(heading);
      for (const material of resources) await renderMaterial(material, els.materials, false);
    }
    const module = item.module;
    els.complete.hidden = !module;
    if (module) {
      const isDone = completed.has(String(module.id));
      els.complete.textContent = isDone ? 'Reabrir módulo' : 'Marcar módulo como concluído';
      els.complete.dataset.completed = String(isDone); els.complete.dataset.moduleId = String(module.id);
    }
  }
  function makeQuizQuestion(question, index) {
    const fieldset = document.createElement('fieldset'); fieldset.className = 'assessment-question';
    const legend = document.createElement('legend'); legend.textContent = (index + 1) + '. ' + question.prompt; fieldset.appendChild(legend);
    (question.options || []).forEach((option) => {
      const label = document.createElement('label'); label.className = 'assessment-option';
      const input = document.createElement('input'); input.type = 'radio'; input.name = 'answer-' + question.id; input.value = option.id; input.required = true;
      const text = document.createElement('span'); text.textContent = option.text; label.append(input, text); fieldset.appendChild(label);
    });
    return fieldset;
  }
  async function renderAssessment(item) {
    els.player.replaceChildren(); els.content.replaceChildren(); els.materials.replaceChildren(); els.complete.hidden = true;
    els.assessment.hidden = false; setMessage(els.lessonKicker, item.module ? item.module.titulo + ' · Avaliação' : 'Avaliação final');
    setMessage(els.lessonTitle, item.title); setMessage(els.lessonSummary, item.summary); setMessage(els.assessmentTitle, item.title);
    setMessage(els.assessmentDescription, item.summary || 'Responde a todas as perguntas para veres o resultado.');
    setMessage(els.assessmentResult, ''); els.assessmentQuestions.replaceChildren();
    setEmpty(els.player, 'Questionário de escolha única');
    const attemptResult = await client.from('tentativas_avaliacao').select('percentual,aprovado,created_at').eq('avaliacao_id', item.assessment.id).eq('user_id', userId).order('created_at', { ascending: false }).limit(3);
    if (!attemptResult.error && attemptResult.data && attemptResult.data.length) {
      const attempts = document.createElement('span'); attempts.className = 'assessment-attempts';
      attempts.textContent = 'Tentativas anteriores: ' + attemptResult.data.map((a) => a.percentual + '% ' + (a.aprovado ? '(aprovado)' : '(não aprovado)')).join(' · ');
      els.assessmentDescription.appendChild(attempts);
    }
    const result = await client.rpc('get_student_assessment', { p_assessment_id: item.assessment.id });
    if (result.error || !result.data) { setMessage(els.assessmentResult, 'Não foi possível abrir esta avaliação.'); return; }
    const assessment = result.data;
    assessment.questoes.forEach((question, index) => els.assessmentQuestions.appendChild(makeQuizQuestion(question, index)));
    els.assessmentForm.onsubmit = async function (event) {
      event.preventDefault(); const submit = $('assessment-submit'); submit.disabled = true; setMessage(els.assessmentResult, 'A corrigir…');
      const answers = assessment.questoes.map((question) => {
        const selected = els.assessmentQuestions.querySelector('input[name="answer-' + CSS.escape(question.id) + '"]:checked');
        return selected ? { question_id: question.id, option_id: selected.value } : null;
      });
      if (answers.some((answer) => !answer)) { setMessage(els.assessmentResult, 'Responde a todas as perguntas.'); submit.disabled = false; return; }
      try {
        const checked = await client.rpc('submit_student_assessment', { p_assessment_id: item.assessment.id, p_answers: answers });
        if (checked.error) throw checked.error;
        const row = Array.isArray(checked.data) ? checked.data[0] : checked.data;
        setMessage(els.assessmentResult, row.percentual + '% · ' + (row.aprovado ? 'Aprovado' : 'Não atingiste a nota mínima de ' + assessment.minimo_percentual + '%. Podes tentar novamente.'));
        if (row.aprovado) els.assessmentResult.classList.add('is-passed'); else els.assessmentResult.classList.remove('is-passed');
      } catch (error) { console.error(error); setMessage(els.assessmentResult, 'Não foi possível corrigir a avaliação. Tenta novamente.'); }
      finally { submit.disabled = false; }
    };
  }
  async function renderCurrent() {
    if (!items.length) return;
    const item = items[activeIndex]; setActiveOutline();
    els.previous.disabled = activeIndex === 0; els.next.disabled = activeIndex === items.length - 1;
    if (item.kind === 'assessment') await renderAssessment(item); else await renderTopic(item);
  }
  async function updateModuleCompletion() {
    const button = els.complete, moduleId = button.dataset.moduleId;
    if (!moduleId || !userId || !courseId) return;
    button.disabled = true; const nextState = button.dataset.completed === 'true' ? 'em_progresso' : 'concluido';
    const write = await client.from('progresso_modulos').upsert({ user_id: userId, curso_id: courseId, modulo_id: Number(moduleId), estado: nextState }, { onConflict: 'user_id,modulo_id' });
    if (write.error) { setMessage(els.feedback, 'Não foi possível guardar o progresso. Tenta novamente.'); button.disabled = false; return; }
    if (nextState === 'concluido') completed.add(String(moduleId)); else completed.delete(String(moduleId));
    updateProgress(); button.dataset.completed = String(nextState === 'concluido'); button.textContent = nextState === 'concluido' ? 'Reabrir módulo' : 'Marcar módulo como concluído'; button.disabled = false;
  }
  if (!client) { setMessage(els.status, 'Erro'); setMessage(els.feedback, 'Não foi possível ligar ao serviço de cursos.'); return; }
  const authResult = await client.auth.getUser(), user = authResult.data && authResult.data.user;
  if (authResult.error || !user) { window.location.href = 'login.html?redirect=meu-curso.html'; return; }
  userId = user.id;
  const enrollments = await client.from('inscricoes').select('curso,curso_id,estado,created_at,cursos(id,nome,descricao)').eq('user_id', userId).order('created_at', { ascending: false });
  if (enrollments.error) { setMessage(els.status, 'Erro'); setEmpty(els.outline, 'Não foi possível carregar as inscrições.'); return; }
  const enrollment = (enrollments.data || []).find((entry) => String(entry.estado || '').trim().toLocaleLowerCase() === 'confirmado' && entry.curso_id);
  if (!enrollment) {
    setMessage(els.status, (enrollments.data || []).length ? 'Pendente' : 'Sem inscrição');
    setMessage(els.title, 'Ainda não tens um curso inscrito'); setMessage(els.description, 'Os conteúdos ficam disponíveis após a confirmação da inscrição.');
    setMessage(els.lessonTitle, 'Aguarda a confirmação da inscrição'); setMessage(els.lessonSummary, 'Depois da confirmação, as aulas do teu curso aparecem aqui.');
    setEmpty(els.outline, 'Não há aulas disponíveis.'); setEmpty(els.player, 'Este conteúdo é reservado a alunos com inscrição confirmada.');
    setMessage(els.feedback, 'Consulta o catálogo de cursos ou contacta o suporte se precisares de ajuda.');
    $('progress-summary').textContent = 'O progresso fica disponível após a confirmação da inscrição.'; return;
  }
  courseId = enrollment.curso_id; const course = enrollment.cursos || {};
  setMessage(els.status, 'Inscrição confirmada'); setMessage(els.title, course.nome || enrollment.curso || 'Meu curso');
  setMessage(els.description, course.descricao || 'Continua a tua aprendizagem pelo programa do curso.');
  const results = await Promise.all([
    client.from('modulos').select('id,titulo,descricao,ordem,youtube_id,curso_id').eq('curso_id', courseId).order('ordem').order('id'),
    client.from('topicos').select('id,curso_id,modulo_id,titulo,resumo,conteudo,ordem,publicado').eq('curso_id', courseId).eq('publicado', true).order('modulo_id').order('ordem'),
    client.from('materiais').select('id,curso_id,modulo_id,topico_id,titulo,tipo,storage_path,ordem').eq('curso_id', courseId).eq('publicado', true).order('modulo_id').order('ordem'),
    client.from('progresso_modulos').select('modulo_id,estado').eq('curso_id', courseId).eq('user_id', userId),
    client.rpc('get_student_assessments', { p_curso_id: courseId })
  ]);
  if (results[0].error) { setMessage(els.status, 'Erro'); setEmpty(els.outline, 'Não foi possível carregar os módulos do curso.'); return; }
  modules = results[0].data || [];
  if (results[1].error) console.warn('Tópicos indisponíveis:', results[1].error);
  if (results[2].error) console.warn('Materiais indisponíveis:', results[2].error);
  if (results[3].error) console.warn('Progresso indisponível:', results[3].error);
  if (results[4].error) console.warn('Avaliações indisponíveis:', results[4].error);
  const topics = results[1].data || [], materials = results[2].data || [], assessmentRows = results[4].data || [];
  completed = new Set((results[3].data || []).filter((entry) => entry.estado === 'concluido').map((entry) => String(entry.modulo_id)));
  items = makeItems(topics, materials, assessmentRows); updateProgress();
  if (!modules.length) { setEmpty(els.outline, 'Ainda não existem módulos publicados neste curso.'); setEmpty(els.player, 'As aulas aparecem aqui quando o administrador as publicar.'); return; }
  renderOutline();
  els.outline.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-item-index]'); if (!button) return;
    activeIndex = Number(button.dataset.itemIndex); await renderCurrent();
  });
  els.previous.addEventListener('click', async function () { if (activeIndex > 0) { activeIndex -= 1; await renderCurrent(); } });
  els.next.addEventListener('click', async function () { if (activeIndex < items.length - 1) { activeIndex += 1; await renderCurrent(); } });
  els.complete.addEventListener('click', updateModuleCompletion);
  await renderCurrent();
})();
