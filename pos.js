/**********************
 * BANKA POS (frontend)
 * Root files version: pos.js (full)
 * Requires: window.CITY_CONFIG
 **********************/
(function () {
  const CFG = window.CITY_CONFIG || {};
  const API_URL   = String(CFG.apiUrl || "");
  const API_TOKEN = String(CFG.apiToken || "");
  const EMPLOYEES = Array.isArray(CFG.employees) ? CFG.employees : ["Ви","Виталий","Зура","Джули"];

  // ---- UI els ----
  const el = {
    cityTitle: document.getElementById("cityTitle"),
    syncStatus: document.getElementById("syncStatus"),
    payModeLabel: document.getElementById("payModeLabel"),

    tabPos: document.getElementById("tabPos"),
    tabAdmin: document.getElementById("tabAdmin"),
    posWrap: document.getElementById("posWrap"),
    adminPanel: document.getElementById("adminPanel"),

    search: document.getElementById("search"),
    suggest: document.getElementById("suggest"),
    qtyAdd: document.getElementById("qtyAdd"),
    qtyAddWrap: document.getElementById("qtyAddWrap"),
    qtyMinus: document.getElementById("qtyMinus"),
    qtyPlus: document.getElementById("qtyPlus"),
    addBtn: document.getElementById("addBtn"),

    cartBody: document.getElementById("cartBody"),
    itemsCount: document.getElementById("itemsCount"),
    grandTotal: document.getElementById("grandTotal"),

    discountLabel: document.getElementById("discountLabel"),
    discountEmpLabel: document.getElementById("discountEmpLabel"),
    empDiscountPill: document.getElementById("empDiscountPill"),

    cashBtn: document.getElementById("cashBtn"),
    cardBtn: document.getElementById("cardBtn"),
    deliveryBtn: document.getElementById("deliveryBtn"),
    corpBtn: document.getElementById("corpBtn"),

    discountBtn: document.getElementById("discountBtn"),
    discountClearBtn: document.getElementById("discountClearBtn"),

    copyBtn: document.getElementById("copyBtn"),
    clearBtn: document.getElementById("clearBtn"),
    closeShiftBtn: document.getElementById("closeShiftBtn"),

    refreshBtn: document.getElementById("refreshBtn"),
    catBar: document.getElementById("catBar"),
    subBar: document.getElementById("subBar"),

    // ADMIN
    adminStatus: document.getElementById("adminStatus"),
    adminDate: document.getElementById("adminDate"),
    adminYm: document.getElementById("adminYm"),
    adminDayBtn: document.getElementById("adminDayBtn"),
    adminMonthBtn: document.getElementById("adminMonthBtn"),
    adminEmpBtn: document.getElementById("adminEmpBtn"),
    adminInvBtn: document.getElementById("adminInvBtn"),
    adminStopsBtn: document.getElementById("adminStopsBtn"),
    adminLogoutBtn: document.getElementById("adminLogoutBtn"),

    kpiCash: document.getElementById("kpiCash"),
    kpiCard: document.getElementById("kpiCard"),
    kpiDelivery: document.getElementById("kpiDelivery"),
    kpiCorp: document.getElementById("kpiCorp"),
    kpiTotal: document.getElementById("kpiTotal"),
    kpiCount: document.getElementById("kpiCount"),
    kpiPeriod: document.getElementById("kpiPeriod"),
    kpiMode: document.getElementById("kpiMode"),

    adminSearch: document.getElementById("adminSearch"),
    adminExportBtn: document.getElementById("adminExportBtn"),
    adminThead: document.getElementById("adminThead"),
    adminTbody: document.getElementById("adminTbody"),

    loadingOverlay: document.getElementById("loadingOverlay"),
    quickGrid: document.getElementById("quickGrid"),
  };

  if (el.cityTitle) el.cityTitle.textContent = String(CFG.cityName || "Батуми");
  if (CFG.cityKey) localStorage.setItem("banka_city", String(CFG.cityKey));

  // ---- constants / filters ----
  // Главные категории UI
  const MAIN_CATS = ["Все","Краны","Бутылки/Банки","Тара","Рыба","Снеки","Мясо","Чипсы"];

  // Подкатегории (они у тебя лежат в колонке Products.cat)
  const BOTTLE_SUB = ["Медовухи","Безалкогольные","IPA/APA","Классика","Темное","Пшеничка","Sour/Gose/Cider"];

  // ---- helpers ----
  function money(n){
    const x = Math.round((Number(n)||0)*100)/100;
    return x.toLocaleString("ru-RU",{minimumFractionDigits:0,maximumFractionDigits:2});
  }
  function normalize(s){ return String(s||"").toLowerCase().replaceAll("ё","е").trim(); }
  function esc(s){
    return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }
  function parseNum(x){
    if (x===null || x===undefined) return NaN;
    return Number(String(x).replace(",", ".").trim());
  }
  function uuid(){
    return (crypto.randomUUID && crypto.randomUUID()) || (Date.now()+"-"+Math.random().toString(16).slice(2));
  }
  function todayKey(){
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  }
  function thisYm(){
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    return `${yyyy}-${mm}`;
  }
  function tapNumber(name){
    const m = String(name||"").match(/кран\s*(\d+)/i);
    return m ? Number(m[1]) : 9999;
  }
  function sortProducts(a,b){
    const ac = String(a.cat||"").toLowerCase();
    const bc = String(b.cat||"").toLowerCase();

    const aIsTap = ac==="краны";
    const bIsTap = bc==="краны";
    if (aIsTap && bIsTap) return tapNumber(a.name) - tapNumber(b.name);
    if (aIsTap !== bIsTap) return aIsTap ? -1 : 1;

    return String(a.name||"").localeCompare(String(b.name||""),"ru");
  }

  // ---- loader ----
  function setLoading(on, text){
    if (!el.loadingOverlay) return;
    el.loadingOverlay.style.display = on ? "flex" : "none";
    const t = el.loadingOverlay.querySelector(".loadingText");
    if (t) t.textContent = text || (on ? "Загрузка…" : "");
    const dis = !!on;
    [el.cashBtn, el.cardBtn, el.deliveryBtn, el.corpBtn].forEach(b=>{
      if (b) b.disabled = dis;
    });
  }

  // ---- API ----
  function diagnoseFailedFetch(){
    return [
      "Не удалось подключиться к Google Apps Script (сетевой сбой). Проверь:",
      "1) В batumi.html CITY_CONFIG.apiUrl — это Web App URL и он заканчивается на /exec",
      "2) Apps Script -> Deploy -> Web app: доступ = Anyone (или Anyone with link), Execute as = Me",
      "3) Открой вручную в браузере:",
      "   <apiUrl>?path=state&token=<token> — должен вернуться JSON ok:true",
    ].join("\n");
  }

  function isNetworkFail(err){
    const s = String(err || "");
    // Chrome: Failed to fetch, Firefox: Load failed
    return s.includes("Failed to fetch") || s.includes("Load failed") || s.includes("NetworkError");
  }

  async function apiGet(path, params={}){
    const qs = new URLSearchParams({ path, token: API_TOKEN, ...params });
    try{
      const res = await fetch(`${API_URL}?${qs.toString()}`, { method:"GET" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "API error");
      return data;
    }catch(err){
      if (isNetworkFail(err)) throw new Error(diagnoseFailedFetch());
      throw err;
    }
  }

  async function apiPost(body){
    const qs = new URLSearchParams({ token: API_TOKEN });

    // ВАЖНО: text/plain вместо application/json → меньше CORS/OPTIONS проблем на GitHub Pages
    // Code.gs всё равно читает e.postData.contents и JSON.parse — это работает.
    try{
      const res = await fetch(`${API_URL}?${qs.toString()}`,{
        method:"POST",
        headers:{ "Content-Type":"text/plain;charset=utf-8" },
        body: JSON.stringify(body),
        credentials: "omit",
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "API error");
      return data;
    }catch(err){
      if (isNetworkFail(err)) throw new Error(diagnoseFailedFetch());
      throw err;
    }
  }

  async function apiGetAdmin(path, params={}){
    const adminPassword = (sessionStorage.getItem("banka_admin_password") || "").trim();
    const qs = new URLSearchParams({ path, token: API_TOKEN, adminPassword, ...params });
    try{
      const res = await fetch(`${API_URL}?${qs.toString()}`, { method:"GET" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Admin API error");
      return data;
    }catch(err){
      if (isNetworkFail(err)) throw new Error(diagnoseFailedFetch());
      throw err;
    }
  }

  // ---- Category canonicalization ----
  // ВАЖНО: В твоей таблице Products.cat для бутылок/банок = подкатегория (IPA/APA, Темное, ...)
  // Поэтому мы делаем виртуальную "главную" категорию "Бутылки/Банки", а подкатегорию кладём в p.subcat
  function canonicalCat(raw) {
    const s = String(raw || "").trim();

    // если в таблице cat = одна из подкатегорий бутылок/банок
    if (BOTTLE_SUB.includes(s)) return "Бутылки/Банки";

    const n = normalize(s);

    if (n.includes("кран")) return "Краны";

    // Тара отдельно (ориентируемся только на cat из таблицы)
    if (n.includes("тара") || n.includes("пэт") || n.includes("круж") || n.includes("стак") || (n.includes("бутылка") && n.includes("пуст")))
      return "Тара";

    if (n.includes("рыб")) return "Рыба";
    if (n.includes("снек")) return "Снеки";
    if (n.includes("мяс")) return "Мясо";
    if (n.includes("чип")) return "Чипсы";

    return s || "Другое";
  }

  // ---- state ----
  let state = null;
  let catalog = [];
  let stopSet = new Set();

  let corporateEmployee = "";
  let discountPercent = 0;
  let employeeDiscountPercent = 0;

  let paymentMethod = "cash";
  let cart = [];

  let catFilter = "Все";
  let bottleSub = "IPA/APA";

  // suggest
  let suggestItems = [];
  let activeSuggestIndex = -1;

  function normalizeProduct(p){
    const rawCat = String(p.cat || "").trim();
    const cat = canonicalCat(rawCat);

    // subcat нужен ТОЛЬКО для "Бутылки/Банки"
    const subcat = (cat === "Бутылки/Банки" && BOTTLE_SUB.includes(rawCat)) ? rawCat : "";

    return {
      id: normalize(p.id),
      name: String(p.name||"").trim(),
      cat,
      subcat,
      type: p.type || "unit",
      price: Number(p.price||0),
      deliveryPrice: (p.deliveryPrice==="" || p.deliveryPrice==null) ? "" : Number(p.deliveryPrice||0),
      track: p.track || "count",
      kegSizeL: Number(p.kegSizeL||0),
      kegsSpare: Number(p.kegsSpare||0),
    };
  }

  function applyStateToUI(st){
    state = st;
    catalog = (st.products || []).map(normalizeProduct).sort(sortProducts);
    stopSet = new Set(st.stopIds || []);
    if (el.syncStatus) el.syncStatus.textContent = "OK";
    renderCats();
    renderSubcats();
    renderQuickGrid();
    renderCart();
  }

  function suggest(q){
    const s = normalize(q);
    if (!s) return [];
    const out = [];
    for (const p of catalog){
      if (p.name && normalize(p.name).includes(s)) out.push(p);
      if (out.length>=12) break;
    }
    return out;
  }

  function showSuggest(items){
    suggestItems = items || [];
    activeSuggestIndex = -1;

    if (!el.suggest) return;
    if (!suggestItems.length){
      hideSuggest();
      return;
    }
    el.suggest.style.display = "";
    el.suggest.innerHTML = suggestItems.map((p,i)=>(
      `<div class="suggestItem" data-i="${i}">
        <div><b>${esc(p.name)}</b></div>
        <small>${esc(p.cat)}${p.subcat ? " • " + esc(p.subcat) : ""} • ${money(p.price)} GEL</small>
      </div>`
    )).join("");

    el.suggest.querySelectorAll(".suggestItem").forEach(node=>{
      node.addEventListener("click", ()=>{
        const i = Number(node.dataset.i);
        pickSuggest(i);
      });
    });
  }

  function hideSuggest(){
    if (!el.suggest) return;
    el.suggest.style.display = "none";
    el.suggest.innerHTML = "";
    suggestItems = [];
    activeSuggestIndex = -1;
  }

  function setActiveSuggest(i){
    activeSuggestIndex = i;
    if (!el.suggest) return;
    const nodes = el.suggest.querySelectorAll(".suggestItem");
    nodes.forEach((n,idx)=>n.classList.toggle("active", idx===i));
    if (nodes[i]) nodes[i].scrollIntoView({block:"nearest"});
  }

  function pickSuggest(i){
    const p = suggestItems[i];
    if (!p) return;
    addToCart(p.id);
    if (el.search) el.search.value = "";
    hideSuggest();
  }

  function getQtyInput(){
    const v = parseNum(el.qtyAdd?.value);
    if (!Number.isFinite(v) || v<=0) return 1;
    return v;
  }
  function setQtyInput(v){
    if (el.qtyAdd) el.qtyAdd.value = String(v);
  }

  function findProduct(id){
    const nid = normalize(id);
    return catalog.find(x=>x.id===nid) || null;
  }

  function addToCart(productId){
    const pid = normalize(productId);
    const p = findProduct(pid);
    if (!p) return;

    const q = getQtyInput();

    if (stopSet.has(pid)){
      alert("Этот товар на стопе.");
      return;
    }

    const idx = cart.findIndex(x=>x.productId===pid);
    if (idx>=0){
      cart[idx].qtyBase = Math.round((cart[idx].qtyBase + q)*100)/100;
    } else {
      cart.push({
        productId: pid,
        name: p.name,
        cat: p.cat,
        subcat: p.subcat,
        type: p.type,
        track: p.track,
        price: p.price,
        deliveryPrice: p.deliveryPrice,
        qtyBase: q,
      });
    }
    renderCart();
  }

  function setPayment(m){
    paymentMethod = m;
    if (el.payModeLabel) el.payModeLabel.textContent = m;
    renderQuickGrid();
    renderCart();
  }

  // delivery price fix
  function unitPriceFor(item){
    if (paymentMethod === "delivery"){
      const dp = item.deliveryPrice;
      if (dp !== "" && dp !== null && dp !== undefined && Number.isFinite(Number(dp)) && Number(dp) > 0) {
        return Number(dp);
      }
    }
    return Number(item.price||0);
  }

  function lineSum(item){
    return Math.round(unitPriceFor(item) * Number(item.qtyBase||0) * 100) / 100;
  }
  function grossTotal(){
    return Math.round(cart.reduce((s,it)=>s+lineSum(it),0)*100)/100;
  }
  function discountAmount(){
    const gross = grossTotal();
    const cust = Math.max(0, Math.min(100, Number(discountPercent||0)));
    const emp = Math.max(0, Math.min(100, Number(employeeDiscountPercent||0)));
    const totalDisc = Math.max(cust, emp);
    return Math.round(gross * (totalDisc/100) * 100) / 100;
  }
  function netTotal(){
    return Math.round((grossTotal() - discountAmount())*100)/100;
  }

  function renderCart(){
    if (!el.cartBody) return;

    if (el.itemsCount) el.itemsCount.textContent = String(cart.length);
    if (el.grandTotal) el.grandTotal.textContent = money(netTotal());

    if (el.discountLabel) el.discountLabel.textContent = `${Number(discountPercent||0)}%`;
    if (el.discountEmpLabel) el.discountEmpLabel.textContent = `${Number(employeeDiscountPercent||0)}%`;
    if (el.empDiscountPill) el.empDiscountPill.style.display = employeeDiscountPercent>0 ? "" : "none";

    el.cartBody.innerHTML = cart.map((it,idx)=>{
      const up = unitPriceFor(it);
      const sum = lineSum(it);
      return `<div class="trow" data-i="${idx}">
        <div>
          <div style="font-weight:850">${esc(it.name)}</div>
          <div style="font-size:12px;opacity:.7">${esc(it.cat)}${it.subcat ? " • " + esc(it.subcat) : ""} • ${paymentMethod==="delivery" ? "доставка" : "обычно"}</div>
        </div>
        <div class="right">
          <input class="qtyInp" value="${esc(String(it.qtyBase))}" inputmode="decimal" />
        </div>
        <div class="right">${money(up)}</div>
        <div class="right"><b>${money(sum)}</b></div>
        <div class="right"><button class="btn ghost delBtn" title="Удалить">✕</button></div>
      </div>`;
    }).join("");

    el.cartBody.querySelectorAll(".trow").forEach(row=>{
      const idx = Number(row.dataset.i);

      const qtyInp = row.querySelector(".qtyInp");
      qtyInp.addEventListener("change", ()=>{
        const v = parseNum(qtyInp.value);
        if (!Number.isFinite(v) || v<=0){
          qtyInp.value = String(cart[idx]?.qtyBase || 1);
          return;
        }
        cart[idx].qtyBase = Math.round(v*100)/100;
        renderCart();
      });

      const delBtn = row.querySelector(".delBtn");
      delBtn.addEventListener("click", ()=>{
        cart.splice(idx,1);
        renderCart();
      });
    });
  }

  function renderCats(){
    if (!el.catBar) return;
    el.catBar.innerHTML = MAIN_CATS.map(c=>(
      `<div class="chip ${c===catFilter?'active':''}" data-c="${esc(c)}">${esc(c)}</div>`
    )).join("");
    el.catBar.querySelectorAll(".chip").forEach(ch=>{
      ch.addEventListener("click", ()=>{
        catFilter = ch.dataset.c;

        renderSubcats();
        renderQuickGrid();
      });
    });
  }

  function renderSubcats(){
    if (!el.subBar) return;

    // Подкатегории показываем ТОЛЬКО когда выбраны "Бутылки/Банки"
    if (catFilter !== "Бутылки/Банки"){
      el.subBar.innerHTML = "";
      el.subBar.style.display = "none";
      return;
    }

    el.subBar.style.display = "";
    el.subBar.innerHTML = BOTTLE_SUB.map(c=>(
      `<div class="chip ${c===bottleSub?'active':''}" data-c="${esc(c)}">${esc(c)}</div>`
    )).join("");
    el.subBar.querySelectorAll(".chip").forEach(ch=>{
      ch.addEventListener("click", ()=>{
        bottleSub = ch.dataset.c;
        renderQuickGrid();
      });
    });
  }

  function passesFilters(p){
    if (catFilter !== "Все" && p.cat !== catFilter) return false;

    // Подкатегории применяем ТОЛЬКО для "Бутылки/Банки" и сравниваем по p.subcat (это cat из таблицы)
    if (catFilter === "Бутылки/Банки"){
      if (!p.subcat) return false;
      if (p.subcat !== bottleSub) return false;
    }

    return true;
  }

  function renderQuickGrid(){
    if (!el.quickGrid) return;
    const items = catalog.filter(p=>passesFilters(p));
    el.quickGrid.innerHTML = items.map(p=>{
      const isStop = stopSet.has(p.id);
      const price = (paymentMethod==="delivery" && p.deliveryPrice!=="") ? p.deliveryPrice : p.price;
      return `<div class="quickBtn ${isStop?'stop':''}" data-id="${esc(p.id)}">
        <div class="quickName">${esc(p.name)}</div>
        <div class="quickMeta">${esc(p.cat)}${p.subcat ? " • " + esc(p.subcat) : ""} • ${money(price)} GEL</div>
      </div>`;
    }).join("");

    el.quickGrid.querySelectorAll(".quickBtn").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        if (btn.classList.contains("stop")) return;
        addToCart(btn.dataset.id);
      });
    });
  }

  function clearDiscounts(){
    discountPercent = 0;
    employeeDiscountPercent = 0;
    renderCart();
  }

  function setCustomerDiscount(){
    const v = prompt("Скидка клиенту (%)", String(discountPercent||0));
    if (v === null) return;
    const n = parseNum(v);
    if (!Number.isFinite(n) || n<0 || n>100) { alert("Нужно число 0..100"); return; }
    discountPercent = Math.round(n);
    renderCart();
  }

  function resetAfterSale(){
    cart = [];
    corporateEmployee = "";
    clearDiscounts();

    catFilter = "Все";
    bottleSub = "IPA/APA";

    if (el.search) el.search.value = "";
    hideSuggest();
    setQtyInput(1);

    setPayment("cash");

    renderCats();
    renderSubcats();
    renderQuickGrid();
    renderCart();
  }

  async function corporatePayFlow(){
    if (!cart.length){
      alert("Чек пустой.");
      return;
    }

    const name = prompt(`Кто взял? Введите имя:\n${EMPLOYEES.join(", ")}`, corporateEmployee || EMPLOYEES[0]);
    if (name === null) return;
    corporateEmployee = String(name).trim();
    if (!corporateEmployee){
      alert("Нужно имя сотрудника.");
      return;
    }

    const empDisc = prompt("Скидка персоналу (%)? (0..100, можно 0)", String(employeeDiscountPercent||0));
    if (empDisc === null) return;
    const d = parseNum(empDisc);
    if (!Number.isFinite(d) || d<0 || d>100) { alert("Нужно число 0..100"); return; }
    employeeDiscountPercent = Math.round(d);

    setPayment("corporate");
    await pay();
  }

  function buildKegSwitchesFromServer(res){
    const switches = {};
    (res.kegUpdated||[]).forEach(k=>{
      const v = prompt(`Переключили кег: ${k.name}\nСколько литров налили уже из нового кега ДО пробития?`, "0");
      if (v === null) return;
      const n = parseNum(v);
      if (Number.isFinite(n) && n>0) switches[k.id] = n;
    });
    return switches;
  }

  async function pay(){
    if (!cart.length){
      alert("Чек пустой.");
      return;
    }

    setLoading(true, "Пробиваю чек…");

    const receiptId = uuid();
    const items = cart.map(it=>({
      productId: it.productId,
      qtyBase: Number(it.qtyBase||0),
      displayUnit: "",
      unitPriceUsed: unitPriceFor(it),
    }));

    const gross = grossTotal();
    const disc = discountAmount();
    const net = netTotal();

    let payload = {
      path:"sale",
      receiptId,
      paymentMethod,
      employee: (paymentMethod==="corporate") ? corporateEmployee : "",
      grossTotal: gross,
      discountAmount: disc,
      netTotal: net,
      items,
      kegSwitches: {}
    };

    try{
      if (el.syncStatus) el.syncStatus.textContent = "…";
      let res = await apiPost(payload);

      if (res.kegUpdated && res.kegUpdated.length){
        const switches = buildKegSwitchesFromServer(res);
        if (Object.keys(switches).length){
          payload.kegSwitches = switches;
          res = await apiPost(payload);
        }
      }

      if (res.lowWarnings && res.lowWarnings.length){
        const lines = res.lowWarnings.map(x => `${x.name} осталось ${x.remaining} ${x.unit}.`);
        alert(lines.join("\n"));
      }

      applyStateToUI(res.state);

      const msg = (paymentMethod==="corporate")
        ? `Корпоративный — ${corporateEmployee}: ${money(net)} GEL`
        : `Пробито ✅ Сумма: ${money(net)} GEL`;

      resetAfterSale();
      alert(msg);

    }catch(err){
      if (el.syncStatus) el.syncStatus.textContent = "ERR";
      alert("Ошибка при пробитии: " + err);
    }finally{
      setLoading(false);
    }
  }

  async function closeShift(){
    try{
      const data = await apiGet("shiftSummary", { date: todayKey() });
      alert(
        `Смена за ${data.dayKey}\n\n` +
        `Наличные: ${money(data.cash)} GEL\n` +
        `Карта: ${money(data.card)} GEL\n` +
        `Доставка: ${money(data.delivery)} GEL\n` +
        `Корпоративная: ${money(data.corporate)} GEL\n\n` +
        `ИТОГО: ${money(data.total)} GEL\n` +
        `Чеков: ${data.count}`
      );
    }catch(err){
      alert("Ошибка: " + err);
    }
  }

  // ---- ADMIN ----
  let adminCurrentRows = [];
  let adminCurrentCols = [];

  function showAdmin(on){
    if (el.posWrap) el.posWrap.style.display = on ? "none" : "";
    if (el.adminPanel) el.adminPanel.style.display = on ? "" : "none";
    if (el.tabPos) el.tabPos.classList.toggle("active", !on);
    if (el.tabAdmin) el.tabAdmin.classList.toggle("active", on);
  }

  function setTab(t){
    if (t==="admin"){
      const pass = (sessionStorage.getItem("banka_admin_password") || "").trim();
      if (!pass){
        const p = prompt("Пароль админа:", "");
        if (p===null) { showAdmin(false); return; }
        sessionStorage.setItem("banka_admin_password", String(p).trim());
      }
      showAdmin(true);
      return;
    }
    showAdmin(false);
  }

  function setKpi(mode, data, periodText){
    if (el.kpiMode) el.kpiMode.textContent = mode || "—";
    if (el.kpiPeriod) el.kpiPeriod.textContent = periodText || "—";

    if (data && data.byMethod){
      if (el.kpiCash) el.kpiCash.textContent = money(data.byMethod.cash);
      if (el.kpiCard) el.kpiCard.textContent = money(data.byMethod.card);
      if (el.kpiDelivery) el.kpiDelivery.textContent = money(data.byMethod.delivery);
      if (el.kpiCorp) el.kpiCorp.textContent = money(data.byMethod.corporate);
      if (el.kpiTotal) el.kpiTotal.textContent = money(data.byMethod.total);
      if (el.kpiCount) el.kpiCount.textContent = String(data.byMethod.count);
      return;
    }

    if (data){
      if (el.kpiCash) el.kpiCash.textContent = money(data.cash||0);
      if (el.kpiCard) el.kpiCard.textContent = money(data.card||0);
      if (el.kpiDelivery) el.kpiDelivery.textContent = money(data.delivery||0);
      if (el.kpiCorp) el.kpiCorp.textContent = money(data.corporate||0);
      if (el.kpiTotal) el.kpiTotal.textContent = money(data.total||0);
      if (el.kpiCount) el.kpiCount.textContent = String(data.count||0);
    }
  }

  function renderAdminTable(cols, rows){
    adminCurrentCols = cols || [];
    adminCurrentRows = rows || [];

    if (!el.adminThead || !el.adminTbody) return;
    el.adminThead.innerHTML = `<tr>${adminCurrentCols.map(c=>`<th>${esc(c)}</th>`).join("")}</tr>`;
    el.adminTbody.innerHTML = adminCurrentRows.map(r=>(
      `<tr>${adminCurrentCols.map(c=>`<td>${esc(r[c] ?? "")}</td>`).join("")}</tr>`
    )).join("");
  }

  function filterAdminTable(q){
    const s = normalize(q);
    if (!s){
      renderAdminTable(adminCurrentCols, adminCurrentRows);
      return;
    }
    const rows = adminCurrentRows.filter(r=>{
      return adminCurrentCols.some(c=> normalize(String(r[c] ?? "")).includes(s));
    });
    renderAdminTable(adminCurrentCols, rows);
  }

  function exportAdminCsv(){
    const cols = adminCurrentCols || [];
    const rows = adminCurrentRows || [];
    if (!cols.length) return;

    const escCsv = (v)=> {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return `"${s.replaceAll('"','""')}"`;
      return s;
    };

    const csv = [
      cols.map(escCsv).join(","),
      ...rows.map(r=> cols.map(c=>escCsv(r[c])).join(","))
    ].join("\n");

    const blob = new Blob([csv],{type:"text/csv;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `banka_admin_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function adminDay(){
    try{
      if (el.adminStatus) el.adminStatus.textContent = "…";
      const date = el.adminDate?.value || todayKey();
      const data = await apiGetAdmin("admin/day", { date });
      setKpi("day", data, date);
      renderAdminTable(["dayKey","cash","card","delivery","corporate","total","count"], [data]);
      if (el.adminStatus) el.adminStatus.textContent = "OK";
    }catch(err){
      if (el.adminStatus) el.adminStatus.textContent = "ERR";
      alert("Admin error: " + err);
    }
  }

  async function adminMonth(){
    try{
      if (el.adminStatus) el.adminStatus.textContent = "…";
      const ym = el.adminYm?.value || thisYm();
      const data = await apiGetAdmin("admin/month", { ym });
      setKpi("month", data, ym);
      renderAdminTable(["dayKey","total","count"], data.daily || []);
      if (el.adminStatus) el.adminStatus.textContent = "OK";
    }catch(err){
      if (el.adminStatus) el.adminStatus.textContent = "ERR";
      alert("Admin error: " + err);
    }
  }

  async function adminCorpByEmp(){
    try{
      if (el.adminStatus) el.adminStatus.textContent = "…";
      const ym = el.adminYm?.value || thisYm();
      const data = await apiGetAdmin("admin/corporateByEmployeeMonth", { ym });
      setKpi("corp-by-emp", { byMethod:{ cash:0,card:0,delivery:0,corporate:0,total:0,count:0 } }, ym);
      renderAdminTable(["employee","total"], data.employees || []);
      if (el.adminStatus) el.adminStatus.textContent = "OK";
    }catch(err){
      if (el.adminStatus) el.adminStatus.textContent = "ERR";
      alert("Admin error: " + err);
    }
  }

  async function adminInventory(){
    try{
      if (el.adminStatus) el.adminStatus.textContent = "…";
      const data = await apiGetAdmin("admin/inventory", {});
      const rows = (data.list || []).map(x=>({ ...x }));
      renderAdminTable(["id","name","cat","track","qty","remainingL","spares","stop"], rows);
      if (el.adminStatus) el.adminStatus.textContent = "OK";
    }catch(err){
      if (el.adminStatus) el.adminStatus.textContent = "ERR";
      alert("Admin error: " + err);
    }
  }

  async function adminStops(){
    try{
      if (el.adminStatus) el.adminStatus.textContent = "…";
      const data = await apiGetAdmin("admin/stops", {});
      renderAdminTable(["id","name","cat","track"], data.stops || []);
      if (el.adminStatus) el.adminStatus.textContent = "OK";
    }catch(err){
      if (el.adminStatus) el.adminStatus.textContent = "ERR";
      alert("Admin error: " + err);
    }
  }

  function copyReceipt(){
    if (!cart.length){ alert("Чек пустой."); return; }
    const lines = cart.map(it=>{
      const up = unitPriceFor(it);
      const sum = lineSum(it);
      return `${it.name} — ${it.qtyBase} × ${money(up)} = ${money(sum)}`;
    });
    lines.push(`Итого: ${money(netTotal())} GEL`);
    navigator.clipboard.writeText(lines.join("\n")).then(()=>alert("Скопировано ✅"));
  }

  function clearCart(){
    if (!confirm("Очистить чек?")) return;
    cart = [];
    renderCart();
  }

  async function refreshState(){
    try{
      if (el.syncStatus) el.syncStatus.textContent = "…";
      const st = await apiGet("state",{});
      applyStateToUI(st);
    }catch(err){
      if (el.syncStatus) el.syncStatus.textContent = "ERR";
      alert("Ошибка обновления: " + err);
    }
  }

  // ---- EVENTS ----
  document.querySelectorAll(".tab").forEach(b=>{
    b.addEventListener("click", ()=>setTab(b.dataset.tab));
  });

  if (el.search){
    el.search.addEventListener("input", ()=>{
      showSuggest(suggest(el.search.value));
    });

    el.search.addEventListener("keydown", (e)=>{
      if (e.key==="Escape"){ hideSuggest(); return; }
      if (!suggestItems.length) return;

      if (e.key==="ArrowDown"){
        e.preventDefault();
        setActiveSuggest(Math.min(suggestItems.length-1, activeSuggestIndex+1));
      }
      if (e.key==="ArrowUp"){
        e.preventDefault();
        setActiveSuggest(Math.max(0, activeSuggestIndex-1));
      }
      if (e.key==="Enter"){
        e.preventDefault();
        const i = activeSuggestIndex>=0 ? activeSuggestIndex : 0;
        pickSuggest(i);
      }
    });
  }

  if (el.qtyMinus) el.qtyMinus.addEventListener("click", ()=> setQtyInput(Math.max(0.01, Math.round((getQtyInput()-1)*100)/100)));
  if (el.qtyPlus)  el.qtyPlus.addEventListener("click", ()=> setQtyInput(Math.round((getQtyInput()+1)*100)/100));

  if (el.addBtn) el.addBtn.addEventListener("click", ()=>{
    const items = suggest(el.search?.value || "");
    if (!items.length){ alert("Не найдено."); return; }
    addToCart(items[0].id);
    if (el.search) el.search.value = "";
    hideSuggest();
  });

  if (el.cashBtn) el.cashBtn.addEventListener("click", async ()=>{ setPayment("cash"); await pay(); });
  if (el.cardBtn) el.cardBtn.addEventListener("click", async ()=>{ setPayment("card"); await pay(); });
  if (el.deliveryBtn) el.deliveryBtn.addEventListener("click", async ()=>{ setPayment("delivery"); await pay(); });
  if (el.corpBtn) el.corpBtn.addEventListener("click", corporatePayFlow);

  if (el.discountBtn) el.discountBtn.addEventListener("click", setCustomerDiscount);
  if (el.discountClearBtn) el.discountClearBtn.addEventListener("click", clearDiscounts);

  if (el.copyBtn) el.copyBtn.addEventListener("click", copyReceipt);
  if (el.clearBtn) el.clearBtn.addEventListener("click", clearCart);
  if (el.closeShiftBtn) el.closeShiftBtn.addEventListener("click", closeShift);

  if (el.refreshBtn) el.refreshBtn.addEventListener("click", refreshState);

  if (el.adminDayBtn) el.adminDayBtn.addEventListener("click", adminDay);
  if (el.adminMonthBtn) el.adminMonthBtn.addEventListener("click", adminMonth);
  if (el.adminEmpBtn) el.adminEmpBtn.addEventListener("click", adminCorpByEmp);
  if (el.adminInvBtn) el.adminInvBtn.addEventListener("click", adminInventory);
  if (el.adminStopsBtn) el.adminStopsBtn.addEventListener("click", adminStops);
  if (el.adminLogoutBtn) el.adminLogoutBtn.addEventListener("click", ()=>{
    sessionStorage.removeItem("banka_admin_password");
    alert("Вышли ✅");
    showAdmin(false);
  });

  if (el.adminSearch) el.adminSearch.addEventListener("input", ()=>filterAdminTable(el.adminSearch.value));
  if (el.adminExportBtn) el.adminExportBtn.addEventListener("click", exportAdminCsv);

  // ---- INIT ----
  (async function init(){
    if (!API_URL || !API_TOKEN){
      alert("В batumi.html не заполнен CITY_CONFIG.apiUrl или apiToken");
      return;
    }
    if (el.adminDate) el.adminDate.value = todayKey();
    if (el.adminYm) el.adminYm.value = thisYm();

    try{
      setPayment("cash");
      await refreshState();
    }catch(err){
      alert("Init error: " + err);
    }
  })();
})();
