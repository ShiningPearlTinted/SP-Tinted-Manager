(() => {
    "use strict";

    /*
     * SP Tinted Manager
     * CUSTOMER EDIT / DELETE ADD-ON ONLY
     *
     * LOCKED:
     * - Existing Customer View
     * - Existing Copy buttons
     * - Dashboard
     * - Customer search/list loading
     * - Invoice
     * - User Management
     * - Settings
     * - app.js
     * - style.css
     *
     * This file only adds Customer Edit and Customer Delete.
     */

    const API_URL = "api/customer_management.php";

    let currentCustomerId = 0;
    let customerStylesInstalled = false;

    function getElement(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async function callCustomerApi(action, options = {}) {
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

        let data = null;

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

    function installCustomerStyles() {
        if (customerStylesInstalled) {
            return;
        }

        const styleId = "sp-customer-edit-delete-styles";
        let style = document.getElementById(styleId);

        if (!style) {
            style = document.createElement("style");
            style.id = styleId;
            document.head.appendChild(style);
        }

        style.textContent = `
/* =========================================================
   CUSTOMER EDIT / DELETE ONLY
   No existing Customer View or Copy selectors are changed.
   ========================================================= */

.customer-edit-btn,
.customer-delete-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: auto !important;
    min-width: 62px !important;
    height: 34px !important;
    margin-left: 6px !important;
    padding: 0 12px !important;
    border: 1px solid #46546a !important;
    border-radius: 8px !important;
    background: #252e3c !important;
    color: #ffffff !important;
    font-family: inherit !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    line-height: 1 !important;
    cursor: pointer !important;
    box-sizing: border-box !important;
}

.customer-edit-btn:hover {
    background: #313d4f !important;
    border-color: #64748b !important;
}

.customer-delete-btn {
    border-color: #743544 !important;
}

.customer-delete-btn:hover {
    background: #3a2028 !important;
    border-color: #e11d2e !important;
}

.customer-edit-overlay {
    position: fixed;
    inset: 0;
    z-index: 10040;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(5, 7, 11, 0.76);
    backdrop-filter: blur(7px);
    -webkit-backdrop-filter: blur(7px);
    box-sizing: border-box;
}

.customer-edit-overlay.customer-is-hidden {
    display: none !important;
}

.customer-edit-card {
    position: relative;
    width: min(680px, 100%);
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    padding: 30px;
    border: 1px solid #39465a;
    border-radius: 20px;
    background: linear-gradient(145deg, #202733, #171c25);
    box-shadow:
        0 30px 80px rgba(0, 0, 0, 0.58),
        0 0 0 1px rgba(255, 255, 255, 0.025) inset;
    box-sizing: border-box;
}

.customer-edit-close {
    position: absolute;
    top: 13px;
    right: 14px;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: #8290a5;
    font-size: 25px;
    line-height: 34px;
    cursor: pointer;
}

.customer-edit-close:hover {
    background: #2a313d;
    color: #ffffff;
}

.customer-edit-card h3 {
    margin: 0;
    color: #ffffff;
    font-size: 22px;
    font-weight: 800;
}

.customer-edit-subtitle {
    margin: 8px 0 24px;
    color: #91a4bf;
    font-size: 13px;
    line-height: 1.5;
}

.customer-edit-form {
    margin: 0;
}

.customer-edit-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
}

.customer-edit-field {
    min-width: 0;
}

.customer-edit-field label {
    display: block;
    margin: 0 0 7px;
    color: #cbd5e1;
    font-size: 12px;
    font-weight: 700;
}

.customer-edit-field input {
    display: block !important;
    width: 100% !important;
    height: 46px !important;
    margin: 0 !important;
    padding: 0 13px !important;
    border: 1px solid #364052 !important;
    border-radius: 10px !important;
    outline: none !important;
    background: #151a23 !important;
    color: #f8fafc !important;
    font-family: inherit !important;
    font-size: 14px !important;
    line-height: 46px !important;
    box-sizing: border-box !important;
}

.customer-edit-field input:focus {
    border-color: #77869c !important;
    box-shadow: 0 0 0 3px rgba(119, 134, 156, 0.12) !important;
}

.customer-edit-field input[readonly] {
    background: #202733 !important;
    color: #9eacbf !important;
    cursor: not-allowed !important;
}

.customer-edit-field.customer-edit-wide {
    grid-column: 1 / -1;
}

.customer-edit-error {
    min-height: 22px;
    margin-top: 14px;
    color: #ff6877;
    font-size: 13px;
}

.customer-edit-actions {
    display: flex;
    gap: 12px;
    margin-top: 8px;
}

.customer-edit-actions button {
    flex: 1;
    height: 48px;
    border-radius: 11px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    box-sizing: border-box;
}

.customer-edit-cancel {
    border: 1px solid #3b4759;
    background: #242d3a;
    color: #dce3ed;
}

.customer-edit-cancel:hover {
    background: #2c3542;
}

.customer-edit-save {
    border: 1px solid #e11d2e;
    background: #d10b1f;
    color: #ffffff;
    box-shadow: 0 8px 20px rgba(209, 11, 31, 0.18);
}

.customer-edit-save:hover {
    background: #e20d24;
}

.customer-edit-actions button:disabled {
    opacity: 0.6;
    cursor: wait;
}

.customer-confirm-overlay {
    position: fixed;
    inset: 0;
    z-index: 10060;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(3, 5, 9, 0.82);
    backdrop-filter: blur(7px);
    -webkit-backdrop-filter: blur(7px);
    box-sizing: border-box;
}

.customer-confirm-box {
    position: relative;
    width: min(420px, 100%);
    padding: 30px;
    border: 1px solid #39465a;
    border-radius: 18px;
    background: linear-gradient(145deg, #202733, #171c25);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
    text-align: center;
    box-sizing: border-box;
}

.customer-confirm-close {
    position: absolute;
    top: 10px;
    right: 12px;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: #8290a5;
    font-size: 22px;
    cursor: pointer;
}

.customer-confirm-close:hover {
    background: #2a313d;
    color: #ffffff;
}

.customer-confirm-icon {
    width: 52px;
    height: 52px;
    margin: 0 auto 16px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #3b1d28;
    color: #f12a43;
    font-size: 25px;
    font-weight: 900;
}

.customer-confirm-box h3 {
    margin: 0;
    color: #ffffff;
    font-size: 21px;
    font-weight: 800;
}

.customer-confirm-box p {
    margin: 10px 0 0;
    color: #91a4bf;
    font-size: 14px;
    line-height: 1.55;
}

.customer-confirm-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
}

.customer-confirm-actions button {
    flex: 1;
    height: 46px;
    border-radius: 10px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
}

.customer-confirm-no {
    border: 1px solid #3b4759;
    background: #242d3a;
    color: #ffffff;
}

.customer-confirm-no:hover {
    background: #2c3542;
}

.customer-confirm-yes {
    border: 1px solid #e11d2e;
    background: #d10b1f;
    color: #ffffff;
}

.customer-confirm-yes:hover {
    background: #e20d24;
}

@media (max-width: 700px) {
    .customer-edit-overlay {
        padding: 14px;
    }

    .customer-edit-card {
        width: 100%;
        max-height: calc(100vh - 28px);
        padding: 24px 18px 20px;
        border-radius: 17px;
    }

    .customer-edit-grid {
        grid-template-columns: 1fr;
        gap: 13px;
    }

    .customer-edit-field.customer-edit-wide {
        grid-column: auto;
    }

    .customer-edit-actions {
        gap: 9px;
    }
}

@media (max-width: 420px) {
    .customer-edit-actions,
    .customer-confirm-actions {
        flex-direction: column;
    }

    .customer-edit-actions button,
    .customer-confirm-actions button {
        width: 100%;
    }
}
        `;

        customerStylesInstalled = true;
    }

    function createEditModal() {
        if (getElement("customerEditOverlay")) {
            return;
        }

        const overlay = document.createElement("div");

        overlay.id = "customerEditOverlay";
        overlay.className = "customer-edit-overlay customer-is-hidden";
        overlay.setAttribute("aria-hidden", "true");

        overlay.innerHTML = `
            <div
                class="customer-edit-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="customerEditTitle"
            >
                <button
                    id="customerEditClose"
                    class="customer-edit-close"
                    type="button"
                    aria-label="Close"
                >
                    ×
                </button>

                <h3 id="customerEditTitle">Edit Customer</h3>
                <p class="customer-edit-subtitle">
                    Update customer information.
                </p>

                <form
                    id="customerEditForm"
                    class="customer-edit-form"
                    autocomplete="off"
                >
                    <input id="customerEditId" type="hidden">

                    <div class="customer-edit-grid">
                        <div class="customer-edit-field">
                            <label for="customerEditCode">
                                Customer ID
                            </label>
                            <input
                                id="customerEditCode"
                                type="text"
                                readonly
                            >
                        </div>

                        <div class="customer-edit-field">
                            <label for="customerEditName">
                                Customer Name
                            </label>
                            <input
                                id="customerEditName"
                                type="text"
                                maxlength="150"
                                required
                            >
                        </div>

                        <div class="customer-edit-field">
                            <label for="customerEditPhone">
                                Phone
                            </label>
                            <input
                                id="customerEditPhone"
                                type="text"
                                maxlength="50"
                                required
                            >
                        </div>

                        <div class="customer-edit-field">
                            <label for="customerEditPlate">
                                Car Plate
                            </label>
                            <input
                                id="customerEditPlate"
                                type="text"
                                maxlength="50"
                                required
                            >
                        </div>

                        <div class="customer-edit-field">
                            <label for="customerEditBrand">
                                Brand
                            </label>
                            <input
                                id="customerEditBrand"
                                type="text"
                                maxlength="100"
                                required
                            >
                        </div>

                        <div class="customer-edit-field">
                            <label for="customerEditModel">
                                Car Model
                            </label>
                            <input
                                id="customerEditModel"
                                type="text"
                                maxlength="100"
                                required
                            >
                        </div>

                        <div class="customer-edit-field">
                            <label for="customerEditType">
                                Customer Type
                            </label>
                            <input
                                id="customerEditType"
                                type="text"
                                readonly
                            >
                        </div>

                        <div class="customer-edit-field">
                            <label for="customerEditVisit">
                                Visit
                            </label>
                            <input
                                id="customerEditVisit"
                                type="text"
                                readonly
                            >
                        </div>

                        <div class="customer-edit-field customer-edit-wide">
                            <label for="customerEditDate">
                                Registration Date
                            </label>
                            <input
                                id="customerEditDate"
                                type="text"
                                readonly
                            >
                        </div>
                    </div>

                    <div
                        id="customerEditError"
                        class="customer-edit-error"
                        role="alert"
                    ></div>

                    <div class="customer-edit-actions">
                        <button
                            id="customerEditCancel"
                            class="customer-edit-cancel"
                            type="button"
                        >
                            CANCEL
                        </button>

                        <button
                            id="customerEditSave"
                            class="customer-edit-save"
                            type="submit"
                        >
                            SAVE
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);

        getElement("customerEditClose").addEventListener(
            "click",
            closeEditModal
        );

        getElement("customerEditCancel").addEventListener(
            "click",
            closeEditModal
        );

        getElement("customerEditForm").addEventListener(
            "submit",
            saveCustomer
        );

        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) {
                closeEditModal();
            }
        });
    }

    function closeEditModal() {
        const overlay = getElement("customerEditOverlay");

        if (!overlay) {
            return;
        }

        overlay.classList.add("customer-is-hidden");
        overlay.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
    }

    async function openEditCustomer(id) {
        createEditModal();

        currentCustomerId = Number(id) || 0;

        if (!currentCustomerId) {
            return;
        }

        getElement("customerEditError").textContent = "";

        try {
            const result = await callCustomerApi("get", {
                method: "POST",
                body: {
                    id: currentCustomerId
                }
            });

            const customer = result.data?.customer;

            if (!customer) {
                throw new Error("Customer record not found.");
            }

            getElement("customerEditId").value = customer.id || "";
            getElement("customerEditCode").value = customer.customer_code || "";
            getElement("customerEditName").value = customer.customer_name || "";
            getElement("customerEditPhone").value = customer.phone_number || "";
            getElement("customerEditPlate").value = customer.car_plate || "";
            getElement("customerEditBrand").value = customer.brand || "";
            getElement("customerEditModel").value = customer.car_model || "";
            getElement("customerEditType").value = customer.customer_type || "";
            getElement("customerEditVisit").value = customer.visit ?? "";
            getElement("customerEditDate").value = customer.registration_date || "";

            const overlay = getElement("customerEditOverlay");

            overlay.classList.remove("customer-is-hidden");
            overlay.setAttribute("aria-hidden", "false");
            document.body.classList.add("modal-open");

            window.setTimeout(() => {
                getElement("customerEditName")?.focus();
            }, 0);
        } catch (error) {
            alert(error.message || "Unable to load customer.");
        }
    }

    async function saveCustomer(event) {
        event.preventDefault();

        const confirmed = await showConfirm(
            "Confirm Update",
            "Are you sure you want to save these customer changes?"
        );

        if (!confirmed) {
            return;
        }

        const button = getElement("customerEditSave");

        button.disabled = true;
        button.textContent = "SAVING...";
        getElement("customerEditError").textContent = "";

        try {
            await callCustomerApi("update", {
                method: "POST",
                body: {
                    id: currentCustomerId,
                    name: getElement("customerEditName").value.trim(),
                    phone: getElement("customerEditPhone").value.trim(),
                    plate: getElement("customerEditPlate").value.trim(),
                    brand: getElement("customerEditBrand").value.trim(),
                    model: getElement("customerEditModel").value.trim()
                }
            });

            closeEditModal();
            await refreshCustomerPage();
        } catch (error) {
            getElement("customerEditError").textContent =
                error.message || "Unable to update customer.";
        } finally {
            button.disabled = false;
            button.textContent = "SAVE";
        }
    }

    function showConfirm(title, message) {
        return new Promise((resolve) => {
            const existing = document.getElementById(
                "customerConfirmOverlay"
            );

            if (existing) {
                existing.remove();
            }

            const overlay = document.createElement("div");

            overlay.id = "customerConfirmOverlay";
            overlay.className = "customer-confirm-overlay";
            overlay.innerHTML = `
                <div
                    class="customer-confirm-box"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="customerConfirmTitle"
                >
                    <button
                        class="customer-confirm-close"
                        type="button"
                        aria-label="Close"
                    >
                        ×
                    </button>

                    <div class="customer-confirm-icon">!</div>

                    <h3 id="customerConfirmTitle">
                        ${escapeHtml(title)}
                    </h3>

                    <p>
                        ${escapeHtml(message)}
                    </p>

                    <div class="customer-confirm-actions">
                        <button
                            class="customer-confirm-no"
                            type="button"
                        >
                            NO
                        </button>

                        <button
                            class="customer-confirm-yes"
                            type="button"
                        >
                            YES
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            let finished = false;

            const finish = (value) => {
                if (finished) {
                    return;
                }

                finished = true;
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

    async function deleteCustomer(id, code, name) {
        const customerId = Number(id) || 0;

        if (!customerId) {
            alert("Invalid customer ID.");
            return;
        }

        const confirmed = await showConfirm(
            "Confirm Delete",
            `Delete ${code} - ${name}? This action cannot be undone.`
        );

        if (!confirmed) {
            return;
        }

        try {
            await callCustomerApi("delete", {
                method: "POST",
                body: {
                    id: customerId
                }
            });

            await refreshCustomerPage();
        } catch (error) {
            alert(error.message || "Unable to delete customer.");
        }
    }

    async function refreshCustomerPage() {
        const refreshButton = getElement("customerRefresh");

        if (refreshButton) {
            refreshButton.click();
            return;
        }

        window.location.reload();
    }

    function getCustomerIdFromRow(row) {
        if (!row) {
            return "";
        }

        const viewButton = row.querySelector(
            'button.view-btn[data-id], button[data-id]'
        );

        if (viewButton?.dataset?.id) {
            return viewButton.dataset.id;
        }

        if (row.dataset.customerId) {
            return row.dataset.customerId;
        }

        return "";
    }

    function addCustomerActionButtons() {
        const rows = document.querySelectorAll("#customerRows tr");

        rows.forEach((row) => {
            const id = getCustomerIdFromRow(row);

            if (!id || !/^\d+$/.test(String(id))) {
                return;
            }

            const actionCell = row.lastElementChild;

            if (!actionCell) {
                return;
            }

            if (!actionCell.querySelector(".customer-edit-btn")) {
                const editButton = document.createElement("button");

                editButton.className = "customer-edit-btn";
                editButton.type = "button";
                editButton.dataset.customerId = id;
                editButton.textContent = "Edit";
                editButton.setAttribute("aria-label", "Edit customer");

                actionCell.appendChild(editButton);
            }

            if (!actionCell.querySelector(".customer-delete-btn")) {
                const deleteButton = document.createElement("button");

                deleteButton.className = "customer-delete-btn";
                deleteButton.type = "button";
                deleteButton.dataset.customerId = id;
                deleteButton.textContent = "Delete";
                deleteButton.setAttribute("aria-label", "Delete customer");

                actionCell.appendChild(deleteButton);
            }
        });
    }

    function bindCustomerActions() {
        if (document.documentElement.dataset.spCustomerActionsBound === "1") {
            return;
        }

        document.documentElement.dataset.spCustomerActionsBound = "1";

        document.addEventListener(
            "click",
            (event) => {
                const editButton = event.target.closest(
                    ".customer-edit-btn"
                );

                if (editButton) {
                    event.preventDefault();
                    event.stopPropagation();

                    openEditCustomer(editButton.dataset.customerId);
                    return;
                }

                const deleteButton = event.target.closest(
                    ".customer-delete-btn"
                );

                if (deleteButton) {
                    event.preventDefault();
                    event.stopPropagation();

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
                }
            },
            true
        );
    }

    function observeCustomerRows() {
        const tableBody = getElement("customerRows");

        if (!tableBody) {
            return false;
        }

        addCustomerActionButtons();

        if (tableBody.dataset.spCustomerObserver === "1") {
            return true;
        }

        tableBody.dataset.spCustomerObserver = "1";

        const observer = new MutationObserver(() => {
            addCustomerActionButtons();
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

    function start() {
        installCustomerStyles();
        createEditModal();
        bindCustomerActions();
        waitForCustomerRows();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
