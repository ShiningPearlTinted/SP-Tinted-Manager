const WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycby5CKM9m24vhAYelEcLhdkyhgAcFxQewpF7os0HNbRubQyGst0f_xvsnYG2K5HtL_syzg/exec';

let callbackCounter = 0;

function callApi(action, params = {}, onSuccess, onError) {
  const callbackName = 'spTintedApiCallback_' + (++callbackCounter);
  const script = document.createElement('script');

  const query = new URLSearchParams({
    action,
    callback: callbackName,
    ...params
  });

  let completed = false;

  function cleanup() {
    if (script.parentNode) {
      script.parentNode.removeChild(script);
    }
    try {
      delete window[callbackName];
    } catch (e) {
      window[callbackName] = undefined;
    }
  }

  window[callbackName] = function (result) {
    if (completed) return;
    completed = true;
    cleanup();

    if (typeof onSuccess === 'function') {
      onSuccess(result);
    }
  };

  script.onerror = function () {
    if (completed) return;
    completed = true;
    cleanup();

    if (typeof onError === 'function') {
      onError('Unable to connect to SP Tinted Manager Web App.');
    }
  };

  script.src = WEB_APP_URL + '?' + query.toString();
  script.async = true;
  document.head.appendChild(script);
}

function setLoginError(message) {
  const error = document.getElementById('error');
  if (error) error.textContent = message || '';
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

  callApi(
    'login',
    {
      username: username,
      password: password
    },
    function (result) {
      button.disabled = false;
      button.textContent = 'Sign In';

      if (!result || result.success !== true) {
        setLoginError(
          result && result.message
            ? result.message
            : 'Invalid username or password.'
        );
        return;
      }

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
    },
    function (message) {
      button.disabled = false;
      button.textContent = 'Sign In';
      setLoginError(message);
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

function loadDashboard() {
  const loading = document.getElementById('loading');
  loading.classList.remove('hidden');

  callApi(
    'dashboard',
    {},
    function (result) {
      loading.classList.add('hidden');

      if (!result || result.success === false) {
        console.error(
          result && result.message
            ? result.message
            : 'Dashboard request failed.'
        );
        return;
      }

      renderDashboard(result);
    },
    function (message) {
      loading.classList.add('hidden');
      console.error(message);
    }
  );
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
