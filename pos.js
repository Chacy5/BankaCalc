/**********************
 * BANKA POS (frontend)
 * Split version: assets/pos.js
 * Requires: window.CITY_CONFIG
 **********************/
(function () {
  const CFG = window.CITY_CONFIG || {};
  const API_URL   = String(CFG.apiUrl || "");
  const API_TOKEN = String(CFG.apiToken || "");
  const EMPLOYEES = Array.isArray(CFG.employees) ? CFG.employees : ["Ви","Виталий","Зура","Джули"];

  if (!API_URL || !API_TOKEN) {
    alert("Нет CITY_CONFIG.apiUrl / apiToken");
  }

  const MAIN_CATS = ["Все","Краны","Тара","Бутылки/Банки","Рыба","Снеки","Мясо","Чипсы"];
  const BOTTLE_SUB = ["Медовухи","Безалкогольные","IPA/APA","Классика","Темное","Пшеничка","Sour/Gose/Cider"];
  const SUB_SET = new Set(BOTTLE_SUB.map(x=>x.toLowerCase()));

  let corporateEmployee = "";
  let discountPercent = 0;
  let employeeDiscountPercent = 0;

  function money(n){
    const x = Math.round((Number(n)||0)*100)/100;
    return x.toLocaleString("ru-RU",{minimumFractionDigits:0,maximumFractionDigits:2});
  }
  function normalize(s){ return String(s||"").toLowerCase().replaceAll("ё","е").trim(); }
  function esc(s){
    return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }
  function uuid(){
    return (crypto.randomUUID && crypto.randomUUID()) || (Date.now()+"-"+Math.random().toString(16).slice(2));
  }
  function parseNum(x){
    if (x===null || x===undefined) return NaN;
    return Number(String(x).replace(",", ".").trim());
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

  async function apiGet(path, params={}){
    const qs = new URLSearchParams({ path, token: API_TOKEN, ...params });
    const res = await fetch(`${API_URL}?${qs.toString()}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "API error");
    return data;
  }

  async function apiPost(body){
    const qs = new URLSearchParams({ token: API_TOKEN });
    const res = await fetch(`${API_URL}?${qs.toString()}`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "API error");
    return data;
  }

  async function apiGetAdmin(path, params={}){
    const adminPassword = sessionStorage.getItem("banka_admin_password") || "";
    const qs = new URLSearchParams({ path, token: API_TOKEN, adminPassword, ...params });
    const res = await fetch(`${API_URL}?${qs.toString()}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Admin API error");
    return data;
  }

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
    menuTabBtn: document.getElementById("menuTabBtn"),
    menuTab: document.getElementById("menuTab"),
    stopTab: document.getElementById("stopTab"),
    catBar: document.getElementById("catBar"),
    subBar: document.getElementById("subBar"),
    quickGrid: document.getElementById("quickGrid"),
    stopCount: document.getElementById("stopCount"),
    stopCatBar: document.getElementById("stopCatBar"),
    stopSubBar: document.getElementById("stopSubBar"),
    stopList: document.getElementById("stopList"),

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
  };

  // city label
  if (el.cityTitle) el.cityTitle.textContent = String(CFG.cityName || "Батуми");

  // --------- STATE ----------
  let state = null;
  let catalog = [];
  let stopSet = new Set();

  let paymentMethod = "cash";
  let cart = [];

  let suggestItems = [];
  let activeSuggestIndex = -1;

  let catFilter = "Все";
  let bottleSub = "IPA/APA";
  let stopCatFilter = "Все";
  let stopBottleSub = "IPA/APA";

  // --- LOADING (Fix #1) ---
  function setLoading(on, text){
    if (!el.loadingOverlay) return;
    el.loadingOverlay.style.display = on ? "flex" : "none";
    const t = el.loadingOverlay.querySelector(".loadingText");
    if (t) t.textContent = text || (on ? "Загрузка…" : "");
    // disable pay buttons while loading
    const dis = !!on;
    [el.cashBtn, el.cardBtn, el.deliveryBtn, el.corpBtn].forEach(b=>{
      if (b) b.disabled = dis;
    });
  }

  function mapCategoryFromSheet(p){
    // оставить как в твоей версии: cat уже приходит из Sheet
    return String(p.cat || "").trim() || "Другое";
  }

  function normalizeProduct(p){
    const cat = mapCategoryFromSheet(p);
    return {
      id: normalize(p.id),
      name: String(p.name||"").trim(),
      cat,
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
    el.syncStatus.textContent = "OK";
    renderCats();
    renderSubcats();
    renderQuickGrid();
    renderStopList();
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

    if (!suggestItems.length){
      hideSuggest();
      return;
    }
    el.suggest.style.display = "";
    el.suggest.innerHTML = suggestItems.map((p,i)=>(
      `<div class="suggestItem" data-i="${i}">
        <div><b>${esc(p.name)}</b></div>
        <small>${esc(p.cat)} • ${money(p.price)} GEL</small>
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
    el.suggest.style.display = "none";
    el.suggest.innerHTML = "";
    suggestItems = [];
    activeSuggestIndex = -1;
  }

  function setActiveSuggest(i){
    activeSuggestIndex = i;
    const nodes = el.suggest.querySelectorAll(".suggestItem");
    nodes.forEach((n,idx)=>n.classList.toggle("active", idx===i));
    if (nodes[i]) nodes[i].scrollIntoView({block:"nearest"});
  }

  function pickSuggest(i){
    const p = suggestItems[i];
    if (!p) return;
    addToCart(p.id);
    el.search.value = "";
    hideSuggest();
  }

  function getQtyInput(){
    const v = parseNum(el.qtyAdd.value);
    if (!Number.isFinite(v) || v<=0) return 1;
    return v;
  }
  function setQtyInput(v){
    el.qtyAdd.value = String(v);
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

    // stop protection for quick grid & suggest
    if (stopSet.has(pid)){
      alert("Этот товар на стопе.");
      return;
    }

    // pricing qty vs base qty depending on track
    // count: qtyBase = q, qtyPricing = q
    // liters: qtyBase = q (литры), qtyPricing = q
    // keg: qtyBase = q (литры), qtyPricing = q
    const track = String(p.track||"count").toLowerCase();
    const qtyBase = q;

    // merge if same product and same unit
    const idx = cart.findIndex(x=>x.productId===pid);
    if (idx>=0){
      cart[idx].qtyBase = Math.round((cart[idx].qtyBase + qtyBase)*100)/100;
    } else {
      cart.push({
        productId: pid,
        name: p.name,
        cat: p.cat,
        type: p.type,
        track: p.track,
        price: p.price,
        deliveryPrice: p.deliveryPrice,
        qtyBase: qtyBase,
      });
    }
    renderCart();
  }

  function unitPriceFor(item){
    // Fix #4: delivery must use deliveryPrice (if set)
    if (paymentMethod === "delivery"){
      const dp = item.deliveryPrice;
      if (dp !== "" && dp !== null && dp !== undefined && Number.isFinite(Number(dp)) && Number(dp) > 0) return Number(dp);
    }
    return item.price;
  }

  function qtyPricingFor(item){
    // right now pricing is per qtyBase for everything
    return Number(item.qtyBase || 0);
  }

  function lineSum(item){
    return Math.round(unitPriceFor(item) * qtyPricingFor(item) * 100) / 100;
  }

  function grossTotal(){
    return Math.round(cart.reduce((s,it)=>s+lineSum(it),0)*100)/100;
  }

  function discountAmount(){
    const gross = grossTotal();
    const cust = Math.max(0, Math.min(100, Number(discountPercent||0)));
    const emp = Math.max(0, Math.min(100, Number(employeeDiscountPercent||0)));
    const totalDisc = Math.max(cust, emp); // как и раньше: берём максимум (можно поменять позже)
    return Math.round(gross * (totalDisc/100) * 100) / 100;
  }

  function netTotal(){
    const net = grossTotal() - discountAmount();
    return Math.round(net*100)/100;
  }

  function renderCart(){
    // маленькая оптимизация: строим строку один раз
    el.itemsCount.textContent = String(cart.length);
    el.grandTotal.textContent = money(netTotal());

    el.discountLabel.textContent = `${Number(discountPercent||0)}%`;
    el.discountEmpLabel.textContent = `${Number(employeeDiscountPercent||0)}%`;
    el.empDiscountPill.style.display = employeeDiscountPercent>0 ? "" : "none";

    el.cartBody.innerHTML = cart.map((it,idx)=>{
      const up = unitPriceFor(it);
      const sum = lineSum(it);
      return `<div class="trow" data-i="${idx}">
        <div>
          <div style="font-weight:850">${esc(it.name)}</div>
          <div style="font-size:12px;opacity:.7">${esc(it.cat)} • ${paymentMethod==="delivery" ? "доставка" : "обычно"}</div>
        </div>
        <div class="right">
          <input class="qtyInp" value="${esc(String(it.qtyBase))}" inputmode="decimal" />
        </div>
        <div class="right">${money(up)}</div>
        <div class="right"><b>${money(sum)}</b></div>
        <div class="right"><button class="btn ghost delBtn" title="Удалить">✕</button></div>
      </div>`;
    }).join("");

    // bind row actions
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
    el.catBar.innerHTML = MAIN_CATS.map(c=>(
      `<div class="chip ${c===catFilter?'active':''}" data-c="${esc(c)}">${esc(c)}</div>`
    )).join("");
    el.catBar.querySelectorAll(".chip").forEach(ch=>{
      ch.addEventListener("click", ()=>{
        catFilter = ch.dataset.c;
        renderQuickGrid();
      });
    });

    // stop cats same
    el.stopCatBar.innerHTML = MAIN_CATS.map(c=>(
      `<div class="chip ${c===stopCatFilter?'active':''}" data-c="${esc(c)}">${esc(c)}</div>`
    )).join("");
    el.stopCatBar.querySelectorAll(".chip").forEach(ch=>{
      ch.addEventListener("click", ()=>{
        stopCatFilter = ch.dataset.c;
        renderStopList();
      });
    });
  }

  function renderSubcats(){
    el.subBar.innerHTML = BOTTLE_SUB.map(c=>(
      `<div class="chip ${c===bottleSub?'active':''}" data-c="${esc(c)}">${esc(c)}</div>`
    )).join("");
    el.subBar.querySelectorAll(".chip").forEach(ch=>{
      ch.addEventListener("click", ()=>{
        bottleSub = ch.dataset.c;
        renderQuickGrid();
      });
    });

    el.stopSubBar.innerHTML = BOTTLE_SUB.map(c=>(
      `<div class="chip ${c===stopBottleSub?'active':''}" data-c="${esc(c)}">${esc(c)}</div>`
    )).join("");
    el.stopSubBar.querySelectorAll(".chip").forEach(ch=>{
      ch.addEventListener("click", ()=>{
        stopBottleSub = ch.dataset.c;
        renderStopList();
      });
    });
  }

  function passesFilters(p){
    if (catFilter !== "Все" && p.cat !== catFilter) return false;

    // подкатегории только для "Бутылки/Банки"
    if (catFilter === "Бутылки/Банки" || p.cat === "Бутылки/Банки"){
      // ищем саб-кат по имени (как было у тебя)
      const n = normalize(p.name);
      const hasSub = [...SUB_SET].some(s=>n.includes(s));
      if (hasSub){
        if (!normalize(p.name).includes(normalize(bottleSub))) return false;
      } else {
        // если не распознали саб-кат, не режем
      }
    }
    return true;
  }

  function renderQuickGrid(){
    const items = catalog.filter(p=>passesFilters(p));
    el.quickGrid.innerHTML = items.map(p=>{
      const isStop = stopSet.has(p.id);
      const price = (paymentMethod==="delivery" && p.deliveryPrice!=="") ? p.deliveryPrice : p.price;
      return `<div class="quickBtn ${isStop?'stop':''}" data-id="${esc(p.id)}">
        <div class="quickName">${esc(p.name)}</div>
        <div class="quickMeta">${esc(p.cat)} • ${money(price)} GEL</div>
      </div>`;
    }).join("");

    el.quickGrid.querySelectorAll(".quickBtn").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        if (btn.classList.contains("stop")) return;
        addToCart(btn.dataset.id);
      });
    });
  }

  function renderStopList(){
    const stops = catalog.filter(p=>stopSet.has(p.id));
    const filtered = stops.filter(p=>{
      if (stopCatFilter !== "Все" && p.cat !== stopCatFilter) return false;
      if (p.cat === "Бутылки/Банки"){
        if (!normalize(p.name).includes(normalize(stopBottleSub))) return false;
      }
      return true;
    });

    el.stopCount.textContent = String(filtered.length);
    el.stopList.innerHTML = filtered.map(p=>(
      `<div class="stopItem">
        <div class="name">${esc(p.name)}</div>
        <div class="meta">${esc(p.cat)}</div>
      </div>`
    )).join("");
  }

  function setPayment(m){
    paymentMethod = m;
    el.payModeLabel.textContent = m;
    renderQuickGrid();
    renderCart();
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

  // Fix #3: employee discount вводится после "Корпоративная"
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

    // Скидка персоналу — теперь тут, после корпоративной
    const empDisc = prompt("Скидка персоналу (%)? (0..100, можно 0)", String(employeeDiscountPercent||0));
    if (empDisc === null) return; // если отменили — ничего не пробиваем
    const d = parseNum(empDisc);
    if (!Number.isFinite(d) || d<0 || d>100) { alert("Нужно число 0..100"); return; }
    employeeDiscountPercent = Math.round(d);

    setPayment("corporate");
    await pay();
  }

  // Fix #2: после пробития сбрасываем не только чек, но и фильтры/поиск/скидки/режим/сабкаты и т.п.
  function resetAfterSale(){
    cart = [];
    corporateEmployee = "";
    clearDiscounts();

    // reset UI "links" / selections
    catFilter = "Все";
    bottleSub = "IPA/APA";
    stopCatFilter = "Все";
    stopBottleSub = "IPA/APA";

    el.search.value = "";
    hideSuggest();
    setQtyInput(1);

    setPayment("cash"); // вернём дефолт

    renderCats();
    renderSubcats();
    renderQuickGrid();
    renderCart();
  }

  async function pay(){
    if (!cart.length){
      alert("Чек пустой.");
      return;
    }

    // Fix #1: loading overlay
    setLoading(true, "Пробиваю чек…");

    const receiptId = uuid();
    const items = cart.map(it=>({
      productId: it.productId,
      qtyBase: Number(it.qtyBase||0),
      displayUnit: "", // backend хранит для отчетов
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
      el.syncStatus.textContent = "…";
      let res = await apiPost(payload);

      // backend защищён от двойного списания по receiptId — оставляем как было
      if (res.kegUpdated && res.kegUpdated.length){
        const switches = buildKegSwitchesFromServer(res);
        if (Object.keys(switches).length){
          payload.kegSwitches = switches;
          res = await apiPost(payload);
        }
      }

      if (res.lowWarnings && res.lowWarnings.length){
        const lines = res.lowWarnings.map(x => `${x.name} осталось ${x.remaining} ${x.unit}. Отключите этот товар в доставке`);
        alert(lines.join("\n"));
      }

      applyStateToUI(res.state);

      const msg = (paymentMethod==="corporate")
        ? `Корпоративный — ${corporateEmployee}: ${money(net)} GEL`
        : `Пробито ✅ Сумма: ${money(net)} GEL`;

      resetAfterSale();
      alert(msg);

    }catch(err){
      el.syncStatus.textContent = "ERR";
      alert("Ошибка при пробитии: " + err);
    }finally{
      setLoading(false);
    }
  }

  function buildKegSwitchesFromServer(res){
    // как в твоей версии: спрашиваем доп.литры с нового кега при автопереключении
    const switches = {};
    (res.kegUpdated||[]).forEach(k=>{
      const v = prompt(`Переключили кег: ${k.name}\nСколько литров налили уже из нового кега ДО пробития?`, "0");
      if (v === null) return;
      const n = parseNum(v);
      if (Number.isFinite(n) && n>0) switches[k.id] = n;
    });
    return switches;
  }

  async function closeShift(){
    try{
      const data = await apiGet("shiftSummary", { date: todayKey() });
      alert(
        `Смена за ${data.dayKey}\n\n` +
        `Наличные: ${money(data.cash)} GEL\n` +
        `Карта: ${money(data.card)} GEL\n` +
        `Доставка: ${money(data.delivery)} GEL\n` +
        `Корпоративный: ${money(data.corporate)} GEL\n\n` +
        `ИТОГО: ${money(data.total)} GEL\n` +
        `Чеков: ${data.count}`
      );
    }catch(err){
      alert("Ошибка: " + err);
    }
  }

  // -------- ADMIN TABLE RENDER --------
  let adminCurrentRows = [];
  let adminCurrentCols = [];

  function showAdmin(on){
    el.posWrap.style.display = on ? "none" : "";
    el.adminPanel.style.display = on ? "" : "none";
    el.tabPos.classList.toggle("active", !on);
    el.tabAdmin.classList.toggle("active", on);
  }

  function setTab(t){
    if (t==="admin"){
      const pass = sessionStorage.getItem("banka_admin_password") || "";
      if (!pass){
        const p = prompt("Пароль админа:", "");
        if (p===null) { showAdmin(false); return; }
        sessionStorage.setItem("banka_admin_password", String(p));
      }
      showAdmin(true);
      return;
    }
    showAdmin(false);
  }

  function setKpi(mode, data, periodText){
    el.kpiMode.textContent = mode || "—";
    el.kpiPeriod.textContent = periodText || "—";

    if (data && data.byMethod){
      el.kpiCash.textContent = money(data.byMethod.cash);
      el.kpiCard.textContent = money(data.byMethod.card);
      el.kpiDelivery.textContent = money(data.byMethod.delivery);
      el.kpiCorp.textContent = money(data.byMethod.corporate);
      el.kpiTotal.textContent = money(data.byMethod.total);
      el.kpiCount.textContent = String(data.byMethod.count);
      return;
    }

    // day-like
    if (data){
      el.kpiCash.textContent = money(data.cash||0);
      el.kpiCard.textContent = money(data.card||0);
      el.kpiDelivery.textContent = money(data.delivery||0);
      el.kpiCorp.textContent = money(data.corporate||0);
      el.kpiTotal.textContent = money(data.total||0);
      el.kpiCount.textContent = String(data.count||0);
    }
  }

  function renderAdminTable(cols, rows){
    adminCurrentCols = cols || [];
    adminCurrentRows = rows || [];

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
      el.adminStatus.textContent = "…";
      const date = el.adminDate.value || todayKey();
      const data = await apiGetAdmin("admin/day", { date });
      setKpi("day", data, date);
      // daily show simple table
      renderAdminTable(
        ["dayKey","cash","card","delivery","corporate","total","count"],
        [data]
      );
      el.adminStatus.textContent = "OK";
    }catch(err){
      el.adminStatus.textContent = "ERR";
      alert("Admin error: " + err);
    }
  }

  async function adminMonth(){
    try{
      el.adminStatus.textContent = "…";
      const ym = el.adminYm.value || thisYm();
      const data = await apiGetAdmin("admin/month", { ym });
      setKpi("month", data, ym);

      renderAdminTable(
        ["dayKey","total","count"],
        data.daily || []
      );
      el.adminStatus.textContent = "OK";
    }catch(err){
      el.adminStatus.textContent = "ERR";
      alert("Admin error: " + err);
    }
  }

  async function adminCorpByEmp(){
    try{
      el.adminStatus.textContent = "…";
      const ym = el.adminYm.value || thisYm();
      const data = await apiGetAdmin("admin/corporateByEmployeeMonth", { ym });
      setKpi("corp-by-emp", { byMethod:{ cash:0,card:0,delivery:0,corporate:0,total:0,count:0 } }, ym);
      renderAdminTable(["employee","total"], data.employees || []);
      el.adminStatus.textContent = "OK";
    }catch(err){
      el.adminStatus.textContent = "ERR";
      alert("Admin error: " + err);
    }
  }

  async function adminInventory(){
    try{
      el.adminStatus.textContent = "…";
      const data = await apiGetAdmin("admin/inventory", {});
      const rows = (data.list || []).map(x=>{
        const out = {...x};
        // нормализуем поля для таблицы
        if (out.track==="keg"){
          out.qty = "";
          out.remainingL = Number(out.remainingL||0);
          out.spares = Number(out.spares||0);
        }
        return out;
      });
      renderAdminTable(["id","name","cat","track","qty","remainingL","spares","stop"], rows);
      el.adminStatus.textContent = "OK";
    }catch(err){
      el.adminStatus.textContent = "ERR";
      alert("Admin error: " + err);
    }
  }

  async function adminStops(){
    try{
      el.adminStatus.textContent = "…";
      const data = await apiGetAdmin("admin/stops", {});
      renderAdminTable(["id","name","cat","track"], data.stops || []);
      el.adminStatus.textContent = "OK";
    }catch(err){
      el.adminStatus.textContent = "ERR";
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
      el.syncStatus.textContent = "…";
      const st = await apiGet("state",{});
      applyStateToUI(st);
    }catch(err){
      el.syncStatus.textContent = "ERR";
      alert("Ошибка обновления: " + err);
    }
  }

  // -------- EVENTS --------
  document.querySelectorAll(".tab").forEach(b=>{
    b.addEventListener("click", ()=>setTab(b.dataset.tab));
  });

  el.search.addEventListener("input", ()=>{
    const items = suggest(el.search.value);
    showSuggest(items);
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

  el.qtyMinus.addEventListener("click", ()=>{
    const v = Math.max(0.01, Math.round((getQtyInput()-1)*100)/100);
    setQtyInput(v);
  });
  el.qtyPlus.addEventListener("click", ()=>{
    const v = Math.round((getQtyInput()+1)*100)/100;
    setQtyInput(v);
  });

  el.addBtn.addEventListener("click", ()=>{
    const items = suggest(el.search.value);
    if (!items.length){
      alert("Не найдено.");
      return;
    }
    addToCart(items[0].id);
    el.search.value = "";
    hideSuggest();
  });

  el.cashBtn.addEventListener("click", async ()=>{ setPayment("cash"); await pay(); });
  el.cardBtn.addEventListener("click", async ()=>{ setPayment("card"); await pay(); });
  el.deliveryBtn.addEventListener("click", async ()=>{ setPayment("delivery"); await pay(); });
  el.corpBtn.addEventListener("click", corporatePayFlow);

  el.discountBtn.addEventListener("click", setCustomerDiscount);
  el.discountClearBtn.addEventListener("click", clearDiscounts);

  el.copyBtn.addEventListener("click", copyReceipt);
  el.clearBtn.addEventListener("click", clearCart);
  el.closeShiftBtn.addEventListener("click", closeShift);

  el.refreshBtn.addEventListener("click", refreshState);
  if (el.menuTabBtn) el.menuTabBtn.addEventListener("click", ()=>{ el.stopTab.style.display="none"; });

  // admin
  el.adminDayBtn.addEventListener("click", adminDay);
  el.adminMonthBtn.addEventListener("click", adminMonth);
  el.adminEmpBtn.addEventListener("click", adminCorpByEmp);
  el.adminInvBtn.addEventListener("click", adminInventory);
  el.adminStopsBtn.addEventListener("click", adminStops);
  el.adminLogoutBtn.addEventListener("click", ()=>{
    sessionStorage.removeItem("banka_admin_password");
    alert("Вышли ✅");
    showAdmin(false);
  });

  el.adminSearch.addEventListener("input", ()=>filterAdminTable(el.adminSearch.value));
  el.adminExportBtn.addEventListener("click", exportAdminCsv);

  // init defaults
  el.adminDate.value = todayKey();
  el.adminYm.value = thisYm();

  // -------- INIT --------
  (async function init(){
    try{
      localStorage.setItem("banka_city", String(CFG.cityKey || "batumi"));
      await refreshState();
      renderCats();
      renderSubcats();
      setPayment("cash");
    }catch(err){
      alert("Init error: " + err);
    }
  })();
})();