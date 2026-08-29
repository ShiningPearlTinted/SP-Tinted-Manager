const WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycby5CKM9m24vhAYelEcLhdkyhgAcFxQewpF7os0HNbRubQyGst0f_xvsnYG2K5HtL_syzg/exec';

let jsonpCounter = 0;

function setLoginError(message) {
  const error = document.getElementById('error');
  if (error) error.textContent = message || '';
}

/* Apps Script Web App connection using JSONP. */
function callWebApp(action, params, success, failure) {
  const callbackName =
    'spTintedCallback_' + Date.now() + '_' + (++jsonpCounter);

  const script = document.createElement('script');
  let finished = false;
  let timeout;

  const query = new URLSearchParams();
  query.set('action', action);
  query.set('callback', callbackName);
  query.set('_', String(Date.now()));

  Object.keys(params || {}).forEach(function (key) {
    query.set(key, params[key] == null ? '' : String(params[key]));
  });

  function cleanup() {
    if (timeout) clearTimeout(timeout);
    if (script.parentNode) script.parentNode.removeChild(script);

    try {
      delete window[callbackName];
    } catch (e) {
      window[callbackName] = undefined;
    }
  }

  function fail(message) {
    if (finished) return;

    finished = true;
    cleanup();

    if (typeof failure === 'function') {
      failure(message);
    }
  }

  window[callbackName] = function (result) {
    if (finished) return;

    finished = true;
    cleanup();

    if (typeof success === 'function') {
      success(result);
    }
  };

  script.onerror = function () {
    fail('Unable to connect to SP Tinted Manager Web App.');
  };

  timeout = setTimeout(function () {
    fail('Unable to connect to SP Tinted Manager Web App.');
  }, 15000);

  script.src = WEB_APP_URL + '?' + query.toString();
  script.async = true;
  document.head.appendChild(script);
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
