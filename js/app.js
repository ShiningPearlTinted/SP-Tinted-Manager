const WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycby5CKM9m24vhAYelEcLhdkyhgAcFxQewpF7os0HNbRubQyGst0f_xvsnYG2K5HtL_syzg/exec';

const bridge = document.getElementById('bridge');
let bridgeReady = false;
let pendingRequests = [];

function setLoginError(message) {
  const error = document.getElementById('error');
  if (error) error.textContent = message || '';
}

function sendToBridge(type, payload) {
  if (!bridge || !bridge.contentWindow) {
    setLoginError('Unable to connect to SP Tinted Manager Web App.');
    return false;
  }

  bridge.contentWindow.postMessage({
    source: 'SP_TINTED_APP',
    type: type,
    ...payload
  }, '*');

  return true;
}

function requestBridge(type, payload) {
  if (!bridgeReady) {
    pendingRequests.push({ type: type, payload: payload });
    return;
  }
  sendToBridge(type, payload);
}

function flushPendingRequests() {
  const queue = pendingRequests.slice();
  pendingRequests = [];
  queue.forEach(function (request) {
    sendToBridge(request.type, request.payload);
  });
}

window.addEventListener('message', function (event) {
  const message = event.data || {};

  if (message.source !== 'SP_TINTED_BRIDGE') return;

  if (message.type === 'READY') {
    bridgeReady = true;
    flushPendingRequests();
    return;
  }

  if (message.type === 'LOGIN_RESULT') {
    handleLoginResult(message.payload);
    return;
  }

  if (message.type === 'DASHBOARD_RESULT') {
    handleDashboardResult(message.payload);
    return;
  }

  if (message.type === 'ERROR') {
    const button = document.getElementById('login');
    if (button) {
      button.disabled = false;
      button.textContent = 'Sign In';
    }

    setLoginError(
      message.payload && message.payload.message
        ? message.payload.message
        : 'Unable to connect to SP Tinted Manager Web App.'
    );
  }
});

if (bridge) bridge.src = WEB_APP_URL;

document.getElementById('loginForm').addEventListener('submit', function (event) {
  event.preventDefault();

  const username = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const button = document.getElementById('login');

  setLoginError('');

  if (!username || !password) {
    setLoginError('Please enter username and password.');
    return;
  }

  button.disabled = true;
  button.textContent = 'Signing In...';

  requestBridge('LOGIN', {
    email: username,
    username: username,
    password: password
  });
});

document.getElementById('toggle').addEventListener('click', function () {
  const password = document.getElementById('password');

  if (password.type === 'password') {
    password.type = 'text';
    this.textContent = 'Hide';
  } else {
    password.type = 'password';
    this.textContent = 'Show';
  }
});

document.getElementById('refresh').addEventListener('click', loadDashboard);

function handleLoginResult(result) {
  const button = document.getElementById('login');

  if (!result || result.success !== true) {
    button.disabled = false;
    button.textContent = 'Sign In';

    setLoginError(
      result && result.message
        ? result.message
        : 'Invalid username or password.'
    );
    return;
  }

  button.disabled = false;
  button.textContent = 'Sign In';

  const user = result.user || {};

  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  document.getElementById('pname').textContent = user.name || 'Admin';
  document.getElementById('prole').textContent = user.role || 'Admin';
  document.getElementById('avatar').textContent =
    (user.name || 'A').charAt(0).toUpperCase();

  loadDashboard();
}

function loadDashboard() {
  const loading = document.getElementById('loading');
  if (loading) loading.classList.remove('hidden');

  requestBridge('DASHBOARD', {});
}

function handleDashboardResult(data) {
  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('hidden');

  if (!data || data.success === false) {
    console.error(
      data && data.message ? data.message : 'Dashboard request failed.'
    );
    return;
  }

  renderDashboard(data);
}

function renderDashboard(data) {
  document.getElementById('totalCustomers').textContent =
    data.totalCustomers ?? 0;

  document.getElementById('todayRegistration').textContent =
    data.todayRegistration ?? 0;

  document.getElementById('totalVehicles').textContent =
    data.totalVehicles ?? 0;

  document.getElementById('monthlyRegistration').textContent =
    data.monthlyRegistration ?? 0;

  const tbody = document.getElementById('recent');
  const rows = data.recentCustomers || [];

  if (!rows.length) {
    tbody.innerHTML =
      '<tr><td colspan="5">No customer records found.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(function (row) {
    return (
      '<tr>' +
      '<td>' + escapeHtml(row.id) + '</td>' +
      '<td>' + escapeHtml(row.name) + '</td>' +
      '<td>' + escapeHtml(row.vehicle) + '</td>' +
      '<td>' + escapeHtml(row.phone) + '</td>' +
      '<td>' + escapeHtml(row.date) + '</td>' +
      '</tr>'
    );
  }).join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
