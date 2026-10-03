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

  function setState(label, message) {
    status.textContent = label;
    feedback.textContent = message || '';
  }

  function renderMaterials(modules, completed) {
    const target = $('materials-list');
    target.replaceChildren();

    if (!modules.length) {
      target.innerHTML = '<div class="course-empty">Ainda não existem módulos publicados para este curso.</div>';
      return;
    }

    modules.slice().reverse().forEach((module) => {
      const card = document.createElement('div');
      card.className = 'material-item';

      const moduleTitle = document.createElement('strong');
      moduleTitle.textContent = module.titulo || 'Módulo';
      card.appendChild(moduleTitle);

      const state = document.createElement('span');
      state.textContent = completed.includes(module.id)
        ? 'Concluído'
        : 'Material de estudo';
      card.appendChild(state);

      if (module.youtube_id) {
        const videoLink = document.createElement('a');
        videoLink.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(module.youtube_id);
        videoLink.target = '_blank';
        videoLink.rel = 'noopener';
        videoLink.textContent = 'Ver vídeo';
        videoLink.style.display = 'block';
        videoLink.style.marginTop = '8px';
        videoLink.style.color = 'var(--gold)';
        videoLink.style.fontWeight = '700';
        card.appendChild(videoLink);
      }

      target.appendChild(card);
    });
  }

  if (!client) {
    setState('Erro', 'Não foi possível ligar ao serviço de cursos.');
    return;
  }

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    window.location.href = 'login.html?redirect=meu-curso.html';
    return;
  }

  const result = await client
    .from('inscricoes')
    .select('curso_id,estado,created_at,cursos(id,nome,descricao)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (result.error) {
    setState('Erro', 'Não foi possível carregar as tuas inscrições.');
    title.textContent = 'Erro ao carregar o curso';
    description.textContent = 'Tenta atualizar a página.';
    return;
  }

  const entries = result.data || [];
  const confirmed = entries.filter((entry) => entry.estado === 'confirmado');
  const pending = entries.filter((entry) => entry.estado !== 'confirmado');
  const current = confirmed[0];

  if (!current) {
    setState(
      pending.length ? 'Pendente' : 'Sem inscrição',
      pending.length
        ? 'A tua inscrição está pendente de aprovação.'
        : 'Ainda não tens uma inscrição confirmada.'
    );
    title.textContent = 'Ainda não tens um curso inscrito';
    description.textContent = 'Consulta o catálogo completo para escolheres uma formação.';
    $('next-module').textContent = 'Escolhe uma formação';
    $('next-state').textContent = 'Todos os cursos disponíveis estão listados no catálogo Nurse.';
    return;
  }

  const course = current.cursos || {};
  setState('Confirmado', 'Inscrição confirmada.');
  title.textContent = course.nome || 'Curso inscrito';
  description.textContent = course.descricao || 'Os teus módulos e materiais estão disponíveis abaixo.';

  const modulesResult = await client
    .from('modulos')
    .select('id,titulo,ordem,youtube_id,curso_id')
    .eq('curso_id', current.curso_id)
    .order('ordem', { ascending: true });

  if (modulesResult.error) {
    setState('Erro', 'Não foi possível carregar os módulos deste curso.');
    return;
  }

  const modules = modulesResult.data || [];
  const progressResult = await client
    .from('progresso_modulos')
    .select('modulo_id,estado')
    .eq('curso_id', current.curso_id)
    .eq('user_id', user.id);

  const completed = (progressResult.data || [])
    .filter((entry) => entry.estado === 'concluido')
    .map((entry) => entry.modulo_id);
  const percent = modules.length
    ? Math.round((completed.length / modules.length) * 100)
    : 0;

  $('progress-percent').textContent = percent + '%';
  $('progress-bar').style.width = percent + '%';
  $('progress-summary').textContent = modules.length
    ? completed.length + ' de ' + modules.length + ' módulos concluídos'
    : 'Ainda não existem módulos publicados.';

  const next = modules.find((module) => !completed.includes(module.id));
  $('next-module').textContent = next ? next.titulo : 'Curso concluído';
  $('next-state').textContent = next
    ? (completed.length ? 'Continua a partir do próximo módulo.' : 'Começa pelo primeiro módulo.')
    : 'Parabéns por concluíres todos os módulos.';

  renderMaterials(modules, completed);

  const others = confirmed.slice(1).concat(pending);
  const otherTarget = $('other-enrollments');
  if (others.length) {
    otherTarget.innerHTML = '<p class="eyebrow" style="margin-top:28px">Outras inscrições</p>';
    others.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'course-option';
      const wrapper = document.createElement('div');
      const courseName = document.createElement('strong');
      const courseState = document.createElement('span');
      const otherCourse = item.cursos || {};
      courseName.textContent = otherCourse.nome || 'Curso';
      courseState.textContent = item.estado === 'confirmado' ? 'Confirmado' : 'Pendente';
      wrapper.append(courseName, courseState);
      row.appendChild(wrapper);
      otherTarget.appendChild(row);
    });
  }
})();
