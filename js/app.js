const BRIDGE_URL='https://script.google.com/macros/s/AKfycby5CKM9m24vhAYelEcLhdkyhgAcFxQewpF7os0HNbRubQyGst0f_xvsnYG2K5HtL_syzg/exec';

let requestCounter = 0;

function apiRequest(action, params, onSuccess, onError){
  const callback='spTintedCallback_'+(++requestCounter);
  const script=document.createElement('script');
  const query=new URLSearchParams();
  query.set('action',action);
  query.set('callback',callback);

  Object.keys(params||{}).forEach(k=>{
    query.set(k, params[k]);
  });

  let finished=false;

  window[callback]=function(payload){
    finished=true;
    cleanup();
    if(payload && payload.success===false && action==='dashboard'){
      onError(payload.message || 'Dashboard request failed.');
      return;
    }
    onSuccess(payload);
  };

  function cleanup(){
    try{ delete window[callback]; }catch(e){ window[callback]=undefined; }
    if(script.parentNode) script.parentNode.removeChild(script);
  }

  script.onerror=function(){
    if(finished)return;
    finished=true;
    cleanup();
    onError('Unable to connect to SP Tinted Manager Web App.');
  };

  script.src=BRIDGE_URL+'?'+query.toString();
  document.head.appendChild(script);
}

document.getElementById('loginForm').onsubmit=e=>{
  e.preventDefault();
  const button=document.getElementById('login');
  const error=document.getElementById('error');

  error.textContent='';
  button.disabled=true;

  apiRequest(
    'login',
    {
      username:document.getElementById('email').value,
      password:document.getElementById('password').value
    },
    result=>{
      button.disabled=false;

      if(!result || !result.success){
        error.textContent=(result && result.message)||'Invalid username or password.';
        return;
      }

      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');

      const user=result.user||{};
      document.getElementById('pname').textContent=user.name||'Admin';
      document.getElementById('prole').textContent=user.role||'Admin';
      document.getElementById('avatar').textContent=(user.name||'A').charAt(0).toUpperCase();

      loadDashboard();
    },
    message=>{
      button.disabled=false;
      error.textContent=message||'Unable to connect to SP Tinted Manager Web App.';
    }
  );
};

document.getElementById('toggle').onclick=()=>{
  const p=document.getElementById('password');
  p.type=p.type==='password'?'text':'password';
  document.getElementById('toggle').textContent=p.type==='password'?'Show':'Hide';
};

document.getElementById('refresh').onclick=loadDashboard;

function loadDashboard(){
  document.getElementById('loading').classList.remove('hidden');

  apiRequest(
    'dashboard',
    {},
    data=>{
      document.getElementById('loading').classList.add('hidden');
      render(data);
    },
    message=>{
      document.getElementById('loading').classList.add('hidden');
      console.error(message);
    }
  );
}

function render(d){
  document.getElementById('totalCustomers').textContent=d.totalCustomers||0;
  document.getElementById('todayRegistration').textContent=d.todayRegistration||0;
  document.getElementById('totalVehicles').textContent=d.totalVehicles||0;
  document.getElementById('monthlyRegistration').textContent=d.monthlyRegistration||0;

  document.getElementById('recent').innerHTML=
    (d.recentCustomers||[]).map(r=>
      `<tr><td>${esc(r.id)}</td><td>${esc(r.name)}</td><td>${esc(r.vehicle)}</td><td>${esc(r.phone)}</td><td>${esc(r.date)}</td></tr>`
    ).join('') ||
    '<tr><td colspan="5" style="text-align:center">No customer records found.</td></tr>';
}

function esc(v){
  return String(v??'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}
