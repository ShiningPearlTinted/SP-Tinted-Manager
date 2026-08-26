const BRIDGE_URL='https://script.google.com/macros/s/AKfycby5CKM9m24vhAYelEcLhdkyhgAcFxQewpF7os0HNbRubQyGst0f_xvsnYG2K5HtL_syzg/exec';
const bridge=document.getElementById('bridge');
let bridgeReady=false;
let pendingMessage=null;

function sendToBridge(message){
  if(bridgeReady && bridge.contentWindow){
    bridge.contentWindow.postMessage(message,'*');
  }else{
    pendingMessage=message;
  }
}

addEventListener('message',e=>{
  const m=e.data||{};
  if(m.source!=='SP_TINTED_BRIDGE')return;

  if(m.type==='READY'){
    bridgeReady=true;
    if(pendingMessage){
      const message=pendingMessage;
      pendingMessage=null;
      sendToBridge(message);
    }
    return;
  }

  if(m.type==='LOGIN_RESULT'){
    document.getElementById('login').disabled=false;

    if(!m.payload.success){
      document.getElementById('error').textContent=m.payload.message;
      return;
    }

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('pname').textContent=m.payload.user.name;
    document.getElementById('prole').textContent=m.payload.user.role;
    document.getElementById('avatar').textContent=m.payload.user.name.charAt(0).toUpperCase();
    loadDashboard();
  }

  if(m.type==='DASHBOARD_RESULT'){
    document.getElementById('loading').classList.add('hidden');
    render(m.payload);
  }

  if(m.type==='ERROR'){
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('login').disabled=false;
    document.getElementById('error').textContent=m.payload.message;
  }
});

bridge.src=BRIDGE_URL;

document.getElementById('loginForm').onsubmit=e=>{
  e.preventDefault();
  document.getElementById('error').textContent='';
  document.getElementById('login').disabled=true;

  sendToBridge({
    source:'SP_TINTED_APP',
    type:'LOGIN',
    email:document.getElementById('email').value,
    password:document.getElementById('password').value
  });
};

document.getElementById('toggle').onclick=()=>{
  let p=document.getElementById('password');
  p.type=p.type==='password'?'text':'password';
  document.getElementById('toggle').textContent=p.type==='password'?'Show':'Hide';
};

document.getElementById('refresh').onclick=loadDashboard;

function loadDashboard(){
  document.getElementById('loading').classList.remove('hidden');
  sendToBridge({
    source:'SP_TINTED_APP',
    type:'DASHBOARD'
  });
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
