const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycby5CKM9m24vhAYelEcLhdkyhgAcFxQewpF7os0HNbRubQyGst0f_xvsnYG2K5HtL_syzg/exec";

const bridge = document.getElementById("bridge");

let bridgeReady = false;


// ======================================================
// SHOW STATUS
// ======================================================

function setConnectionStatus(message, isError = false) {

  const status =
    document.getElementById("connectionStatus");

  if (!status) return;

  status.textContent = message;

  status.style.color =
    isError ? "#ff4d5a" : "#7f9bc0";
}


// ======================================================
// RECEIVE MESSAGE FROM APPS SCRIPT BRIDGE
// ======================================================

window.addEventListener("message", function (event) {

  const message = event.data || {};

  // IMPORTANT:
  // Do NOT check event.source here.
  // Apps Script HtmlService uses a sandboxed iframe.

  if (message.source !== "SP_TINTED_BRIDGE") {
    return;
  }


  // ====================================================
  // BRIDGE READY
  // ====================================================

  if (message.type === "READY") {

    bridgeReady = true;

    setConnectionStatus("");

    console.log(
      "SP Tinted Manager Web App connected."
    );

    return;
  }


  // ====================================================
  // LOGIN RESULT
  // ====================================================

  if (message.type === "LOGIN_RESULT") {

    const payload = message.payload || {};
    const result = payload.result || {};

    console.log(
      "Login response:",
      result
    );

    handleLoginResult(result);

    return;
  }


  // ====================================================
  // DASHBOARD RESULT
  // ====================================================

  if (message.type === "DASHBOARD_RESULT") {

    const payload = message.payload || {};
    const result = payload.result || {};

    console.log(
      "Dashboard response:",
      result
    );

    handleDashboardResult(result);

    return;
  }


  // ====================================================
  // ERROR
  // ====================================================

  if (message.type === "ERROR") {

    const payload = message.payload || {};

    console.error(
      "Apps Script error:",
      payload.message
    );

    setConnectionStatus(
      payload.message || "Connection error.",
      true
    );

  }

});


// ======================================================
// LOAD APPS SCRIPT BRIDGE
// ======================================================

if (bridge) {

  bridge.src = WEB_APP_URL;

  bridge.addEventListener("load", function () {

    console.log(
      "Apps Script bridge iframe loaded."
    );

  });

}


// ======================================================
// WAIT FOR BRIDGE
// ======================================================

setConnectionStatus(
  "Connecting to SP Tinted Manager Web App..."
);


// ======================================================
// LOGIN
// ======================================================

function login(username, password) {

  if (!bridgeReady) {

    setConnectionStatus(
      "SP Tinted Manager Web App is not ready.",
      true
    );

    console.error(
      "Login blocked: bridge is not ready."
    );

    return;
  }


  const requestId =
    "login_" +
    Date.now();


  console.log(
    "Sending login request:",
    username
  );


  bridge.contentWindow.postMessage(
    {
      source: "SP_TINTED_APP",
      type: "LOGIN",
      payload: {
        requestId: requestId,
        username: username,
        password: password
      }
    },
    "*"
  );

}


// ======================================================
// DASHBOARD
// ======================================================

function loadDashboard() {

  if (!bridgeReady) {

    console.error(
      "Dashboard blocked: bridge is not ready."
    );

    return;
  }


  const requestId =
    "dashboard_" +
    Date.now();


  bridge.contentWindow.postMessage(
    {
      source: "SP_TINTED_APP",
      type: "DASHBOARD",
      payload: {
        requestId: requestId
      }
    },
    "*"
  );

}


// ======================================================
// LOGIN RESULT HANDLER
// ======================================================

function handleLoginResult(result) {

  if (!result) {

    setConnectionStatus(
      "Invalid response from Web App.",
      true
    );

    return;
  }


  if (result.success) {

    console.log(
      "LOGIN SUCCESS",
      result.user
    );


    // Save logged-in user
    sessionStorage.setItem(
      "sp_tinted_user",
      JSON.stringify(result.user)
    );


    // Continue to dashboard
    if (
      typeof showDashboard === "function"
    ) {

      showDashboard(result.user);

    } else {

      window.location.href =
        "dashboard.html";

    }

    return;
  }


  setConnectionStatus(
    result.message || "Invalid username or password.",
    true
  );

}


// ======================================================
// DASHBOARD RESULT HANDLER
// ======================================================

function handleDashboardResult(result) {

  if (!result) {

    console.error(
      "Empty dashboard response."
    );

    return;
  }


  if (!result.success) {

    console.error(
      result.message
    );

    return;
  }


  console.log(
    "Dashboard data:",
    result
  );


  if (
    typeof renderDashboard === "function"
  ) {

    renderDashboard(result);

  }

}
