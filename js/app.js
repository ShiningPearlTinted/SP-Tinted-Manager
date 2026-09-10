// ===========================================
// SP CUSTOMER REGISTRATION - MYSQL VERSION
// ===========================================

const API_URL = "api/index.php";
let carData = [];
let currentCustomer = null;
let currentData = null;

window.onload = function(){
    loadCarBrand();
    document.getElementById("plate").addEventListener("input", function(){
        this.value = this.value.toUpperCase();
    });
};

async function api(action, payload = null){
    const options = { method: payload ? "POST" : "GET", headers: {} };
    if(payload){
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(payload);
    }
    const response = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, options);
    let result;
    try { result = await response.json(); }
    catch(e) { throw new Error("Invalid server response."); }
    if(!response.ok || !result.success){
        throw new Error(result.message || "Server request failed.");
    }
    return result;
}

async function loadCarBrand(){
    try {
        const result = await api("car_models");
        carData = result.data || [];
        const brand = document.getElementById("brand");
        brand.innerHTML = "";
        const first = document.createElement("option");
        first.value = "";
        first.text = "Select Brand";
        brand.appendChild(first);
        const brands = [...new Set(carData.map(r => r.brand))].filter(Boolean).sort((a,b)=>a.localeCompare(b));
        brands.forEach(item => {
            const option = document.createElement("option");
            option.value = item;
            option.text = item;
            brand.appendChild(option);
        });
    } catch(error) { showError(error); }
}

document.addEventListener("change", function(e){
    if(e.target.id !== "brand") return;
    loadCarModel(e.target.value);
});

function loadCarModel(brand){
    const model = document.getElementById("model");
    model.innerHTML = "";
    const first = document.createElement("option");
    first.value = "";
    first.text = "Select Car Model";
    model.appendChild(first);
    carData.forEach(function(r){
        if(r.brand === brand){
            const option = document.createElement("option");
            option.value = r.car_model;
            option.text = r.car_model;
            model.appendChild(option);
        }
    });
}

function getFormData(){
    return {
        name: document.getElementById("name").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        brand: document.getElementById("brand").value,
        model: document.getElementById("model").value,
        plate: document.getElementById("plate").value.trim().toUpperCase()
    };
}

function setSaving(saving){
    const btn = document.getElementById("btnRegister");
    btn.disabled = saving;
    btn.innerHTML = saving ? "Saving..." : "REGISTER CUSTOMER";
}

async function registerCustomer(){
    const status = document.getElementById("status");
    const data = getFormData();
    if(!data.name || !data.phone || !data.brand || !data.model || !data.plate){
        status.style.color = "#ff4d4d";
        status.innerHTML = "Please complete all fields.";
        return;
    }
    setSaving(true);
    try {
        const result = await api("save_customer", data);
        if(result.status === "success"){
            status.style.color = "#00e676";
            status.innerHTML = "✅ Registration Successful<br><br><b>Customer ID :</b> " + result.id;
            clearForm();
            return;
        }
        if(result.status === "duplicate"){
            currentCustomer = result.customer;
            currentData = data;
            document.getElementById("popupId").textContent = currentCustomer.id;
            document.getElementById("popupName").textContent = currentCustomer.name;
            document.getElementById("popupPhone").textContent = currentCustomer.phone;
            document.getElementById("popupPlate").textContent = currentCustomer.plate;
            document.getElementById("popupBrand").textContent = currentCustomer.brand;
            document.getElementById("popupModel").textContent = currentCustomer.model;
            document.getElementById("popupVisit").textContent = currentCustomer.visit;
            document.getElementById("customerPopup").style.display = "flex";
        }
    } catch(error) { showError(error); }
    finally { setSaving(false); }
}

async function continueRegistration(){
    closePopup();
    if(!currentData) return;
    const status = document.getElementById("status");
    setSaving(true);
    try {
        const result = await api("save_returning_customer", currentData);
        status.style.color = "#00e676";
        status.innerHTML = "✅ Returning Customer Saved<br><br><b>Customer ID :</b> " + result.id + "<br><b>Visit :</b> " + result.visit;
        clearForm();
    } catch(error) { showError(error); }
    finally { setSaving(false); }
}

function closePopup(){ document.getElementById("customerPopup").style.display = "none"; }

function clearForm(){
    document.getElementById("name").value = "";
    document.getElementById("phone").value = "";
    document.getElementById("plate").value = "";
    document.getElementById("brand").selectedIndex = 0;
    document.getElementById("model").innerHTML = '<option value="">Select Car Model</option>';
    currentCustomer = null;
    currentData = null;
    closePopup();
    document.getElementById("name").focus();
}

function showError(error){
    setSaving(false);
    const status = document.getElementById("status");
    status.style.color = "#ff4d4d";
    status.innerHTML = "❌ " + (error?.message || "An unexpected error occurred.");
}
