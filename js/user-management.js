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
            if (!el) {
                return;
            }

            const visible = isAdmin || !!currentPermissions[key];
            el.style.display = visible ? "flex" : "none";
        });

        if (map.user_management) {
            map.user_management.style.display = isAdmin ? "flex" : "none";
        }
    }

    function setSidebarActive(name) {
        const target = navByText(name);

        document.querySelectorAll(".sidebar .nav").forEach((nav) => {
            nav.classList.remove("active");
        });

        target?.classList.add("active");
    }

    function syncNormalPageNavigation(name) {
        hideUserPage();
        setSidebarActive(name);
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
                        <thead>
                            <tr>
                                <th>User ID</th>
                                <th>Name</th>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Permissions</th>
                                <th>Last Login</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="umRows">
                            <tr>
                                <td colspan="8">Loading...</td>
                            </tr>
                        </tbody>
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
                    <div class="um-password-row">
                        <input id="umPassword" type="password" minlength="8" autocomplete="new-password">
                        <button id="umPasswordToggle" class="um-password-toggle" type="button">Show</button>
                    </div>
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

        const passwordInput = $("umPassword");
        const passwordToggle = $("umPasswordToggle");

        passwordToggle?.addEventListener("click", () => {
            const visible = passwordInput.type === "text";
            passwordInput.type = visible ? "password" : "text";
            passwordToggle.textContent = visible ? "Show" : "Hide";
        });

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
        setSidebarActive("User Management");
        $("pageTitle").textContent = "User Management";
        loadUsers();
    }

    function bindOtherNavigation() {
        ["Dashboard", "Customer", "Invoice", "Settings"].forEach((name) => {
            const nav = navByText(name);

            if (!nav) {
                return;
            }

            nav.addEventListener("click", () => {
                syncNormalPageNavigation(name);

                // app.js also manages the active class. Re-apply the correct
                // state after its click handler has finished.
                window.setTimeout(() => {
                    syncNormalPageNavigation(name);
                }, 0);
            }, true);
        });
    }

    function permissionTags(user) {
        if (user.role === "Admin" || user.role === "Super Admin") {
            return '<span class="um-permission-tag">All Access</span>';
        }

        const permissions = user.permissions || {};
        const names = [];

        if (permissions.dashboard) {
            names.push("Dashboard");
        }
        if (permissions.customer) {
            names.push("Customer");
        }
        if (permissions.invoice) {
            names.push("Invoice");
        }
        if (permissions.user_management) {
            names.push("User Management");
        }

        return names.length
            ? names.map((name) => `<span class="um-permission-tag">${esc(name)}</span>`).join("")
            : '<span class="um-permission-none">None</span>';
    }

    async function loadUsers() {
        const body = $("umRows");
        if (!body) return;
        body.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';
        try {
            const result = await api("list_users");
            users = result.data?.users || [];
            body.innerHTML = users.length ? users.map((u) => `
                <tr>
                    <td><b>${esc(u.user_id)}</b></td>
                    <td>${esc(u.full_name)}</td>
                    <td>${esc(u.username)}</td>
                    <td>${esc(u.role)}</td>
                    <td><span class="um-status ${String(u.status).toLowerCase()}">${esc(u.status)}</span></td>
                    <td><div class="um-permission-tags">${permissionTags(u)}</div></td>
                    <td>${esc(u.last_login_at || "Never")}</td>
                    <td><button class="view-btn um-edit" data-id="${esc(u.id)}" type="button">Edit</button></td>
                </tr>`).join("") : '<tr><td colspan="8">No users found.</td></tr>';
            body.querySelectorAll(".um-edit").forEach((b) => b.addEventListener("click", () => openUserModal(Number(b.dataset.id))));
            $("umResultInfo").textContent = `${users.length} user${users.length === 1 ? "" : "s"}`;
        } catch (e) {
            body.innerHTML = `<tr><td colspan="7">${esc(e.message)}</td></tr>`;
            $("umResultInfo").textContent = "Unable to load users.";
        }
    }

    function setPermissionInputs(p) {
        const permissions = p || {};

        $("permDashboard").checked = Boolean(permissions.dashboard);
        $("permCustomer").checked = Boolean(permissions.customer);
        $("permInvoice").checked = Boolean(permissions.invoice);
        $("permUserManagement").checked = Boolean(permissions.user_management);
        $("permSettings").checked = true;
    }

    async function getUserDetails(id) {
        const result = await api("get_user", {
            method: "POST",
            body: {
                id
            }
        });

        return result.data?.user || null;
    }

    async function openUserModal(id = 0) {
        let user = id ? users.find((u) => Number(u.id) === Number(id)) : null;

        $("userModalTitle").textContent = user ? "Edit User" : "Add User";
        $("umUserDbId").value = user?.id || "";
        $("umUserId").value = user?.user_id || "";
        $("umFullName").value = user?.full_name || "";
        $("umUsername").value = user?.username || "";
        $("umPassword").value = "";
        $("umPassword").required = !user;
        $("umPasswordHint").textContent = user
            ? "Enter a new password to replace the current password"
            : "Required for new user";
        $("umRole").value = user?.role || "User";
        $("umStatus").value = user?.status || "Active";
        setPermissionInputs(user?.permissions);
        $("umError").textContent = "";

        $("userModal").classList.remove("hidden");
        document.body.classList.add("modal-open");

        if (!id) {
            setPermissionInputs({
                dashboard: false,
                customer: false,
                invoice: false,
                user_management: false,
                settings: true
            });
            return;
        }

        try {
            const freshUser = await getUserDetails(id);

            if (!freshUser) {
                throw new Error("User details could not be loaded.");
            }

            user = freshUser;
            $("umUserDbId").value = user.id || "";
            $("umUserId").value = user.user_id || "";
            $("umFullName").value = user.full_name || "";
            $("umUsername").value = user.username || "";
            $("umRole").value = user.role || "User";
            $("umStatus").value = user.status || "Active";
            $("umPassword").value = "";
            $("umPassword").required = false;
            $("umPasswordHint").textContent = "Enter a new password to replace the current password";
            setPermissionInputs(user.permissions);
        } catch (error) {
            $("umError").textContent = error.message || "Unable to load user permissions.";
        }
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
            userNav?.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                showUserPage();
            }, true);
            bindOtherNavigation();
            if (isAdmin) ensurePage();
        } catch (e) {
            console.error("[SP] User permissions error:", e);
        }
    }

    init();
})();
