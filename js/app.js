(() => {
    "use strict";

    const API_URL = "api/index.php";

    const $ = (id) => document.getElementById(id);

    let loginBusy = false;
    let logoutBusy = false;
    let passwordBusy = false;
    let customerBusy = false;

    let customerPage = 1;
    let customerSearch = "";
    let customerTotalPages = 1;
    let recentLimit = 5;

    function setText(id, value) {
        const element = $(id);

        if (element) {
            element.textContent = value ?? "";
        }
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatDate(value) {
        if (!value) {
            return "";
        }

        const date = new Date(String(value).replace(" ", "T"));

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return `${date.toLocaleDateString("en-GB")} ${date.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit"
        })}`;
    }

    function setError(message) {
        const errorBox = $("error");

        if (errorBox) {
            errorBox.textContent = message || "";
        }
    }

    function showLoading(show, text = "Loading...") {
        const loading = $("loading");

        if (!loading) {
            return;
        }

        loading.classList.toggle("hidden", !show);

        const label = loading.querySelector("span");

        if (label) {
            label.textContent = text;
        }
    }

    async function api(action, options = {}) {
        const requestOptions = {
            method: options.method || "GET",
            credentials: "same-origin",
            headers: {
                Accept: "application/json"
            }
        };

        if (options.body !== undefined) {
            requestOptions.headers["Content-Type"] = "application/json";
            requestOptions.body = JSON.stringify(options.body);
        }

        const response = await fetch(
            `${API_URL}?action=${encodeURIComponent(action)}`,
            requestOptions
        );

        let data;

        try {
            data = await response.json();
        } catch (error) {
            throw new Error(`Server returned HTTP ${response.status}.`);
        }

        if (!response.ok || !data || data.success !== true) {
            throw new Error(
                data?.message || `Request failed (HTTP ${response.status}).`
            );
        }

        return data;
    }

    /* ======================================================
       LOGIN
       ====================================================== */

    $("toggle")?.addEventListener("click", () => {
        const input = $("password");
        const button = $("toggle");

        if (!input || !button) {
            return;
        }

        const visible = input.type === "text";

        input.type = visible ? "password" : "text";
        button.textContent = visible ? "Show" : "Hide";
    });

    $("loginForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (loginBusy) {
            return;
        }

        const username = $("email")?.value.trim() || "";
        const password = $("password")?.value || "";
        const loginButton = $("login");

        setError("");

        if (!username || !password) {
            setError("Please enter username and password.");
            return;
        }

        loginBusy = true;

        if (loginButton) {
            loginButton.disabled = true;
            loginButton.textContent = "Signing In...";
        }

        try {
            const result = await api("login", {
                method: "POST",
                body: {
                    username,
                    password
                }
            });

            sessionStorage.setItem(
                "sp_tinted_user",
                JSON.stringify(result.user)
            );

            showDashboard(result.user);
            await loadDashboard();
        } catch (error) {
            setError(error.message || "Login failed.");
        } finally {
            loginBusy = false;

            if (loginButton) {
                loginButton.disabled = false;
                loginButton.textContent = "Sign In";
            }
        }
    });

    async function checkSession() {
        try {
            const result = await api("session");

            if (result.user) {
                sessionStorage.setItem(
                    "sp_tinted_user",
                    JSON.stringify(result.user)
                );

                showDashboard(result.user);
                await loadDashboard();
            }
        } catch (error) {
            sessionStorage.removeItem("sp_tinted_user");
        }
    }

    function showDashboard(user) {
        $("loginScreen")?.classList.add("hidden");
        $("app")?.classList.remove("hidden");

        const name = user?.fullName || user?.name || "Admin";
        const role = user?.role || "User";

        setText("pname", name);
        setText("prole", role);
        setText("avatar", name.charAt(0).toUpperCase());
    }

    /* ======================================================
       MAIN DASHBOARD
       ====================================================== */

    async function loadDashboard() {
        showLoading(true, "Loading Dashboard...");

        try {
            const result = await api("dashboard", {
                method: "POST",
                body: {
                    recentLimit
                }
            });
            const data = result.data || {};

            setText("totalCustomers", data.totalCustomers || 0);
            setText("todayRegistration", data.todayRegistration || 0);
            setText("totalVehicles", data.totalVehicles || 0);
            setText("monthlyRegistration", data.monthlyRegistration || 0);

            const rows = data.recent || [];
            const tableBody = $("recent");

            if (!tableBody) {
                return;
            }

            if (!rows.length) {
                tableBody.innerHTML =
                    '<tr><td colspan="5">No customers found.</td></tr>';
                return;
            }

            tableBody.innerHTML = rows
                .map((row) => `
                    <tr>
                        <td>${escapeHtml(row.id)}</td>
                        <td>${escapeHtml(row.name)}</td>
                        <td>${escapeHtml(row.vehicle)}</td>
                        <td>${escapeHtml(row.phone)}</td>
                        <td>${escapeHtml(formatDate(row.date))}</td>
                    </tr>
                `)
                .join("");
        } catch (error) {
            console.error("[SP] Dashboard error:", error);
            setError(error.message || "Unable to load dashboard.");
        } finally {
            showLoading(false);
        }
    }

    /* ======================================================
       PAGE NAVIGATION
       ====================================================== */

    function setActivePage(page) {
        $("navDashboard")?.classList.toggle("active", page === "dashboard");
        $("navCustomer")?.classList.toggle("active", page === "customer");

        $("dashboardPage")?.classList.toggle("hidden", page !== "dashboard");
        $("customerPage")?.classList.toggle("hidden", page !== "customer");

        setText(
            "pageTitle",
            page === "customer" ? "Customer" : "Dashboard"
        );
    }

    $("navDashboard")?.addEventListener("click", () => {
        setActivePage("dashboard");
        loadDashboard();
    });

    $("navCustomer")?.addEventListener("click", () => {
        setActivePage("customer");
        loadCustomers(1);
    });

    $("recentLimit")?.addEventListener("change", () => {
        recentLimit = Number($("recentLimit").value) === 10 ? 10 : 5;
        loadDashboard();
    });

    $("refresh")?.addEventListener("click", () => {
        const customerPageVisible = !$("customerPage")?.classList.contains("hidden");

        if (customerPageVisible) {
            loadCustomers(customerPage);
        } else {
            loadDashboard();
        }
    });

    /* ======================================================
       CUSTOMER DASHBOARD
       ====================================================== */

    $("customerRefresh")?.addEventListener("click", () => {
        loadCustomers(customerPage);
    });

    $("customerSearchBtn")?.addEventListener("click", () => {
        customerSearch = $("customerSearch")?.value.trim() || "";
        loadCustomers(1);
    });

    $("customerSearch")?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
            return;
        }

        customerSearch = event.target.value.trim();
        loadCustomers(1);
    });

    $("customerPrev")?.addEventListener("click", () => {
        if (customerPage > 1) {
            loadCustomers(customerPage - 1);
        }
    });

    $("customerNext")?.addEventListener("click", () => {
        if (customerPage < customerTotalPages) {
            loadCustomers(customerPage + 1);
        }
    });

    async function loadCustomers(page = 1) {
        if (customerBusy) {
            return;
        }

        customerBusy = true;
        customerPage = page;

        setText("customerResultInfo", "Loading...");

        try {
            const result = await api("customer_dashboard", {
                method: "POST",
                body: {
                    page,
                    perPage: 20,
                    search: customerSearch
                }
            });

            const data = result.data || {};
            const stats = data.stats || {};
            const pagination = data.pagination || {};
            const rows = data.customers || [];

            setText("customerTotal", stats.total || 0);
            setText("customerNew", stats.new || 0);
            setText("customerReturning", stats.returning || 0);
            setText("customerVisits", stats.visits || 0);

            customerTotalPages = Number(pagination.totalPages) || 1;
            customerPage = Number(pagination.page) || page;

            setText(
                "customerPageInfo",
                `Page ${customerPage} of ${customerTotalPages}`
            );

            setText(
                "customerResultInfo",
                `${pagination.total || 0} customer records`
            );

            const tableBody = $("customerRows");

            if (!tableBody) {
                return;
            }

            if (!rows.length) {
                tableBody.innerHTML =
                    '<tr><td colspan="9">No customers found.</td></tr>';
                updatePaginationButtons();
                return;
            }

            tableBody.innerHTML = rows
                .map((row) => {
                    const type = String(row.type || "");
                    const typeClass = type.toLowerCase() === "returning"
                        ? "returning"
                        : "new";

                    return `
                        <tr>
                            <td><b>${escapeHtml(row.customerCode)}</b></td>
                            <td><b>${escapeHtml(row.name)}</b></td>
                            <td>${escapeHtml(row.phone)}</td>
                            <td>${escapeHtml(row.vehicle)}</td>
                            <td>${escapeHtml(row.plate)}</td>
                            <td>
                                <span class="type-badge ${typeClass}">
                                    ${escapeHtml(type)}
                                </span>
                            </td>
                            <td>${escapeHtml(row.visit)}</td>
                            <td>${escapeHtml(formatDate(row.registrationDate))}</td>
                            <td>
                                <button
                                    class="view-btn"
                                    type="button"
                                    data-id="${escapeHtml(row.id)}"
                                >
                                    View
                                </button>
                            </td>
                        </tr>
                    `;
                })
                .join("");

            tableBody.querySelectorAll(".view-btn").forEach((button) => {
                button.addEventListener("click", () => {
                    viewCustomer(button.dataset.id);
                });
            });

            updatePaginationButtons();
        } catch (error) {
            console.error("[SP] Customer dashboard error:", error);

            setText("customerResultInfo", error.message || "Unable to load customers.");

            const tableBody = $("customerRows");

            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9">${escapeHtml(error.message)}</td>
                    </tr>
                `;
            }

            updatePaginationButtons();
        } finally {
            customerBusy = false;
        }
    }

    function updatePaginationButtons() {
        const previous = $("customerPrev");
        const next = $("customerNext");

        if (previous) {
            previous.disabled = customerPage <= 1;
        }

        if (next) {
            next.disabled = customerPage >= customerTotalPages;
        }
    }

    async function viewCustomer(id) {
        try {
            const result = await api("customer_by_id", {
                method: "POST",
                body: {
                    id
                }
            });

            const customer = result.data || {};

            setText(
                "viewCustomerName",
                customer.customer_name || "Customer"
            );

            setText(
                "viewCustomerCode",
                customer.customer_code || ""
            );

            const details = $("customerViewDetails");

            if (details) {
                details.innerHTML = `
                    <div>
                        <span>Phone</span>
                        <div class="customer-view-value-row">
                            <b>${escapeHtml(customer.phone_number)}</b>
                            <button
                                class="copy-btn copy-field-btn"
                                type="button"
                                data-copy-value="${escapeHtml(customer.phone_number || "")}"
                                aria-label="Copy phone number"
                                title="Copy Phone"
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <rect x="9" y="9" width="11" height="11" rx="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div>
                        <span>Car Plate</span>
                        <div class="customer-view-value-row">
                            <b>${escapeHtml(customer.car_plate)}</b>
                            <button
                                class="copy-btn copy-field-btn"
                                type="button"
                                data-copy-value="${escapeHtml(customer.car_plate || "")}"
                                aria-label="Copy car plate"
                                title="Copy Car Plate"
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <rect x="9" y="9" width="11" height="11" rx="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div>
                        <span>Vehicle</span>
                        <b>${escapeHtml(
                            `${customer.brand || ""} ${customer.car_model || ""}`.trim()
                        )}</b>
                    </div>

                    <div>
                        <span>Customer Type</span>
                        <b>${escapeHtml(customer.customer_type)}</b>
                    </div>

                    <div>
                        <span>Visit</span>
                        <b>${escapeHtml(customer.visit)}</b>
                    </div>

                    <div>
                        <span>Registration</span>
                        <b>${escapeHtml(formatDate(customer.registration_date))}</b>
                    </div>
                `;
            }

            $("customerViewModal")?.classList.remove("hidden");
            document.body.classList.add("modal-open");
        } catch (error) {
            alert(error.message || "Unable to load customer.");
        }
    }

    function closeCustomerView() {
        $("customerViewModal")?.classList.add("hidden");
        document.body.classList.remove("modal-open");
    }

    $("copyCustomerName")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const value = $("viewCustomerName")?.textContent?.trim() || "";

        if (!value) {
            return;
        }

        try {
            await navigator.clipboard.writeText(value);
            button.classList.add("copied");

            setTimeout(() => {
                button.classList.remove("copied");
            }, 900);
        } catch (error) {
            console.error("Unable to copy customer name.", error);
        }
    });

    $("customerViewDetails")?.addEventListener("click", async (event) => {
        const button = event.target.closest(".copy-field-btn");

        if (!button) {
            return;
        }

        const value = button.dataset.copyValue || "";

        if (!value) {
            return;
        }

        try {
            await navigator.clipboard.writeText(value);
            button.classList.add("copied");

            setTimeout(() => {
                button.classList.remove("copied");
            }, 900);
        } catch (error) {
            console.error("Unable to copy customer field.", error);
        }
    });

    $("closeCustomerView")?.addEventListener("click", closeCustomerView);

    $("customerViewModal")?.addEventListener("click", (event) => {
        if (event.target === $("customerViewModal")) {
            closeCustomerView();
        }
    });

    /* ======================================================
       LOGOUT
       ====================================================== */

    const logoutModal = $("logoutModal");

    function closeLogout() {
        if (logoutBusy) {
            return;
        }

        logoutModal?.classList.add("hidden");
        document.body.classList.remove("modal-open");
    }

    $("logout")?.addEventListener("click", () => {
        logoutModal?.classList.remove("hidden");
        document.body.classList.add("modal-open");
    });

    $("closeLogout")?.addEventListener("click", closeLogout);
    $("cancelLogout")?.addEventListener("click", closeLogout);

    $("confirmLogout")?.addEventListener("click", async () => {
        if (logoutBusy) {
            return;
        }

        logoutBusy = true;

        const confirmButton = $("confirmLogout");
        const cancelButton = $("cancelLogout");
        const closeButton = $("closeLogout");

        if (confirmButton) {
            confirmButton.disabled = true;
            confirmButton.textContent = "Logging out...";
        }

        if (cancelButton) {
            cancelButton.disabled = true;
        }

        if (closeButton) {
            closeButton.disabled = true;
        }

        try {
            await api("logout", {
                method: "POST",
                body: {}
            });
        } catch (error) {
            console.error("[SP] Logout error:", error);
        } finally {
            sessionStorage.removeItem("sp_tinted_user");

            logoutModal?.classList.add("hidden");
            $("passwordModal")?.classList.add("hidden");
            $("customerViewModal")?.classList.add("hidden");
            document.body.classList.remove("modal-open");

            $("app")?.classList.add("hidden");
            $("loginScreen")?.classList.remove("hidden");

            if ($("password")) {
                $("password").value = "";
            }

            if ($("email")) {
                $("email").value = "";
            }

            setActivePage("dashboard");

            if (confirmButton) {
                confirmButton.disabled = false;
                confirmButton.textContent = "Logout";
            }

            if (cancelButton) {
                cancelButton.disabled = false;
            }

            if (closeButton) {
                closeButton.disabled = false;
            }

            logoutBusy = false;
        }
    });

    /* ======================================================
       SETTINGS / CHANGE PASSWORD
       ====================================================== */

    const settingsNav = $("settingsNav");
    const passwordModal = $("passwordModal");

    function closePassword() {
        if (passwordBusy) {
            return;
        }

        passwordModal?.classList.add("hidden");
        document.body.classList.remove("modal-open");

        $("passwordForm")?.reset();
        setText("passwordError", "");
        setText("passwordSuccess", "");
    }

    function openPassword() {
        if (passwordBusy) {
            return;
        }

        setText("passwordError", "");
        setText("passwordSuccess", "");
        $("passwordForm")?.reset();

        passwordModal?.classList.remove("hidden");
        document.body.classList.add("modal-open");
    }

    settingsNav?.addEventListener("click", openPassword);

    settingsNav?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPassword();
        }
    });

    $("closePassword")?.addEventListener("click", closePassword);
    $("cancelPassword")?.addEventListener("click", closePassword);

    passwordModal?.addEventListener("click", (event) => {
        if (event.target === passwordModal) {
            closePassword();
        }
    });

    document.querySelectorAll(".password-toggle").forEach((button) => {
        button.addEventListener("click", () => {
            const input = $(button.dataset.target);

            if (!input) {
                return;
            }

            const visible = input.type === "text";

            input.type = visible ? "password" : "text";
            button.textContent = visible ? "Show" : "Hide";
        });
    });

    $("passwordForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (passwordBusy) {
            return;
        }

        const currentPassword = $("currentPassword")?.value || "";
        const newPassword = $("newPassword")?.value || "";
        const confirmPassword = $("confirmPassword")?.value || "";

        setText("passwordError", "");
        setText("passwordSuccess", "");

        if (!currentPassword || !newPassword || !confirmPassword) {
            setText("passwordError", "Please complete all password fields.");
            return;
        }

        if (newPassword.length < 8) {
            setText(
                "passwordError",
                "New password must be at least 8 characters."
            );
            return;
        }

        if (newPassword !== confirmPassword) {
            setText(
                "passwordError",
                "New password and confirmation do not match."
            );
            return;
        }

        if (currentPassword === newPassword) {
            setText(
                "passwordError",
                "New password must be different from the current password."
            );
            return;
        }

        passwordBusy = true;

        const saveButton = $("savePassword");

        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = "Changing...";
        }

        try {
            await api("change_password", {
                method: "POST",
                body: {
                    currentPassword,
                    newPassword
                }
            });

            setText("passwordSuccess", "Password changed successfully.");

            $("currentPassword").value = "";
            $("newPassword").value = "";
            $("confirmPassword").value = "";

            setTimeout(() => {
                if (!passwordBusy) {
                    closePassword();
                }
            }, 900);
        } catch (error) {
            setText(
                "passwordError",
                error.message || "Unable to change password."
            );
        } finally {
            passwordBusy = false;

            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = "Change Password";
            }
        }
    });

    /* ======================================================
       MODAL KEYBOARD SUPPORT
       ====================================================== */

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") {
            return;
        }

        if (!logoutModal?.classList.contains("hidden")) {
            closeLogout();
            return;
        }

        if (!passwordModal?.classList.contains("hidden")) {
            closePassword();
            return;
        }

        if (!$("customerViewModal")?.classList.contains("hidden")) {
            closeCustomerView();
        }
    });

    /* ======================================================
       START APPLICATION
       ====================================================== */

    checkSession();
})();
