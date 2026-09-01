/**
 * =========================================================
 * SP TINTED MANAGER
 * GitHub Pages
 *
 * Connection:
 *
 * GitHub
 *    ↓
 * Apps Script Bridge
 *    ↓
 * Google Apps Script
 *    ↓
 * Google Sheets
 *
 * IMPORTANT:
 * Jangan gunakan fetch()
 * Jangan gunakan JSONP
 * =========================================================
 */


/**
 * =========================================================
 * APPS SCRIPT WEB APP
 * =========================================================
 */
const WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycby5CKM9m24vhAYelEcLhdkyhgAcFxQewpF7os0HNbRubQyGst0f_xvsnYG2K5HtL_syzg/exec';


/**
 * =========================================================
 * BRIDGE
 * =========================================================
 */
const bridge =
  document.getElementById('bridge');


let bridgeReady = false;

let requestCounter = 0;

const pendingRequests = new Map();


/**
 * =========================================================
 * LOGIN ERROR
 * =========================================================
 */
function setLoginError(message) {

  const error =
    document.getElementById('error');


  if (error) {

    error.textContent =
      message || '';

  }

}


/**
 * =========================================================
 * SEND REQUEST TO APPS SCRIPT BRIDGE
 * =========================================================
 */
function sendToBridge(
  type,
  payload
) {

  if (
    !bridge ||
    !bridge.contentWindow
  ) {

    throw new Error(
      'Apps Script bridge is not available.'
    );

  }


  bridge.contentWindow.postMessage(

    {

      source:
        'SP_TINTED_APP',

      type:
        type,

      payload:
        payload || {}

    },

    '*'

  );

}


/**
 * =========================================================
 * API REQUEST
 * =========================================================
 */
function requestApi(
  type,
  payload,
  timeoutMs
) {

  timeoutMs =
    timeoutMs || 20000;


  return new Promise(
    function (resolve, reject) {

      /*
       * Bridge belum ready
       */
      if (!bridgeReady) {

        reject(
          new Error(
            'Waiting for SP Tinted Manager connection...'
          )
        );

        return;
      }


      /*
       * Request ID
       */
      requestCounter++;


      const requestId =
        'req_' +
        requestCounter;


      /*
       * Timeout
       */
      const timer =
        setTimeout(
          function () {

            pendingRequests.delete(
              requestId
            );


            reject(
              new Error(
                'SP Tinted Manager connection timed out.'
              )
            );

          },
          timeoutMs
        );


      /*
       * Store request
       */
      pendingRequests.set(
        requestId,
        {

          resolve:
            function (result) {

              clearTimeout(timer);

              resolve(result);

            },

          reject:
            function (error) {

              clearTimeout(timer);

              reject(error);

            }

        }
      );


      /*
       * Send to Bridge
       */
      sendToBridge(
        type,
        {

          requestId:
            requestId,

          ...payload

        }
      );

    }
  );

}


/**
 * =========================================================
 * RECEIVE MESSAGE FROM APPS SCRIPT BRIDGE
 * =========================================================
 */
window.addEventListener(
  'message',
  function (event) {

    const message =
      event.data || {};


    /*
     * Only accept our Bridge
     */
    if (
      bridge &&
      event.source !==
        bridge.contentWindow
    ) {

      return;
    }


    /*
     * Ignore other messages
     */
    if (
      message.source !==
      'SP_TINTED_BRIDGE'
    ) {

      return;
    }


    /**
     * =====================================================
     * BRIDGE READY
     * =====================================================
     */
    if (
      message.type === 'READY'
    ) {

      bridgeReady = true;

      console.log(
        'SP Tinted Manager Bridge READY'
      );

      return;
    }


    /*
     * Response payload
     */
    const payload =
      message.payload || {};


    const requestId =
      payload.requestId;


    /*
     * Ignore unknown request
     */
    if (
      !requestId ||
      !pendingRequests.has(
        requestId
      )
    ) {

      return;
    }


    const request =
      pendingRequests.get(
        requestId
      );


    pendingRequests.delete(
      requestId
    );


    /**
     * =====================================================
     * ERROR
     * =====================================================
     */
    if (
      message.type === 'ERROR'
    ) {

      const errorMessage =
        payload.result &&
        payload.result.message
          ? payload.result.message
          : 'Apps Script request failed.';


      request.reject(
        new Error(
          errorMessage
        )
      );


      return;
    }


    /**
     * =====================================================
     * SUCCESS
     * =====================================================
     */
    request.resolve(
      payload.result
    );

  }
);


/**
 * =========================================================
 * BRIDGE LOAD
 * =========================================================
 */
bridge.addEventListener(
  'load',
  function () {

    console.log(
      'SP Tinted Manager Apps Script Bridge loaded.'
    );

  }
);


/**
 * =========================================================
 * LOGIN FORM
 * =========================================================
 */
