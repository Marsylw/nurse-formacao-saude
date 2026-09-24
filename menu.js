(function(){
  'use strict';
  var supabaseClient=window.supabase&&window.supabase.createClient?window.supabase.createClient('https://uzitnphltzblfccmiecf.supabase.co','sb_publishable_8_3FrRYH5JSpdpi9sSv9Wg_T2ST8IGW'):null;
  var openBtn=document.getElementById('menuOpenBtn'),closeBtn=document.getElementById('sheetCloseBtn'),sheet=document.getElementById('mobileSheet'),overlay=document.getElementById('overlay');
  function closeMenu(){if(!sheet)return;sheet.classList.remove('open');overlay&&overlay.classList.remove('open');openBtn&&openBtn.setAttribute('aria-expanded','false')}
  function openMenu(){sheet.classList.add('open');overlay.classList.add('open');openBtn.setAttribute('aria-expanded','true')}
  if(openBtn)openBtn.addEventListener('click',openMenu); if(closeBtn)closeBtn.addEventListener('click',closeMenu); if(overlay)overlay.addEventListener('click',closeMenu);
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMenu()});
  var logout=document.getElementById('mobileLogout');
  if(logout)logout.addEventListener('click',async function(){logout.disabled=true;logout.textContent='A sair…';if(supabaseClient)await supabaseClient.auth.signOut();window.location.href='login.html'});
  document.querySelectorAll('a[href]').forEach(function(link){link.addEventListener('click',function(){if(sheet&&sheet.classList.contains('open'))closeMenu()})});
})();
