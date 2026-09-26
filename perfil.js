(async function () {
  'use strict';

  const client = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(
        'https://uzitnphltzblfccmiecf.supabase.co',
        'sb_publishable_8_3FrRYH5JSpdpi9sSv9Wg_T2ST8IGW'
      )
    : null;

  const $ = (id) => document.getElementById(id);
  const feedback = $('profile-feedback');
  const btnSave  = $('btnSaveProfile');
  const fileInput = $('avatarFileInput');

  if (!client) {
    if (feedback) {
      feedback.textContent = 'Não foi possível ligar ao serviço de autenticação.';
      feedback.className = 'feedback error';
    }
    return;
  }

  // 1. Verificar autenticação do utilizador
  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    window.location.href = 'login.html?redirect=perfil.html';
    return;
  }

  const metadata = user.user_metadata || {};
  let currentAvatarUrl = metadata.avatar_url || '';
  let studentName = metadata.full_name || metadata.name || '';
  let studentPhone = metadata.telefone || '';

  // 2. Tentar carregar dados da tabela perfis
  try {
    const { data: profile } = await client.from('perfis').select('nome, telefone, avatar_url').eq('id', user.id).maybeSingle();
    if (profile) {
      if (profile.nome) studentName = profile.nome;
      if (profile.telefone) studentPhone = profile.telefone;
      if (profile.avatar_url) currentAvatarUrl = profile.avatar_url;
    }
  } catch (err) {
    console.warn('Tabela perfis ainda sem registo:', err);
  }

  // 3. Povoar os campos
  if ($('full-name')) $('full-name').value = studentName;
  if ($('profile-email-input')) $('profile-email-input').value = user.email || '';
  if ($('profile-phone')) $('profile-phone').value = studentPhone;

  // 4. Renderizar Fotografia do Aluno
  function atualizarVisualizadorFoto(url, nome) {
    const imgEl = $('avatarPreviewImg');
    const initialEl = $('avatarPreviewInitial');
    const btnRemove = $('btnRemoveAvatar');
    const inicial = (nome || user.email || 'A').trim().charAt(0).toUpperCase();

    if (url) {
      imgEl.src = url;
      imgEl.style.display = 'block';
      initialEl.style.display = 'none';
      if (btnRemove) btnRemove.style.display = 'inline-block';
    } else {
      imgEl.src = '';
      imgEl.style.display = 'none';
      initialEl.textContent = inicial;
      initialEl.style.display = 'block';
      if (btnRemove) btnRemove.style.display = 'none';
    }
  }

  atualizarVisualizadorFoto(currentAvatarUrl, studentName);

  // 5. Carregar fotografia exclusivamente a partir de ficheiro ou câmara (sem URL)
  if (fileInput) {
    fileInput.addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        feedback.className = 'feedback error';
        feedback.textContent = 'Por favor seleciona um ficheiro de imagem válido (JPG, PNG ou WEBP).';
        return;
      }

      feedback.className = 'feedback';
      feedback.style.color = 'var(--muted)';
      feedback.textContent = 'A processar fotografia…';

      const reader = new FileReader();
      reader.onload = function (event) {
        const tempImg = new Image();
        tempImg.onload = function () {
          // Otimizar e redimensionar via canvas para manter leve (< 80KB)
          const canvas = document.createElement('canvas');
          const maxDim = 360;
          let width = tempImg.width;
          let height = tempImg.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(tempImg, 0, 0, width, height);

          // Gera data URL comprimido em JPEG
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          currentAvatarUrl = optimizedDataUrl;
          atualizarVisualizadorFoto(currentAvatarUrl, $('full-name').value);

          feedback.className = 'feedback';
          feedback.style.color = '#168653';
          feedback.textContent = 'Fotografia selecionada. Clica em "Guardar alterações" abaixo para confirmar.';
        };
        tempImg.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // 6. Remover fotografia
  window.removerFotoAvatar = function () {
    currentAvatarUrl = '';
    if (fileInput) fileInput.value = '';
    atualizarVisualizadorFoto('', $('full-name').value);
    feedback.className = 'feedback';
    feedback.style.color = 'var(--muted)';
    feedback.textContent = 'Fotografia removida. Clica em "Guardar alterações" para confirmar.';
  };

  // 7. Submissão do Formulário de Perfil
  const profileForm = $('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const name = $('full-name').value.trim();
      const phone = $('profile-phone') ? $('profile-phone').value.trim() : '';
      const newPassword = $('new-password') ? $('new-password').value : '';
      const confirmPassword = $('confirm-password') ? $('confirm-password').value : '';

      if (!name) {
        feedback.className = 'feedback error';
        feedback.textContent = 'O nome completo é obrigatório.';
        return;
      }

      if (newPassword) {
        if (newPassword.length < 6) {
          feedback.className = 'feedback error';
          feedback.textContent = 'A nova palavra-passe deve conter pelo menos 6 caracteres.';
          return;
        }
        if (confirmPassword && newPassword !== confirmPassword) {
          feedback.className = 'feedback error';
          feedback.textContent = 'As palavras-passe introduzidas não coincidem.';
          return;
        }
      }

      btnSave.disabled = true;
      btnSave.textContent = 'A guardar alterações…';
      feedback.className = 'feedback';
      feedback.style.color = 'var(--muted)';
      feedback.textContent = 'A atualizar os teus dados…';

      try {
        // Atualizar dados de autenticação
        const authUpdates = {
          data: {
            full_name: name,
            telefone: phone,
            avatar_url: currentAvatarUrl
          }
        };

        if (newPassword) {
          authUpdates.password = newPassword;
        }

        const { error: authError } = await client.auth.updateUser(authUpdates);

        if (authError) {
          feedback.className = 'feedback error';
          feedback.textContent = 'Erro ao guardar: ' + authError.message;
          btnSave.disabled = false;
          btnSave.textContent = 'Guardar alterações';
          return;
        }

        // Atualizar tabela perfis
        try {
          await client.from('perfis').upsert({
            id: user.id,
            nome: name,
            telefone: phone,
            avatar_url: currentAvatarUrl,
            updated_at: new Date().toISOString()
          });
        } catch (dbErr) {
          console.warn('Aviso ao sincronizar tabela perfis:', dbErr);
        }

        // Atualizar elementos no topo da página em tempo real
        const topAvatarEl = $('userAvatarInitial');
        if (topAvatarEl) {
          if (currentAvatarUrl) {
            topAvatarEl.innerHTML = '<img src="' + currentAvatarUrl + '" alt="' + name + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">';
          } else {
            topAvatarEl.textContent = name.charAt(0).toUpperCase() || 'A';
          }
        }

        const topProfileLabel = $('userProfileLabel');
        if (topProfileLabel) {
          topProfileLabel.textContent = name.trim().split(' ')[0];
        }

        const topUserName = $('avatarUserName');
        if (topUserName) {
          topUserName.textContent = name;
        }

        // Limpar campos de senha
        if ($('new-password')) $('new-password').value = '';
        if ($('confirm-password')) $('confirm-password').value = '';

        feedback.className = 'feedback';
        feedback.style.color = '#168653';
        feedback.textContent = '✓ Perfil e fotografia atualizados com sucesso!';
        btnSave.disabled = false;
        btnSave.textContent = 'Guardar alterações';

        setTimeout(() => {
          if (feedback.textContent.includes('sucesso')) {
            feedback.textContent = '';
          }
        }, 5000);

      } catch (err) {
        console.error('Erro ao atualizar perfil:', err);
        feedback.className = 'feedback error';
        feedback.textContent = 'Ocorreu um erro ao atualizar os dados. Tenta novamente.';
        btnSave.disabled = false;
        btnSave.textContent = 'Guardar alterações';
      }
    });
  }
})();