document
  .getElementById('loginForm')
  .addEventListener(
    'submit',
    async function (event) {

      event.preventDefault();


      const username =
        document
          .getElementById('email')
          .value
          .trim();


      const password =
        document
          .getElementById('password')
          .value;


      const button =
        document
          .getElementById('login');


      setLoginError('');


      /*
       * Validation
       */
      if (
        !username ||
        !password
      ) {

        setLoginError(
          'Please enter username and password.'
        );

        return;
      }


      /*
       * Bridge not ready
       */
      if (!bridgeReady) {

        setLoginError(
          'Connecting to SP Tinted Manager Web App...'
        );

        return;
      }


      /*
       * Loading
       */
      button.disabled = true;

      button.textContent =
        'Signing In...';


      try {

        /**
         * ===============================================
         * LOGIN REQUEST
         * ===============================================
         */
        const result =
          await requestApi(
            'LOGIN',
            {

              username:
                username,

              password:
                password

            }
          );


        /*
         * Login failed
         */
        if (
          !result ||
          result.success !== true
        ) {

          setLoginError(

            result &&
            result.message

              ? result.message

              : 'Invalid username or password.'

          );

          return;
        }


        /**
         * ===============================================
         * LOGIN SUCCESS
         * ===============================================
         */
        const user =
          result.user || {};


        document
          .getElementById(
            'loginScreen'
          )
          .classList
          .add('hidden');


        document
          .getElementById(
            'app'
          )
          .classList
          .remove('hidden');


        /*
         * User name
         */
        document
          .getElementById(
            'pname'
          )
          .textContent =
            user.name || 'Admin';


        /*
         * Role
         */
        document
          .getElementById(
            'prole'
          )
          .textContent =
            user.role || 'Admin';


        /*
         * Avatar
         */
        document
          .getElementById(
            'avatar'
          )
          .textContent =

            (
              user.name ||
              'A'
            )
              .charAt(0)
              .toUpperCase();


        /**
         * ===============================================
         * LOAD DASHBOARD
         * ===============================================
         */
        loadDashboard();

      }

      catch (error) {

        console.error(
          'LOGIN ERROR:',
          error
        );


        setLoginError(

          error &&
          error.message

            ? error.message

            : 'Unable to connect to SP Tinted Manager Web App.'

        );

      }

      finally {

        button.disabled =
          false;

        button.textContent =
          'Sign In';

      }

    }
  );


/**
 * =========================================================
 * SHOW / HIDE PASSWORD
 * =========================================================
 */
document
  .getElementById('toggle')
  .addEventListener(
    'click',
    function () {

      const password =
        document.getElementById(
          'password'
        );


      if (
        password.type ===
        'password'
      ) {

        password.type =
          'text';

        this.textContent =
          'Hide';

      }

      else {

        password.type =
          'password';

        this.textContent =
          'Show';

      }

    }
  );


/**
 * =========================================================
 * REFRESH DASHBOARD
 * =========================================================
 */
document
  .getElementById('refresh')
  .addEventListener(
    'click',
    loadDashboard
  );


/**
 * =========================================================
 * LOAD DASHBOARD
 * =========================================================
 */
async function loadDashboard() {

  const loading =
    document.getElementById(
      'loading'
    );


  loading
    .classList
    .remove('hidden');


  try {

    const result =
      await requestApi(
        'DASHBOARD',
        {}
      );


    /*
     * Dashboard error
     */
    if (
      !result ||
      result.success === false
    ) {

      console.error(
        result &&
        result.message
          ? result.message
          : 'Dashboard request failed.'
      );

      return;
    }


    /*
     * Render
     */
    renderDashboard(
      result
    );

  }

  catch (error) {

    console.error(
      'DASHBOARD ERROR:',
      error
    );

  }

  finally {

    loading
      .classList
      .add('hidden');

  }

}


/**
 * =========================================================
 * RENDER DASHBOARD
 * =========================================================
 */
function renderDashboard(
  data
) {

  document
    .getElementById(
      'totalCustomers'
    )
    .textContent =
      data.totalCustomers ?? 0;


  document
    .getElementById(
      'todayRegistration'
    )
    .textContent =
      data.todayRegistration ?? 0;


  document
    .getElementById(
      'totalVehicles'
    )
    .textContent =
      data.totalVehicles ?? 0;


  document
    .getElementById(
      'monthlyRegistration'
    )
    .textContent =
      data.monthlyRegistration ?? 0;


  const tbody =
    document.getElementById(
      'recent'
    );


  const rows =
    data.recentCustomers || [];


  /*
   * No records
   */
  if (!rows.length) {

    tbody.innerHTML =
      '<tr>' +
      '<td colspan="5">' +
      'No customer records found.' +
      '</td>' +
      '</tr>';

    return;
  }


  /*
   * Customer rows
   */
  tbody.innerHTML =
    rows
      .map(
        function (row) {

          return (

            '<tr>' +

            '<td>' +
            escapeHtml(row.id) +
            '</td>' +

            '<td>' +
            escapeHtml(row.name) +
            '</td>' +

            '<td>' +
            escapeHtml(row.vehicle) +
            '</td>' +

            '<td>' +
            escapeHtml(row.phone) +
            '</td>' +

            '<td>' +
            escapeHtml(row.date) +
            '</td>' +

            '</tr>'

          );

        }
      )
      .join('');

}


/**
 * =========================================================
 * HTML ESCAPE
 * =========================================================
 */
function escapeHtml(
  value
) {

  return String(
    value ?? ''
  )

    .replace(
      /&/g,
      '&amp;'
    )

    .replace(
      /</g,
      '&lt;'
    )

    .replace(
      />/g,
      '&gt;'
    )

    .replace(
      /"/g,
      '&quot;'
    )

    .replace(
      /'/g,
      '&#039;'
    );

}
