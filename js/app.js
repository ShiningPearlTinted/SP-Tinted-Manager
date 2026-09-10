(() => {
  "use strict";
  const API_URL = "api/index.php";
  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const toggleButton = document.getElementById("toggle");
  const errorBox = document.getElementById("error");
  const loginButton = document.getElementById("login");
  const loading = document.getElementById("loading");
  const logoutButton = document.getElementById("logout");
  const logoutModal = document.getElementById("logoutModal");
  const closeLogoutButton = document.getElementById("closeLogout");
  const cancelLogoutButton = document.getElementById("cancelLogout");
  const confirmLogoutButton = document.getElementById("confirmLogout");
  let loginBusy = false;
  let logoutBusy = false;

  function setError(message){ if(errorBox) errorBox.textContent = message || ""; }
  function showLoading(show,text){
    if(!loading)return;
    loading.classList.toggle("hidden",!show);
    const span=loading.querySelector("span");
    if(span&&text)span.textContent=text;
  }
  function setLoginBusy(busy){
    loginBusy=busy;
    if(loginButton){loginButton.disabled=busy;loginButton.textContent=busy?"Signing In...":"Sign In";}
  }
  async function api(action,options={}){
    const fetchOptions={method:options.method||"GET",credentials:"same-origin",headers:{"Accept":"application/json"}};
    if(options.body!==undefined){fetchOptions.headers["Content-Type"]="application/json";fetchOptions.body=JSON.stringify(options.body);}
    const response=await fetch(`${API_URL}?action=${encodeURIComponent(action)}`,fetchOptions);
    let data;
    try{data=await response.json();}catch(_){throw new Error(`Server returned HTTP ${response.status}.`);}
    if(!response.ok||!data||data.success!==true)throw new Error((data&&data.message)||`Request failed (HTTP ${response.status}).`);
    return data;
  }
  if(toggleButton&&passwordInput)toggleButton.addEventListener("click",()=>{
    const visible=passwordInput.type==="text";passwordInput.type=visible?"password":"text";toggleButton.textContent=visible?"Show":"Hide";
  });
  if(loginForm)loginForm.addEventListener("submit",async event=>{
    event.preventDefault();if(loginBusy)return;
    const username=(usernameInput.value||"").trim(),password=passwordInput.value||"";setError("");
    if(!username||!password){setError("Please enter username and password.");return;}
    setLoginBusy(true);
    try{
      const result=await api("login",{method:"POST",body:{username,password}});
      sessionStorage.setItem("sp_tinted_user",JSON.stringify(result.user));
      showDashboard(result.user);await loadDashboard();
    }catch(error){setError(error.message||"Login failed.");}finally{setLoginBusy(false);}
  });

  function openLogoutModal(){
    if(!logoutModal||logoutBusy)return;
    logoutModal.classList.remove("hidden");document.body.classList.add("modal-open");
    setTimeout(()=>closeLogoutButton?.focus(),30);
  }
  function closeLogoutModal(){
    if(!logoutModal||logoutBusy)return;
    logoutModal.classList.add("hidden");document.body.classList.remove("modal-open");logoutButton?.focus();
  }
  logoutButton?.addEventListener("click",openLogoutModal);
  closeLogoutButton?.addEventListener("click",closeLogoutModal);
  cancelLogoutButton?.addEventListener("click",closeLogoutModal);
  logoutModal?.addEventListener("click",event=>{if(event.target===logoutModal)closeLogoutModal();});
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&logoutModal&&!logoutModal.classList.contains("hidden"))closeLogoutModal();
  });
  confirmLogoutButton?.addEventListener("click",async()=>{
    if(logoutBusy)return;
    logoutBusy=true;
    if(confirmLogoutButton){confirmLogoutButton.disabled=true;confirmLogoutButton.textContent="Logging out...";}
    if(cancelLogoutButton)cancelLogoutButton.disabled=true;
    if(closeLogoutButton)closeLogoutButton.disabled=true;
    try{await api("logout",{method:"POST",body:{}});}
    catch(error){console.error("[SP] Logout error:",error);}
    finally{
      sessionStorage.removeItem("sp_tinted_user");logoutModal?.classList.add("hidden");document.body.classList.remove("modal-open");
      document.getElementById("app")?.classList.add("hidden");document.getElementById("loginScreen")?.classList.remove("hidden");
      if(passwordInput)passwordInput.value="";if(usernameInput)usernameInput.value="";
      if(confirmLogoutButton){confirmLogoutButton.disabled=false;confirmLogoutButton.textContent="Logout";}
      if(cancelLogoutButton)cancelLogoutButton.disabled=false;if(closeLogoutButton)closeLogoutButton.disabled=false;logoutBusy=false;
    }
  });

  async function checkSession(){
    try{
      const result=await api("session");
      if(result.user){sessionStorage.setItem("sp_tinted_user",JSON.stringify(result.user));showDashboard(result.user);await loadDashboard();}
    }catch(_){sessionStorage.removeItem("sp_tinted_user");}
  }
  function showDashboard(user){
    document.getElementById("loginScreen")?.classList.add("hidden");document.getElementById("app")?.classList.remove("hidden");
    const name=user?.fullName||user?.name||"Admin",role=user?.role||"User";
    const pname=document.getElementById("pname"),prole=document.getElementById("prole"),avatar=document.getElementById("avatar");
    if(pname)pname.textContent=name;if(prole)prole.textContent=role;if(avatar)avatar.textContent=name.charAt(0).toUpperCase();
  }
  async function loadDashboard(){
    showLoading(true,"Loading Dashboard...");
    try{const result=await api("dashboard");renderDashboard(result);}
    catch(error){console.error("[SP] Dashboard error:",error);setError(error.message||"Unable to load dashboard.");}
    finally{showLoading(false);}
  }
  function renderDashboard(data){
    const dashboard=data.dashboard||data.data||data;
    setText("totalCustomers",dashboard.totalCustomers??0);setText("todayRegistration",dashboard.todayRegistration??0);
    setText("totalVehicles",dashboard.totalVehicles??0);setText("monthlyRegistration",dashboard.monthlyRegistration??0);
    const tbody=document.getElementById("recent");if(!tbody)return;
    const rows=Array.isArray(dashboard.recentCustomers)?dashboard.recentCustomers:(Array.isArray(dashboard.recent)?dashboard.recent:[]);
    if(!rows.length){tbody.innerHTML='<tr><td colspan="5">No customers found.</td></tr>';return;}
    tbody.innerHTML=rows.map(row=>`<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.vehicle)}</td><td>${escapeHtml(row.phone)}</td><td>${escapeHtml(row.date)}</td></tr>`).join("");
  }
  function setText(id,value){const el=document.getElementById(id);if(el)el.textContent=value;}
  function escapeHtml(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
  document.getElementById("refresh")?.addEventListener("click",loadDashboard);
  checkSession();
})();
