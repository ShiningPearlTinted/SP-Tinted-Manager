const WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbznBl50NeOWprixK5f1lcBKdNfQ2UEhhrWwxAW6dGcbylifpIr6upcVpPT3BEnczjqgtg/exec';

let bridgeReady = false;
let bridgeQueue = [];
let bridgeRequestId = 0;
let bridgeTimer = null;

function setLoginError(message) {
  const error = document.getElementById('error');
  if (error) error.textContent = message || '';
}

function getBridge() {
  return document.getElementById('bridge');
}

/*
 * LOCKED connection method:
 * GitHub Pages -> Apps Script Bridge iframe -> google.script.run
 *
 * This avoids the JSONP redirect problem seen with the Apps Script /exec URL.
 */
function initBridge() {
  const bridge = getBridge();
  if (!bridge) {
    console.error('SP Tinted Bridge iframe not found.');
    return;
  }

  bridge.src = WEB_APP_URL;

  window.addEventListener('message', function (event) {
    const message = event.data || {};

    if (message.source !== 'SP_TINTED_BRIDGE') return;

    if (message.type === 'READY') {
      bridgeReady = true;
      flushBridgeQueue();
      return;
    }

    if (message.type === 'LOGIN_RESULT') {
      finishBridgeRequest(message.payload);
      return;
    }

    if (message.type === 'DASHBOARD_RESULT') {
      finishBridgeRequest(message.payload);
      return;
    }

    if (message.type === 'ERROR') {
      failBridgeRequest(
        message.payload && message.payload.message
          ? message.payload.message
          : 'SP Tinted Manager Web App request failed.'
      );
    }
  });

  bridge.addEventListener('load', function () {
    // Bridge.html sends READY itself. This fallback only retries queued work.
    if (bridgeReady) flushBridgeQueue();
  });
}

function callWebApp(action, params, success, failure) {
  bridgeQueue.push({
    id: ++bridgeRequestId,
    action: action,
    params: params || {},
    success: success,
    failure: failure
  });

  flushBridgeQueue();
}

function flushBridgeQueue() {
  if (!bridgeReady || !bridgeQueue.length) return;

  const request = bridgeQueue.shift();
  const bridge = getBridge();

  if (!bridge || !bridge.contentWindow) {
    if (typeof request.failure === 'function') {
      request.failure('Unable to connect to SP Tinted Manager Web App.');
    }
    return;
  }

  window.__spTintedActiveRequest = request;

  clearTimeout(bridgeTimer);
  bridgeTimer = setTimeout(function () {
    if (window.__spTintedActiveRequest === request) {
      window.__spTintedActiveRequest = null;

      if (typeof request.failure === 'function') {
        request.failure('Unable to connect to SP Tinted Manager Web App.');
      }

      flushBridgeQueue();
    }
  }, 15000);

  bridge.contentWindow.postMessage(
    {
      source: 'SP_TINTED_APP',
      type: request.action === 'login' ? 'LOGIN' : 'DASHBOARD',
      username: request.params.username || '',
      password: request.params.password || ''
    },
    '*'
  );
}

function finishBridgeRequest(result) {
  const request = window.__spTintedActiveRequest;

  if (!request) return;

  window.__spTintedActiveRequest = null;
  clearTimeout(bridgeTimer);

  if (typeof request.success === 'function') {
    request.success(result);
  }

  setTimeout(flushBridgeQueue, 0);
}

function failBridgeRequest(message) {
  const request = window.__spTintedActiveRequest;

  if (!request) return;

  window.__spTintedActiveRequest = null;
  clearTimeout(bridgeTimer);

  if (typeof request.failure === 'function') {
    request.failure(message);
  }

  setTimeout(flushBridgeQueue, 0);
}

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

  callWebApp(
    'login',
    {
      username: username,
      password: password
    },
    handleLoginResult,
    function (message) {
      button.disabled = false;
      button.textContent = 'Sign In';

      setLoginError(
        message || 'Unable to connect to SP Tinted Manager Web App.'
      );
    }
  );
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

  document.getElementById('pname').textContent =
    user.name || 'Admin';

  document.getElementById('prole').textContent =
    user.role || 'Admin';

  document.getElementById('avatar').textContent =
    (user.name || 'A').charAt(0).toUpperCase();

  loadDashboard();
}

function loadDashboard() {
  const loading = document.getElementById('loading');

  if (loading) {
    loading.classList.remove('hidden');
  }

  callWebApp(
    'dashboard',
    {},
    handleDashboardResult,
    function (message) {
      if (loading) {
        loading.classList.add('hidden');
      }

      console.error(
        message || 'Dashboard request failed.'
      );
    }
  );
}

function handleDashboardResult(data) {
  const loading = document.getElementById('loading');

  if (loading) {
    loading.classList.add('hidden');
  }

  if (!data || data.success === false) {
    console.error(
      data && data.message
        ? data.message
        : 'Dashboard request failed.'
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

initBridge();
