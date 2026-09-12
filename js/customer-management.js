(() => {
    "use strict";

    /*
     * SP Tinted Manager - Customer Edit/Delete add-on.
     * Existing customer functions remain untouched.
     */

    const API_URL = "api/customer_management.php";

    const $ = (id) => document.getElementById(id);

    let currentCustomerId = 0;

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
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

    function confirmBox(title, message) {
        return new Promise((resolve) => {
            const overlay = document.createElement("div");

            overlay.className = "customer-confirm-overlay";
            overlay.innerHTML = `
                <div class="customer-confirm-box" role="dialog" aria-modal="true">
                    <button
                        class="customer-confirm-close"
                        type="button"
                        aria-label="Close"
                    >
                        ×
                    </button>

                    <div class="customer-confirm-icon">!</div>

                    <h3>${escapeHtml(title)}</h3>
                    <p>${escapeHtml(message)}</p>

                    <div class="customer-confirm-actions">
                        <button class="customer-confirm-no" type="button">
                            NO
                        </button>
                        <button class="customer-confirm-yes" type="button">
                            YES
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const finish = (value) => {
                overlay.remove();
                resolve(value);
            };

            overlay
                .querySelector(".customer-confirm-no")
                .addEventListener("click", () => finish(false));

            overlay
                .querySelector(".customer-confirm-yes")
                .addEventListener("click", () => finish(true));

            overlay
                .querySelector(".customer-confirm-close")
                .addEventListener("click", () => finish(false));

            overlay.addEventListener("click", (event) => {
                if (event.target === overlay) {
                    finish(false);
                }
            });
        });
    }

    function ensureModal() {
        if ($("customerEditModal")) {
            return;
        }

        const modal = document.createElement("div");

        modal.id = "customerEditModal";
        modal.className = "modal-overlay hidden";
        modal.innerHTML = `
            <div class="customer-edit-modal">
                <button
                    id="closeCustomerEdit"
                    class="modal-close"
                    type="button"
                    aria-label="Close"
                >
                    ×
                </button>

                <h3>Edit Customer</h3>
                <p>Update customer information.</p>

                <form id="customerEditForm" autocomplete="off">
                    <input id="customerEditId" type="hidden">

                    <div class="customer-edit-grid">
                        <div class="customer-edit-field">
                            <label for="customerEditCode">Customer ID</label>
                            <input id="customerEditCode" type="text" readonly>
                        </div>

                        <div class="customer-edit-field">
                            <label for="customerEditName">Customer Name</label>
                            <input id="customerEditName" type="text" maxlength="150" required>
                        </div>

                        <div class="customer-edit-field">
                            <label for="customerEditPhone">Phone</label>
                            <input id="customerEditPhone" type="text" maxlength="50" required>
                        </div>

                        <div class="customer-edit-field">
                            <label for="customerEditPlate">Car Plate</label>
                            <input id="customerEditPlate" type="text" maxlength="50" required>
                        </div>

                        <div class="customer-edit-field">
                            <label for="customerEditBrand">Brand</label>
                            <input id="customerEditBrand" type="text" maxlength="100" required>
                        </div>

                        <div class="customer-edit-field">
                            <label for="customerEditModel">Car Model</label>
                            <input id="customerEditModel" type="text" maxlength="100" required>
                        </div>

                        <div class="customer-edit-field">
                            <label for="customerEditType">Customer Type</label>
                            <input id="customerEditType" type="text" readonly>
                        </div>

                        <div class="customer-edit-field">
                            <label for="customerEditVisit">Visit</label>
                            <input id="customerEditVisit" type="text" readonly>
                        </div>

                        <div class="customer-edit-field customer-edit-full">
                            <label for="customerEditDate">Registration Date</label>
                            <input id="customerEditDate" type="text" readonly>
                        </div>
                    </div>

                    <div id="customerEditError" class="error"></div>

                    <div class="modal-actions">
                        <button
                            id="cancelCustomerEdit"
                            class="modal-cancel"
                            type="button"
                        >
                            Cancel
                        </button>

                        <button
                            id="saveCustomerEdit"
                            class="modal-danger"
                            type="submit"
                        >
                            SAVE
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        $("closeCustomerEdit").addEventListener(
            "click",
            closeEditModal
        );

        $("cancelCustomerEdit").addEventListener(
            "click",
            closeEditModal
        );

        modal.addEventListener("click", (event) => {
            if (event.target === modal) {
                closeEditModal();
            }
        });

        $("customerEditForm").addEventListener(
            "submit",
            saveCustomer
        );
    }

    function closeEditModal() {
        $("customerEditModal")?.classList.add("hidden");
        document.body.classList.remove("modal-open");
    }

    async function openEditCustomer(id) {
        ensureModal();

        currentCustomerId = Number(id) || 0;

        if (!currentCustomerId) {
            return;
        }

        $("customerEditError").textContent = "";

        try {
            const result = await api("get", {
                method: "POST",
                body: {
                    id: currentCustomerId
                }
            });

            const customer = result.data?.customer;

            if (!customer) {
                throw new Error("Customer record not found.");
            }

            $("customerEditId").value = customer.id || "";
            $("customerEditCode").value = customer.customer_code || "";
            $("customerEditName").value = customer.customer_name || "";
            $("customerEditPhone").value = customer.phone_number || "";
            $("customerEditPlate").value = customer.car_plate || "";
            $("customerEditBrand").value = customer.brand || "";
            $("customerEditModel").value = customer.car_model || "";
            $("customerEditType").value = customer.customer_type || "";
            $("customerEditVisit").value = customer.visit ?? "";
            $("customerEditDate").value = customer.registration_date || "";

            $("customerEditModal").classList.remove("hidden");
            document.body.classList.add("modal-open");

            $("customerEditName").focus();
        } catch (error) {
            alert(error.message || "Unable to load customer.");
        }
    }

    async function saveCustomer(event) {
        event.preventDefault();

        const confirmed = await confirmBox(
            "Confirm Update",
            "Are you sure you want to save these customer changes?"
        );

        if (!confirmed) {
            return;
        }

        const button = $("saveCustomerEdit");

        button.disabled = true;
        button.textContent = "SAVING...";

        $("customerEditError").textContent = "";

        try {
            await api("update", {
                method: "POST",
                body: {
                    id: currentCustomerId,
                    name: $("customerEditName").value.trim(),
                    phone: $("customerEditPhone").value.trim(),
                    plate: $("customerEditPlate").value.trim(),
                    brand: $("customerEditBrand").value.trim(),
                    model: $("customerEditModel").value.trim()
                }
            });

            closeEditModal();

            await refreshCustomerPage();
        } catch (error) {
            $("customerEditError").textContent =
                error.message || "Unable to update customer.";
        } finally {
            button.disabled = false;
            button.textContent = "SAVE";
        }
    }

    async function deleteCustomer(id, code, name) {
        const confirmed = await confirmBox(
            "Confirm Delete",
            `Delete ${code} - ${name}? This action cannot be undone.`
        );

        if (!confirmed) {
            return;
        }

        try {
            await api("delete", {
                method: "POST",
                body: {
                    id: Number(id)
                }
            });

            await refreshCustomerPage();
        } catch (error) {
            alert(error.message || "Unable to delete customer.");
        }
    }

    async function refreshCustomerPage() {
        const refreshButton = $("customerRefresh");

        if (refreshButton) {
            refreshButton.click();
            return;
        }

        window.location.reload();
    }

    function addActionButtons() {
        const rows = document.querySelectorAll("#customerRows tr");

        rows.forEach((row) => {
            if (row.dataset.customerActionsAdded === "1") {
                return;
            }

            const viewButton = row.querySelector(".view-btn");
            const actionCell = viewButton?.closest("td") || row.lastElementChild;

            if (!actionCell) {
                return;
            }

            let id = viewButton?.dataset?.id || "";

            if (!id) {
                id = row.dataset.customerId || "";
            }

            if (!id) {
                id = row.children[0]?.textContent?.trim() || "";
            }

            if (!id || !/^\d+$/.test(String(id))) {
                return;
            }

            row.dataset.customerActionsAdded = "1";

            if (!actionCell.querySelector(".customer-edit-btn")) {
                const editButton = document.createElement("button");

                editButton.className = "view-btn customer-edit-btn";
                editButton.type = "button";
                editButton.dataset.customerId = id;
                editButton.textContent = "Edit";

                actionCell.appendChild(editButton);
            }

            if (!actionCell.querySelector(".customer-delete-btn")) {
                const deleteButton = document.createElement("button");

                deleteButton.className = "view-btn customer-delete-btn";
                deleteButton.type = "button";
                deleteButton.dataset.customerId = id;
                deleteButton.textContent = "Delete";

                actionCell.appendChild(deleteButton);
            }
        });
    }

    function bindCustomerActionDelegation() {
        const tableBody = $("customerRows");

        if (!tableBody || tableBody.dataset.actionDelegation === "1") {
            return;
        }

        tableBody.dataset.actionDelegation = "1";

        tableBody.addEventListener("click", (event) => {
            const editButton =
                event.target.closest(".customer-edit-btn");

            if (editButton) {
                event.preventDefault();
                event.stopPropagation();

                openEditCustomer(editButton.dataset.customerId);
                return;
            }

            const deleteButton =
                event.target.closest(".customer-delete-btn");

            if (deleteButton) {
                event.preventDefault();
                event.stopPropagation();

                const row = deleteButton.closest("tr");
                const code =
                    row?.children[0]?.textContent.trim() || "Customer";
                const name =
                    row?.children[1]?.textContent.trim() || "Customer";

                deleteCustomer(
                    deleteButton.dataset.customerId,
                    code,
                    name
                );
            }
        });
    }

    function observeCustomerRows() {
        const tableBody = $("customerRows");

        if (!tableBody) {
            return false;
        }

        bindCustomerActionDelegation();
        addActionButtons();

        if (tableBody.dataset.customerObserver === "1") {
            return true;
        }

        tableBody.dataset.customerObserver = "1";

        const observer = new MutationObserver(() => {
            addActionButtons();
        });

        observer.observe(tableBody, {
            childList: true,
            subtree: true
        });

        return true;
    }

    function waitForCustomerRows() {
        if (observeCustomerRows()) {
            return;
        }

        let attempts = 0;

        const timer = window.setInterval(() => {
            attempts += 1;

            if (observeCustomerRows() || attempts >= 120) {
                window.clearInterval(timer);
            }
        }, 250);
    }

    function ensureStylesheet() {
        const href =
            "css/customer-management.css?v=20260912-customer-edit-delete-v8";

        if (
            document.querySelector(
                'link[data-sp-customer-management="1"]'
            )
        ) {
            return;
        }

        const link = document.createElement("link");

        link.rel = "stylesheet";
        link.href = href;
        link.dataset.spCustomerManagement = "1";

        document.head.appendChild(link);
    }

    /* ======================================================
       CUSTOMER VIEW - COPY DUPLICATE LOCK FIX
       ------------------------------------------------------
       Keep exactly ONE existing Copy button for:
       - Customer Name
       - Phone
       - Car Plate

       This removes only duplicate/stale copy controls that may
       have been injected by an older cached add-on. It does not
       change Customer View data, layout, Edit, Delete, Dashboard,
       User Management, Settings, or any API function.
       ====================================================== */

    function dedupeCustomerViewCopyButtons() {
        const modal = $("customerViewModal");

        if (!modal) {
            return;
        }

        const nameRow = modal.querySelector(".customer-view-name-row");

        if (nameRow) {
            const copyButtons = Array.from(
                nameRow.querySelectorAll(".copy-btn")
            );

            copyButtons.slice(1).forEach((button) => button.remove());

            nameRow.querySelectorAll(".customer-copy-btn").forEach((button) => {
                button.remove();
            });
        }

        const details = $("customerViewDetails");

        if (!details) {
            return;
        }

        details.querySelectorAll(".customer-view-value-row").forEach((row) => {
            const copyButtons = Array.from(
                row.querySelectorAll(".copy-btn")
            );

            copyButtons.slice(1).forEach((button) => button.remove());

            row.querySelectorAll(".customer-copy-btn").forEach((button) => {
                button.remove();
            });
        });

        details.querySelectorAll(".customer-copy-value-row").forEach((row) => {
            row.querySelectorAll(".customer-copy-btn").forEach((button) => {
                button.remove();
            });
        });
    }

    function observeCustomerViewCopyDuplicates() {
        const modal = $("customerViewModal");

        if (!modal) {
            return false;
        }

        dedupeCustomerViewCopyButtons();

        if (modal.dataset.customerCopyDedupeObserver === "1") {
            return true;
        }

        modal.dataset.customerCopyDedupeObserver = "1";

        const observer = new MutationObserver(() => {
            dedupeCustomerViewCopyButtons();
        });

        observer.observe(modal, {
            childList: true,
            subtree: true
        });

        return true;
    }

    function start() {
        ensureStylesheet();
        ensureModal();
        waitForCustomerRows();
        observeCustomerViewCopyDuplicates();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
