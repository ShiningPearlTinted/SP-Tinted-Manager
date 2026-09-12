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

                editButton.className = "customer-edit-btn";
                editButton.type = "button";
                editButton.dataset.customerId = id;
                editButton.textContent = "Edit";

                actionCell.appendChild(editButton);
            }

            if (!actionCell.querySelector(".customer-delete-btn")) {
                const deleteButton = document.createElement("button");

                deleteButton.className = "customer-delete-btn";
                deleteButton.type = "button";
                deleteButton.dataset.customerId = id;
                deleteButton.textContent = "Delete";

                actionCell.appendChild(deleteButton);
            }
        });
    }

    function bindCustomerActionDelegation() {
        if (document.documentElement.dataset.customerActionsBound === "1") {
            return;
        }

        document.documentElement.dataset.customerActionsBound = "1";

        document.addEventListener(
            "click",
            (event) => {
                const editButton = event.target.closest(
                    ".customer-edit-btn"
                );

                if (editButton) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();

                    openEditCustomer(
                        editButton.dataset.customerId
                    );

                    return;
                }

                const deleteButton = event.target.closest(
                    ".customer-delete-btn"
                );

                if (!deleteButton) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                const row = deleteButton.closest("tr");
                const code =
                    row?.children[0]?.textContent?.trim() || "Customer";
                const name =
                    row?.children[1]?.textContent?.trim() || "Customer";

                deleteCustomer(
                    deleteButton.dataset.customerId,
                    code,
                    name
                );
            },
            true
        );
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
            "css/customer-management.css?v=20260912-customer-edit-delete-v9-lock";

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


    function ensureCustomerEditDeleteStyles() {
        if (document.getElementById("spCustomerEditDeleteInlineStyles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "spCustomerEditDeleteInlineStyles";
        style.textContent = `
            .customer-edit-modal {
                width: min(760px, calc(100vw - 32px));
                max-height: calc(100vh - 32px);
                overflow-y: auto;
                padding: 26px;
                border: 1px solid #344154;
                border-radius: 18px;
                background: #1b2430;
                color: #f8fafc;
                box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
                box-sizing: border-box;
            }

            .customer-edit-modal h3 {
                margin: 0 0 6px;
                font-size: 22px;
                font-weight: 800;
            }

            .customer-edit-modal > p {
                margin: 0 0 22px;
                color: #91a4bf;
                font-size: 13px;
            }

            .customer-edit-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 15px;
            }

            .customer-edit-field {
                display: flex;
                flex-direction: column;
                gap: 7px;
                min-width: 0;
            }

            .customer-edit-field label {
                color: #dce3ed;
                font-size: 12px;
                font-weight: 700;
            }

            .customer-edit-field input {
                width: 100%;
                height: 42px;
                padding: 0 12px;
                border: 1px solid #334155;
                border-radius: 9px;
                background: #151b25;
                color: #f8fafc;
                font: inherit;
                font-size: 14px;
                outline: none;
                box-sizing: border-box;
            }

            .customer-edit-field input:focus {
                border-color: #64748b;
                box-shadow: 0 0 0 2px rgba(100, 116, 139, 0.15);
            }

            .customer-edit-field input[readonly] {
                color: #9aa9bc;
                opacity: 0.85;
                cursor: not-allowed;
            }

            .customer-edit-full {
                grid-column: 1 / -1;
            }

            .customer-edit-modal .modal-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 22px;
            }

            .customer-edit-modal .modal-actions button {
                min-width: 120px;
                height: 42px;
                border-radius: 9px;
                font-weight: 800;
                cursor: pointer;
            }

            .customer-confirm-overlay {
                position: fixed;
                inset: 0;
                z-index: 10050;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                background: rgba(4, 7, 12, 0.78);
                backdrop-filter: blur(5px);
            }

            .customer-confirm-box {
                position: relative;
                width: min(420px, calc(100vw - 40px));
                padding: 28px;
                border: 1px solid #344154;
                border-radius: 16px;
                background: #1b2430;
                color: #f8fafc;
                text-align: center;
                box-shadow: 0 24px 70px rgba(0, 0, 0, 0.5);
                box-sizing: border-box;
            }

            .customer-confirm-close {
                position: absolute;
                top: 10px;
                right: 12px;
                width: 32px;
                height: 32px;
                border: 0;
                background: transparent;
                color: #91a4bf;
                font-size: 22px;
                cursor: pointer;
            }

            .customer-confirm-icon {
                width: 46px;
                height: 46px;
                margin: 0 auto 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background: rgba(225, 29, 46, 0.14);
                color: #ef3346;
                font-size: 22px;
                font-weight: 800;
            }

            .customer-confirm-box h3 {
                margin: 0 0 8px;
            }

            .customer-confirm-box p {
                margin: 0;
                color: #91a4bf;
                line-height: 1.5;
            }

            .customer-confirm-actions {
                display: flex;
                gap: 10px;
                margin-top: 24px;
            }

            .customer-confirm-actions button {
                flex: 1;
                height: 42px;
                border-radius: 9px;
                font-weight: 800;
                cursor: pointer;
            }

            .customer-confirm-no {
                border: 1px solid #3b4759;
                background: #232d3b;
                color: #f4f7fb;
            }

            .customer-confirm-yes {
                border: 1px solid #e11d2e;
                background: #e30620;
                color: #ffffff;
            }

            @media (max-width: 620px) {
                .customer-edit-grid {
                    grid-template-columns: 1fr;
                }

                .customer-edit-full {
                    grid-column: auto;
                }

                .customer-edit-modal {
                    width: min(520px, calc(100vw - 24px));
                    padding: 20px;
                }

                .customer-edit-modal .modal-actions {
                    justify-content: stretch;
                }

                .customer-edit-modal .modal-actions button {
                    flex: 1;
                    min-width: 0;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /* =====================================================
       CUSTOMER VIEW - COPY BUTTONS ADD-ON ONLY
       -----------------------------------------------------
       This section only adds Copy buttons to:
       - Customer Name
       - Phone
       - Car Plate
       Existing Customer View content is not changed.
       ===================================================== */

    async function copyTextValue(value, button) {
        const text = String(value ?? "").trim();

        if (!text) {
            return;
        }

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                const textarea = document.createElement("textarea");

                textarea.value = text;
                textarea.setAttribute("readonly", "");
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                textarea.style.pointerEvents = "none";

                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                textarea.remove();
            }

            if (button) {
                button.classList.add("customer-copy-done");

                window.setTimeout(() => {
                    button.classList.remove("customer-copy-done");
                }, 900);
            }
        } catch (error) {
            console.error("Unable to copy customer text.", error);
        }
    }

    function createCopyButton(value, label) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "customer-copy-btn";
        button.dataset.customerCopyValue = value || "";
        button.setAttribute("aria-label", `Copy ${label}`);
        button.title = `Copy ${label}`;

        button.innerHTML = `
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
            >
                <rect
                    x="9"
                    y="9"
                    width="11"
                    height="11"
                    rx="2"
                ></rect>
                <path
                    d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                ></path>
            </svg>
        `;

        return button;
    }

    function ensureCopyButtonForName() {
        const name = $("viewCustomerName");

        if (!name) {
            return;
        }

        let row = name.closest(".customer-view-name-row");

        if (!row) {
            row = document.createElement("div");
            row.className = "customer-view-name-row";

            name.parentNode.insertBefore(row, name);
            row.appendChild(name);
        }

        let button = row.querySelector(".customer-copy-name-btn");

        if (!button) {
            button = createCopyButton(
                name.textContent.trim(),
                "customer name"
            );

            button.classList.add("customer-copy-name-btn");
            row.appendChild(button);
        }

        button.dataset.customerCopyValue =
            name.textContent.trim();
    }

    function ensureCopyButtonsForDetails() {
        const details = $("customerViewDetails");

        if (!details) {
            return;
        }

        const blocks = Array.from(details.children);

        blocks.forEach((block) => {
            const label = block.querySelector("span");
            const value = block.querySelector("b");

            if (!label || !value) {
                return;
            }

            const fieldName = label.textContent.trim().toLowerCase();

            if (
                fieldName !== "phone" &&
                fieldName !== "car plate"
            ) {
                return;
            }

            let valueRow = block.querySelector(
                ".customer-copy-value-row"
            );

            if (!valueRow) {
                valueRow = document.createElement("div");
                valueRow.className = "customer-copy-value-row";

                value.parentNode.insertBefore(valueRow, value);
                valueRow.appendChild(value);
            }

            let button = valueRow.querySelector(
                ".customer-copy-detail-btn"
            );

            if (!button) {
                button = createCopyButton(
                    value.textContent.trim(),
                    fieldName
                );

                button.classList.add("customer-copy-detail-btn");
                valueRow.appendChild(button);
            }

            button.dataset.customerCopyValue =
                value.textContent.trim();
        });
    }

    function ensureCustomerViewCopyButtons() {
        ensureCopyButtonForName();
        ensureCopyButtonsForDetails();
    }

    function bindCustomerViewCopyButtons() {
        const modal = $("customerViewModal");

        if (!modal || modal.dataset.customerCopyBound === "1") {
            return;
        }

        modal.dataset.customerCopyBound = "1";

        modal.addEventListener("click", (event) => {
            const button = event.target.closest(
                ".customer-copy-btn"
            );

            if (!button || !modal.contains(button)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            copyTextValue(
                button.dataset.customerCopyValue || "",
                button
            );
        });
    }

    function observeCustomerViewForCopy() {
        const modal = $("customerViewModal");

        if (!modal) {
            return false;
        }

        bindCustomerViewCopyButtons();
        ensureCustomerViewCopyButtons();

        if (modal.dataset.customerCopyObserver === "1") {
            return true;
        }

        modal.dataset.customerCopyObserver = "1";

        const observer = new MutationObserver(() => {
            ensureCustomerViewCopyButtons();
        });

        observer.observe(modal, {
            childList: true,
            subtree: true
        });

        return true;
    }

    function start() {
        ensureCustomerEditDeleteStyles();
        ensureStylesheet();
        ensureModal();
        waitForCustomerRows();
        observeCustomerViewForCopy();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
