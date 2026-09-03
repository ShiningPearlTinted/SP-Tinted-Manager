(() => {
  "use strict";

  // =========================================================
  // ONE BACKEND URL
  // =========================================================
  const WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbznBl50NeOWprixK5f1lcBKdNfQ2UEhhrWwxAW6dGcbylifpIr6upcVpPT3BEnczjqgtg/exec";

  const bridge = document.getElementById("bridge");
  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const toggleButton = document.getElementById("toggle");
  const errorBox = document.getElementById("error");
  const loginButton = document.getElementById("login");
  const loading = document.getElementById("loading");

  let bridgeReady = false;
  let loginBusy = false;

  // ---------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------
  function setError(message) {
    if (errorBox) errorBox.textContent = message || "";
  }

  function showLoading(show, text) {
    if (!loading) return;
    loading.classList.toggle("hidden", !show);
    const span = loading.querySelector("span");
    if (span && text) span.textContent = text;
  }

  function setLoginBusy(busy) {
    loginBusy = busy;
    if (loginButton) {
      loginButton.disabled = busy;
      loginButton.textContent = busy ? "Signing In..." : "Sign In";
    }
  }

  function postToBridge(type, payload) {
    if (!bridge || !bridge.contentWindow) {
      throw new Error("Apps Script bridge is unavailable.");
    }

    bridge.contentWindow.postMessage({
      source: "SP_TINTED_APP",
      type,
      payload: payload || {}
    }, "*");
  }

  // ---------------------------------------------------------
  // IMPORTANT: receive messages without checking event.source.
  // Apps Script HtmlService uses nested sandboxed frames.
  // ---------------------------------------------------------
  window.addEventListener("message", (event) => {
    const message = event.data || {};

    if (message.source !== "SP_TINTED_BRIDGE") return;

    if (message.type === "READY") {
      bridgeReady = true;
      setError("");
      console.log("[SP] Apps Script bridge READY.");
      return;
    }

    if (message.type === "LOGIN_RESULT") {
      const result = (message.payload || {}).result || {};
      handleLoginResult(result);
      return;
    }

    if (message.type === "DASHBOARD_RESULT") {
      const result = (message.payload || {}).result || {};
      handleDashboardResult(result);
      return;
    }

    if (message.type === "ERROR") {
      const payload = message.payload || {};
      setLoginBusy(false);
      showLoading(false);
      setError(payload.message || "Apps Script request failed.");
      console.error("[SP] Apps Script error:", payload.message);
    }
  });

  // ---------------------------------------------------------
  // Load bridge only AFTER message listener exists.
  // ---------------------------------------------------------
  if (bridge) {
    bridge.src = WEB_APP_URL;
    bridge.addEventListener("load", () => {
      console.log("[SP] Bridge iframe load event.");
    });
  }

  // ---------------------------------------------------------
  // Login form
  // ---------------------------------------------------------
  if (toggleButton && passwordInput) {
    toggleButton.addEventListener("click", () => {
      const visible = passwordInput.type === "text";
      passwordInput.type = visible ? "password" : "text";
      toggleButton.textContent = visible ? "Show" : "Hide";
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();

      if (loginBusy) return;

      const username = (usernameInput.value || "").trim();
      const password = passwordInput.value || "";

      setError("");

      if (!username || !password) {
        setError("Please enter username and password.");
        return;
      }

      if (!bridgeReady) {
        setError("Connecting to SP Tinted Manager Web App...");
        console.error("[SP] Bridge is not ready.");
        return;
      }

      login(username, password);
    });
  }

  // ---------------------------------------------------------
  // Login request
  // ---------------------------------------------------------
  function login(username, password) {
    setLoginBusy(true);
    setError("");

    postToBridge("LOGIN", {
      requestId: "login_" + Date.now(),
      username,
      password
    });
  }

  // ---------------------------------------------------------
  // Login response
  // ---------------------------------------------------------
  function handleLoginResult(result) {
    setLoginBusy(false);

    if (!result || result.success !== true) {
      setError(
        (result && result.message) ||
        "Invalid username or password."
      );
      return;
    }

    console.log("[SP] LOGIN SUCCESS:", result.user);

    sessionStorage.setItem(
      "sp_tinted_user",
      JSON.stringify(result.user)
    );

    showDashboard(result.user);
    loadDashboard();
  }

  // ---------------------------------------------------------
  // Show dashboard
  // ---------------------------------------------------------
  function showDashboard(user) {
    document.getElementById("loginScreen")?.classList.add("hidden");
    document.getElementById("app")?.classList.remove("hidden");

    const name = user?.name || "Admin";
    const role = user?.role || "User";

    const pname = document.getElementById("pname");
    const prole = document.getElementById("prole");
    const avatar = document.getElementById("avatar");

    if (pname) pname.textContent = name;
    if (prole) prole.textContent = role;
    if (avatar) avatar.textContent =
      name.charAt(0).toUpperCase();
  }

  // ---------------------------------------------------------
  // Dashboard request
  // ---------------------------------------------------------
  function loadDashboard() {
    if (!bridgeReady) return;

    showLoading(true, "Loading Dashboard...");

    postToBridge("DASHBOARD", {
      requestId: "dashboard_" + Date.now()
    });
  }

  // ---------------------------------------------------------
  // Dashboard response
  // ---------------------------------------------------------
  function handleDashboardResult(result) {
    showLoading(false);

    if (!result || result.success !== true) {
      console.error(
        "[SP] Dashboard error:",
        result?.message
      );
      return;
    }

    renderDashboard(result);
  }

  function renderDashboard(data) {
    const dashboard = data.dashboard || data;

    setText(
      "totalCustomers",
      dashboard.totalCustomers ?? 0
    );

    setText(
      "todayRegistration",
      dashboard.todayRegistration ?? 0
    );

    setText(
      "totalVehicles",
      dashboard.totalVehicles ?? 0
    );

    setText(
      "monthlyRegistration",
      dashboard.monthlyRegistration ?? 0
    );

    const tbody = document.getElementById("recent");
    if (!tbody) return;

    const rows = Array.isArray(dashboard.recentCustomers)
      ? dashboard.recentCustomers
      : [];

    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="5">No customers found.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(row => `
      <tr>
        <td>${escapeHtml(row.id)}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.vehicle)}</td>
        <td>${escapeHtml(row.phone)}</td>
        <td>${escapeHtml(row.date)}</td>
      </tr>
    `).join("");
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------------------------------------------------------
  // Refresh
  // ---------------------------------------------------------
  document.getElementById("refresh")?.addEventListener(
    "click",
    loadDashboard
  );

  // ---------------------------------------------------------
  // Existing session
  // ---------------------------------------------------------
  try {
    const saved = sessionStorage.getItem("sp_tinted_user");
    if (saved) {
      const user = JSON.parse(saved);
      if (user && user.username) {
        showDashboard(user);
        // Wait for bridge READY, then request dashboard.
        const timer = setInterval(() => {
          if (!bridgeReady) return;
          clearInterval(timer);
          loadDashboard();
        }, 100);
      }
    }
  } catch (e) {
    sessionStorage.removeItem("sp_tinted_user");
  }

})();
