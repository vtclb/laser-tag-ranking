import { registerPlayer } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reg-form');
  const status = document.getElementById('reg-status');
  if(!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    status.textContent='';
    const nick = form.nick.value.trim();
    const age = parseInt(form.age.value,10);
    if(!nick){ alert('Вкажіть нікнейм'); return; }
    if(!age){ alert('Некоректний вік'); return; }
    if(!form.rules.checked){ alert('Потрібно погодитись з правилами'); return; }
    const payload = {
      nick,
      age,
      gender: form.gender.value,
      contact: form.contact.value.trim(),
      experience: form.experience.value
    };
    try{
      const resp = await registerPlayer(payload);
      if(resp==='DUPLICATE'){
        status.textContent = 'Такий нік вже існує';
      }else{
        status.textContent = 'Реєстрація успішна';
        form.reset();
      }
    }catch(err){
      console.debug('[ranking]', err);
      status.textContent = 'Помилка: '+err.message;
      showToast('Помилка реєстрації');
    }
  });
});
