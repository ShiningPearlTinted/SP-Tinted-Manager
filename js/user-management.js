(() => {
    "use strict";

    const API = "api/user_management.php";
    const $ = (id) => document.getElementById(id);

    let currentPermissions = {
        dashboard: true,
        customer: true,
        invoice: true,
        user_management: true,
        settings: true
    };
    let isAdmin = false;
    let users = [];

    function esc(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    async function api(action, options = {}) {
        const res = await fetch(`${API}?action=${encodeURIComponent(action)}`, {
            method: options.method || "GET",
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                ...(options.body !== undefined ? { "Content-Type": "application/json" } : {})
            },
            body: options.body !== undefined ? JSON.stringify(options.body) : undefined
        });

        let data;
        try { data = await res.json(); } catch (_) { throw new Error(`Server returned HTTP ${res.status}.`); }
        if (!res.ok || !data || data.success !== true) throw new Error(data?.message || `Request failed (HTTP ${res.status}).`);
        return data;
    }

    function navByText(text) {
        return [...document.querySelectorAll(".sidebar .nav")].find((el) =>
            el.textContent.trim().toLowerCase().includes(text.toLowerCase())
        );
    }

    function applyPermissions() {
        const map = {
            dashboard: navByText("Dashboard"),
            customer: navByText("Customer"),
            invoice: navByText("Invoice"),
            user_management: navByText("User Management")
        };

        Object.entries(map).forEach(([key, el]) => {
            if (!el) return;
            el.style.display = (isAdmin || currentPermissions[key]) ? "flex" : "none";
        });

        const userNav = map.user_management;
        if (userNav) {
            userNav.style.display = isAdmin ? "flex" : "none";
        }
    }

    function ensurePage() {
        if ($("userManagementPage")) return $("userManagementPage");

        const page = document.createElement("section");
        page.id = "userManagementPage";
        page.className = "content page-content hidden um-page";
        page.innerHTML = `
            <div class="um-toolbar">
                <div>
                    <h3>User Management</h3>
                    <p>Manage system users and their access permissions.</p>
                </div>
                <button id="addUserBtn" class="customer-action" type="button">＋ Add User</button>
            </div>
            <div class="card um-panel">
                <div class="um-list-head">
                    <div><h3>Users</h3><small id="umResultInfo">Loading...</small></div>
                    <button id="umRefresh" class="customer-action" type="button">↻ Refresh</button>
                </div>
                <div class="tablewrap">
                    <table class="um-table">
                        <thead><tr><th>User ID</th><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Last Login</th><th>Action</th></tr></thead>
                        <tbody id="umRows"><tr><td colspan="7">Loading...</td></tr></tbody>
                    </table>
                </div>
            </div>
        `;
        document.querySelector(".app main")?.appendChild(page);

        const modal = document.createElement("div");
        modal.id = "userModal";
        modal.className = "modal-overlay hidden";
        modal.innerHTML = `
            <div class="um-modal">
                <button id="closeUserModal" class="modal-close" type="button">×</button>
                <h3 id="userModalTitle">Add User</h3>
                <p>Create or update a system user.</p>
                <form id="userForm" autocomplete="off">
                    <input id="umUserDbId" type="hidden">
                    <label>User ID</label><input id="umUserId" type="text" maxlength="50" required>
                    <label>Full Name</label><input id="umFullName" type="text" maxlength="150" required>
                    <label>Username</label><input id="umUsername" type="text" maxlength="100" required>
                    <label>Password <small id="umPasswordHint">Required for new user</small></label>
                    <input id="umPassword" type="password" minlength="8" autocomplete="new-password">
                    <label>Role</label>
                    <select id="umRole"><option value="User">User</option><option value="Admin">Admin</option><option value="Super Admin">Super Admin</option></select>
                    <label>Status</label>
                    <select id="umStatus"><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
                    <div class="um-permissions">
                        <h4>Permissions</h4>
                        <label class="um-check"><input id="permDashboard" type="checkbox"> Dashboard</label>
                        <label class="um-check"><input id="permCustomer" type="checkbox"> Customer</label>
                        <label class="um-check"><input id="permInvoice" type="checkbox"> Invoice</label>
                        <label class="um-check"><input id="permUserManagement" type="checkbox"> User Management</label>
                        <label class="um-check"><input id="permSettings" type="checkbox" checked disabled> Settings <small>(always available)</small></label>
                    </div>
                    <div id="umError" class="error"></div>
                    <div class="modal-actions"><button id="cancelUser" class="modal-cancel" type="button">Cancel</button><button id="saveUser" class="modal-danger" type="submit">Save User</button></div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        $("addUserBtn").addEventListener("click", () => openUserModal());
        $("umRefresh").addEventListener("click", loadUsers);
        $("closeUserModal").addEventListener("click", closeUserModal);
        $("cancelUser").addEventListener("click", closeUserModal);
        modal.addEventListener("click", (e) => { if (e.target === modal) closeUserModal(); });
        $("userForm").addEventListener("submit", saveUser);
        return page;
    }

    function hideUserPage() {
        $("userManagementPage")?.classList.add("hidden");
    }

    function showUserPage() {
        const page = ensurePage();
        $("dashboardPage")?.classList.add("hidden");
        $("customerPage")?.classList.add("hidden");
        page.classList.remove("hidden");
        document.querySelectorAll(".sidebar .nav").forEach((n) => n.classList.remove("active"));
        navByText("User Management")?.classList.add("active");
        $("pageTitle").textContent = "User Management";
        loadUsers();
    }

    function bindOtherNavigation() {
        ["Dashboard", "Customer", "Invoice", "Settings"].forEach((name) => {
            navByText(name)?.addEventListener("click", hideUserPage);
        });
    }

    async function loadUsers() {
        const body = $("umRows");
        if (!body) return;
        body.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
        try {
            const result = await api("list_users");
            users = result.data?.users || [];
            body.innerHTML = users.length ? users.map((u) => `
                <tr>
                    <td><b>${esc(u.user_id)}</b></td><td>${esc(u.full_name)}</td><td>${esc(u.username)}</td>
                    <td>${esc(u.role)}</td><td><span class="um-status ${String(u.status).toLowerCase()}">${esc(u.status)}</span></td>
                    <td>${esc(u.last_login_at || "Never")}</td><td><button class="view-btn um-edit" data-id="${esc(u.id)}" type="button">Edit</button></td>
                </tr>`).join("") : '<tr><td colspan="7">No users found.</td></tr>';
            body.querySelectorAll(".um-edit").forEach((b) => b.addEventListener("click", () => openUserModal(Number(b.dataset.id))));
            $("umResultInfo").textContent = `${users.length} user${users.length === 1 ? "" : "s"}`;
        } catch (e) {
            body.innerHTML = `<tr><td colspan="7">${esc(e.message)}</td></tr>`;
            $("umResultInfo").textContent = "Unable to load users.";
        }
    }

    function setPermissionInputs(p) {
        $("permDashboard").checked = !!p.dashboard;
        $("permCustomer").checked = !!p.customer;
        $("permInvoice").checked = !!p.invoice;
        $("permUserManagement").checked = !!p.user_management;
        $("permSettings").checked = true;
    }

    function openUserModal(id = 0) {
        const user = id ? users.find((u) => Number(u.id) === Number(id)) : null;
        $("userModalTitle").textContent = user ? "Edit User" : "Add User";
        $("umUserDbId").value = user?.id || "";
        $("umUserId").value = user?.user_id || "";
        $("umFullName").value = user?.full_name || "";
        $("umUsername").value = user?.username || "";
        $("umPassword").value = "";
        $("umPassword").required = !user;
        $("umPasswordHint").textContent = user ? "Leave blank to keep current password" : "Required for new user";
        $("umRole").value = user?.role || "User";
        $("umStatus").value = user?.status || "Active";
        setPermissionInputs(user?.permissions || {dashboard:false, customer:false, invoice:false, user_management:false});
        $("umError").textContent = "";
        $("userModal").classList.remove("hidden");
        document.body.classList.add("modal-open");
    }

    function closeUserModal() {
        $("userModal")?.classList.add("hidden");
        document.body.classList.remove("modal-open");
    }

    async function saveUser(e) {
        e.preventDefault();
        const id = Number($("umUserDbId").value || 0);
        const password = $("umPassword").value;
        if (!id && password.length < 8) { $("umError").textContent = "Password must be at least 8 characters."; return; }
        if (id && password && password.length < 8) { $("umError").textContent = "Password must be at least 8 characters."; return; }
        const btn = $("saveUser"); btn.disabled = true; btn.textContent = "Saving...";
        try {
            await api(id ? "edit_user" : "add_user", {
                method: "POST",
                body: {
                    id,
                    userId: $("umUserId").value.trim(),
                    fullName: $("umFullName").value.trim(),
                    username: $("umUsername").value.trim(),
                    password,
                    role: $("umRole").value,
                    status: $("umStatus").value,
                    permissions: {
                        dashboard: $("permDashboard").checked,
                        customer: $("permCustomer").checked,
                        invoice: $("permInvoice").checked,
                        user_management: $("permUserManagement").checked,
                        settings: true
                    }
                }
            });
            closeUserModal();
            await loadUsers();
        } catch (e2) {
            $("umError").textContent = e2.message || "Unable to save user.";
        } finally { btn.disabled = false; btn.textContent = "Save User"; }
    }

    async function init() {
        try {
            const result = await api("permissions");
            isAdmin = !!result.data?.isAdmin;
            currentPermissions = result.data?.permissions || currentPermissions;
            applyPermissions();
            const userNav = navByText("User Management");
            userNav?.addEventListener("click", (e) => { e.preventDefault(); showUserPage(); });
            bindOtherNavigation();
            if (isAdmin) ensurePage();
        } catch (e) {
            console.error("[SP] User permissions error:", e);
        }
    }

    init();
})();
