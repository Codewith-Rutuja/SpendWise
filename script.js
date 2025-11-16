/* SpendWise JS with:
   - Line time-series chart (daily spend)
   - Auto-category suggestions by keywords
   - Confetti + Smart Choice badge on planner approval
   - Existing features preserved (add/edit/delete/undo/planner)
*/

let income = 0;
let expenses = [];
let pieChart = null;
let timeChart = null;
let editingIndex = -1;
let lastDeleted = null;
let undoTimeoutId = null;
const UNDO_DURATION = 6000; // ms

const currency = (v) => (Number.isInteger(v) ? `₹${v}` : `₹${v.toFixed(2)}`);

/* ---------- Keyword map for auto-suggestion ----------
   Simple rule-based keywords -> category.
   Add more entries as needed.
*/
const KEYWORD_MAP = {
  food: ["zomato", "swiggy", "dominos", "pizza", "restaurant", "cafe", "canteen", "meal", "burger"],
  transport: ["uber", "ola", "auto", "taxi", "bus", "fuel", "petrol", "metro", "train"],
  shopping: ["amazon", "myntra", "flipkart", "shopping", "clothes", "shoe", "shirt"],
  bills: ["netflix", "spotify", "electricity", "water", "bill", "mobile", "internet", "rent"],
  other: ["gift", "misc", "other", "fee", "donation"]
};

function guessCategoryFromName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const [cat, keys] of Object.entries(KEYWORD_MAP)) {
    for (const k of keys) {
      if (lower.includes(k)) {
        // map key category string to our select value wording
        if (cat === "food") return "Food";
        if (cat === "transport") return "Transport";
        if (cat === "shopping") return "Shopping";
        if (cat === "bills") return "Bills";
        return "Other";
      }
    }
  }
  return null;
}

/* ---------- UI helpers ---------- */
function $(id) { return document.getElementById(id); }

/* ---------- Data persistence ---------- */
function saveData() {
  localStorage.setItem("income", JSON.stringify(income));
  localStorage.setItem("expenses", JSON.stringify(expenses));
}
function loadData() {
  income = JSON.parse(localStorage.getItem("income")) || 0;
  expenses = JSON.parse(localStorage.getItem("expenses")) || [];
}

/* ---------- Income & UI ---------- */
function setIncome() {
  const newIncome = parseFloat($("monthly-income").value);
  
  if (isNaN(newIncome) || newIncome < 0) {
    alert("Please enter a valid income amount");
    return;
  }

  income = newIncome; // ✅ Replace instead of add
  saveData();         // ✅ Save to localStorage
  updateUI();         // ✅ Update displayed balance

  $("monthly-income").value = ""; // Clear field
}


function setDefaultMonthFilter() {
  const mf = $("month-filter");
  if (!mf.value) {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    mf.value = `${now.getFullYear()}-${mm}`;
  }
}

function updateUI() {
  setDefaultMonthFilter();
  const selectedMonth = $("month-filter").value;
  const filtered = selectedMonth ? filterExpensesByMonth(selectedMonth) : expenses;
  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);

  $("income-display").textContent = `Income: ${currency(income)}`;
  $("total-expenses-display").textContent = `Total Expenses: ${currency(totalExpenses)}`;
  $("balance-display").textContent = `Balance: ${currency(income - totalExpenses)}`;

  populateList(filtered);
  updateCategorySummary(filtered);
  renderPieChart(filtered);
  renderTimeChart(selectedMonth, filtered); // time-series
  $("monthly-income").value = income || "";
}

/* ---------- Expense list & edit/delete/undo ---------- */
function populateList(expensesArr) {
  const list = document.getElementById("expense-list");
  list.innerHTML = "";

  expensesArr.slice().reverse().forEach(exp => {
    const li = document.createElement("li");
    li.className = "expense-item";

    li.innerHTML = `
      <div class="expense-left">
        <div class="expense-meta">
          <div class="expense-name">${exp.name}</div>
          <div class="expense-info">${currency(exp.amount)} • ${exp.category} • ${new Date(exp.timestamp).toLocaleDateString()}</div>
        </div>
      </div>
      <div class="inline-actions">
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
      </div>
    `;

    // Edit button
    li.querySelector(".edit-btn").addEventListener("click", () => openEditModal(exp));

    // Delete button
    li.querySelector(".delete-btn").addEventListener("click", () => {
      if(!confirm(`Are you sure you want to delete "${exp.name}"?`)) return;
      const index = expenses.findIndex(e => e.timestamp === exp.timestamp);
      if(index !== -1) {
        expenses.splice(index, 1); // remove from array
        saveData();               // update localStorage
        populateList(expenses);   // refresh list
        updateUI();               // update totals, charts, summary
      }
    });

    list.appendChild(li);
  });
}

/* Delete with undo */
function handleDelete(expense) {
  const index = expenses.findIndex(it => it.timestamp === expense.timestamp && it.name === expense.name && it.amount === expense.amount);
  if (index === -1) return;
  const removed = expenses.splice(index, 1)[0];
  lastDeleted = { item: removed, index, deletedAt: Date.now() };
  saveData();
  updateUI();
  showUndoToast(`${removed.name} removed`, UNDO_DURATION);
  if (undoTimeoutId) clearTimeout(undoTimeoutId);
  undoTimeoutId = setTimeout(() => { lastDeleted = null; hideUndoToast(); undoTimeoutId = null; }, UNDO_DURATION);
}

/* Undo toast logic */
const undoToast = $("undo-toast"), undoMsg = document.querySelector(".undo-msg");
$("undo-button").addEventListener("click", () => {
  if (!lastDeleted) return;
  const idx = Math.min(Math.max(0, lastDeleted.index), expenses.length);
  expenses.splice(idx, 0, lastDeleted.item);
  lastDeleted = null;
  if (undoTimeoutId) { clearTimeout(undoTimeoutId); undoTimeoutId = null; }
  saveData(); updateUI(); hideUndoToast();
});
$("undo-dismiss").addEventListener("click", () => { lastDeleted = null; if (undoTimeoutId) { clearTimeout(undoTimeoutId); undoTimeoutId=null; } hideUndoToast(); });

function showUndoToast(message) {
  if (!undoToast) return;
  undoMsg.textContent = message;
  undoToast.hidden = false;
  undoToast.classList.add("show");
}
function hideUndoToast() {
  if (!undoToast) return;
  undoToast.classList.remove("show");
  setTimeout(() => { undoToast.hidden = true; }, 320);
}

/* ---------- Edit modal ---------- */
function openEditModal(expense) {
  editingIndex = expenses.findIndex(it => it.timestamp === expense.timestamp && it.name === expense.name && it.amount === expense.amount);
  if (editingIndex === -1) return;
  $("edit-name").value = expenses[editingIndex].name;
  $("edit-amount").value = expenses[editingIndex].amount;
  $("edit-category").value = expenses[editingIndex].category;
  $("edit-modal").setAttribute("aria-hidden", "false");
}
function closeEditModal() {
  $("edit-modal").setAttribute("aria-hidden", "true");
  editingIndex = -1;
}
$("edit-cancel").addEventListener("click", closeEditModal);
$("edit-close").addEventListener("click", closeEditModal);
$("edit-form").addEventListener("submit", function(e) {
  e.preventDefault();
  if (editingIndex === -1) return;
  const newName = $("edit-name").value.trim();
  const newAmount = parseFloat($("edit-amount").value);
  const newCategory = $("edit-category").value;
  if (!newName || isNaN(newAmount) || !newCategory) return;
  expenses[editingIndex].name = newName;
  expenses[editingIndex].amount = parseFloat(newAmount);
  expenses[editingIndex].category = newCategory;
  saveData(); updateUI(); closeEditModal();
});

/* ---------- Category summary & pie chart ---------- */
function updateCategorySummary(filtered) {
  const summary = {};
  filtered.forEach(({category, amount}) => { summary[category] = (summary[category]||0) + amount; });
  const summaryDiv = $("category-summary");
  if (Object.keys(summary).length === 0) { summaryDiv.innerHTML = "<p>No expenses for selected month.</p>"; return; }
  summaryDiv.innerHTML = Object.entries(summary).map(([cat, amt]) => `<p>${cat}: ${currency(amt)}</p>`).join("");
}

function renderPieChart(filtered) {
  const categoryTotals = {};
  filtered.forEach(({ category, amount }) => categoryTotals[category] = (categoryTotals[category]||0) + amount);
  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);
  const ctx = $("expense-chart").getContext("2d");
  if (pieChart) { pieChart.destroy(); pieChart = null; }
  if (labels.length === 0) {
    pieChart = new Chart(ctx, { type: 'pie', data: { labels: ['No Data'], datasets:[{ data: [1] }] }, options: { responsive:true, maintainAspectRatio:false } });
    return;
  }
  const bg = ['#00796b','#004d40','#26a69a','#80cbc4','#b2dfdb','#a7ffeb','#4db6ac'];
  pieChart = new Chart(ctx, { type:'pie', data:{ labels, datasets:[{ data, backgroundColor: labels.map((_,i)=>bg[i%bg.length]) }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} } });
}

/* ---------- Time-series (daily) chart ---------- */
function getDailyTotalsForMonth(monthStr, expensesArr) {
  // monthStr = "YYYY-MM"
  if (!monthStr) return [];
  const [year, month] = monthStr.split("-").map(s => parseInt(s,10));
  const daysInMonth = new Date(year, month, 0).getDate();
  const totals = Array(daysInMonth).fill(0);
  expensesArr.forEach(e => {
    const d = new Date(e.timestamp);
    if (d.getFullYear() === year && (d.getMonth()+1) === month) {
      totals[d.getDate()-1] += e.amount;
    }
  });
  return totals;
}

function renderTimeChart(monthStr, filteredExpenses) {
  const ctx = $("time-chart").getContext("2d");
  if (timeChart) { timeChart.destroy(); timeChart = null; }
  if (!monthStr) {
    // draw empty placeholder
    timeChart = new Chart(ctx, { type:'line', data:{ labels:[], datasets:[] }, options:{ responsive:true, maintainAspectRatio:false }});
    return;
  }
  const totals = getDailyTotalsForMonth(monthStr, expenses);
  const [y,m] = monthStr.split("-");
  const days = totals.length;
  const labels = Array.from({length: days}, (_,i) => `${i+1}`);
  timeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Daily spend',
        data: totals.map(v => +v.toFixed(2)),
        fill: true,
        tension: 0.25,
        borderWidth: 2,
        borderColor: '#00796b',
        backgroundColor: 'rgba(0,121,107,0.08)',
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: 'Day of month' } },
        y: { title: { display: true, text: 'Amount (₹)' }, beginAtZero: true }
      }
    }
  });
}

/* ---------- Adding expenses ---------- */
$("expense-form").addEventListener("submit", function(e){
  e.preventDefault();
  const name = $("expense-name").value.trim();
  const amount = parseFloat($("expense-amount").value);
  const category = $("expense-category").value;
  if (!name || isNaN(amount) || !category) return;
  const newExpense = { name, amount: parseFloat(amount), category, timestamp: new Date().toISOString() };
  expenses.push(newExpense);
  saveData(); updateUI();
  this.reset();
  hideSuggestions();
  $("expense-name").focus();
});

/* ---------- Auto-category suggestions UI ---------- */
const suggestBox = $("category-suggestions");
$("expense-name").addEventListener("input", (e) => {
  const v = e.target.value.trim();
  if (!v) { hideSuggestions(); return; }
  const guess = guessCategoryFromName(v);
  const suggestions = [];
  if (guess) suggestions.push(guess);
  // also show other category quick picks
  ["Food","Transport","Shopping","Bills","Other"].forEach(cat => { if (!suggestions.includes(cat)) suggestions.push(cat); });

  // build suggestion buttons (limit 5)
  suggestBox.innerHTML = suggestions.slice(0,5).map(s => `<button type="button" data-cat="${s}">${s}</button>`).join("");
  suggestBox.hidden = false;
});
suggestBox.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const cat = btn.dataset.cat;
  $("expense-category").value = cat;
  hideSuggestions();
});
document.addEventListener("click", (e) => {
  // click outside suggestion box hides it
  if (!e.target.closest(".field-with-suggest")) hideSuggestions();
});
function hideSuggestions() { suggestBox.innerHTML=''; suggestBox.hidden = true; }

/* ---------- Planner: evaluate, add, badge + confetti ---------- */
const plannerForm = $("planner-form"), plannerResult = $("planner-result");
const plannerAddBtn = $("planner-add-expense"), plannerClearBtn = $("planner-clear");
plannerForm.addEventListener("submit", (e) => { e.preventDefault(); evaluatePlan(); });
plannerAddBtn.addEventListener("click", () => {
  const desc = $("planned-desc").value.trim();
  const amount = parseFloat($("planned-expense").value);
  const category = $("planned-category").value;
  if (!desc || isNaN(amount) || !category) return;
  expenses.push({ name: desc, amount: parseFloat(amount), category, timestamp: new Date().toISOString() });
  saveData(); updateUI();
  plannerAddBtn.disabled = true;
  playConfetti(); // celebrate on add
});
plannerClearBtn.addEventListener("click", () => { plannerForm.reset(); plannerResult.innerHTML = ''; plannerAddBtn.disabled = true; });

function evaluatePlan() {
  const desc = $("planned-desc").value.trim();
  const amount = parseFloat($("planned-expense").value);
  const category = $("planned-category").value;
  const recurring = $("planned-recurring").checked;
  if (!desc || isNaN(amount) || !category) {
    plannerResult.textContent = "Please provide description, amount and category.";
    plannerAddBtn.disabled = true; return;
  }
  const selectedMonth = $("month-filter").value;
  const filtered = selectedMonth ? filterExpensesByMonth(selectedMonth) : expenses;
  const totalExpenses = filtered.reduce((s,e)=>s+e.amount,0);
  const balance = income - totalExpenses;
  const newBalanceOne = balance - amount;
  const pctOfIncome = income > 0 ? (amount / income) * 100 : 0;

  // Build message markup
  const frag = document.createElement("div");
  frag.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;">
      <div style="display:flex; align-items:center; gap:10px;">
        <div><strong>${escapeHtml(desc)}</strong> • ${escapeHtml(category)}</div>
        <div id="planner-badge-container"></div>
      </div>
      <div>Amount: <strong>${currency(amount)}</strong> (${pctOfIncome.toFixed(1)}% of monthly income)</div>
      <div>Current balance: <strong>${currency(balance)}</strong></div>
      <div>After adding once: <strong>${currency(newBalanceOne)}</strong></div>
      ${recurring ? `<div>Recurring monthly (projected): <strong>${currency(income - (totalExpenses + amount))}</strong></div>` : ''}
    </div>
  `;
  plannerResult.innerHTML = "";
  plannerResult.appendChild(frag);

  // success vs caution
  if (newBalanceOne >= 0) {
    plannerResult.style.background = "rgba(200,255,210,0.85)";
    plannerResult.style.color = "#0a6a3f";
    plannerResult.style.border = "1px solid rgba(10,120,70,0.12)";
    plannerAddBtn.disabled = false;
    // show badge and confetti for "approved"
    const badgeWrap = $("planner-badge-container");
    badgeWrap.innerHTML = `<span class="badge">Smart Choice ✓</span>`;
    // small delay so user sees badge then confetti
    setTimeout(() => playConfetti(), 150);
  } else {
    plannerResult.style.background = "rgba(255,220,220,0.9)";
    plannerResult.style.color = "#7a1d1d";
    plannerResult.style.border = "1px solid rgba(180,60,60,0.12)";
    plannerAddBtn.disabled = false; // allow but caution
    $("planner-badge-container").innerHTML = '';
  }

  // animate
  plannerResult.classList.remove("success-flash");
  void plannerResult.offsetWidth;
  plannerResult.classList.add("success-flash");
}

/* ---------- Utility: escape HTML for safety in messages ---------- */
function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------- Filter helpers ---------- */
function filterExpensesByMonth(monthStr) {
  if (!monthStr) return expenses;
  const [year, month] = monthStr.split("-").map(s => parseInt(s,10));
  return expenses.filter(e => { const d = new Date(e.timestamp); return d.getFullYear()===year && (d.getMonth()+1)===month; });
}

/* ---------- Confetti (lightweight, canvas-based) ---------- */
const confettiCanvas = $("confetti-canvas");
const confettiCtx = confettiCanvas.getContext ? confettiCanvas.getContext('2d') : null;
let confettiPieces = [], confettiAniId = null;

function resizeConfettiCanvas(){
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeConfettiCanvas);
resizeConfettiCanvas();

function spawnConfetti(count=60){
  const colors = ['#FFC107','#FF5252','#4CAF50','#18A999','#3F51B5','#FF4081'];
  for(let i=0;i<count;i++){
    confettiPieces.push({
      x: Math.random()*confettiCanvas.width,
      y: Math.random()*-confettiCanvas.height*0.5,
      vx: (Math.random()-0.5)*4,
      vy: 2 + Math.random()*4,
      size: 6 + Math.random()*8,
      rot: Math.random()*360,
      vr: (Math.random()-0.5)*8,
      color: colors[Math.floor(Math.random()*colors.length)],
      ttl: 120 + Math.random()*40
    });
  }
}

function drawConfetti(){
  if (!confettiCtx) return;
  confettiCtx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
  confettiPieces.forEach((p, i)=>{
    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate(p.rot * Math.PI/180);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6);
    confettiCtx.restore();
    // update
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.06; // gravity
    p.rot += p.vr;
    p.ttl--;
  });
  // remove dead
  confettiPieces = confettiPieces.filter(p => p.ttl>0 && p.y < confettiCanvas.height + 50);
  if (confettiPieces.length>0) confettiAniId = requestAnimationFrame(drawConfetti);
  else { cancelAnimationFrame(confettiAniId); confettiAniId = null; confettiCtx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height); }
}

function playConfetti(){
  spawnConfetti(80);
  if (!confettiAniId) drawConfetti();
}

/* ---------- Event wiring & init ---------- */
$("month-filter").addEventListener("change", updateUI);
$("clear-filter").addEventListener("click", () => { $("month-filter").value = ""; updateUI(); });
$("set-income-btn").addEventListener("click", setIncome);

/* expense add handled earlier via form submit */

/* planner wiring done above */

/* ---------- On load ---------- */
window.addEventListener("DOMContentLoaded", () => {
  loadData();
  updateUI();
  setupScrollAnimations();
  // disable planner add initially
  if ($("planner-add-expense")) $("planner-add-expense").disabled = true;
});

/* Simple scroll-in animation */
function setupScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('in-view'); });
  }, { threshold: 0.12 });
  document.querySelectorAll('.animate-on-scroll').forEach(el=>observer.observe(el));
}

/* Scroll-top button */
$("scroll-top").addEventListener("click", ()=>window.scrollTo({ top:0, behavior:'smooth' }));
window.addEventListener("scroll", ()=>{ const btn=$("scroll-top"); btn.style.opacity = window.scrollY>300 ? "1":"0"; btn.style.pointerEvents = window.scrollY>300 ? "auto":"none"; });

/* Ensure charts resize cleanly when window size changes or container style changes */
window.addEventListener('resize', () => {
  // give the browser a moment to update layout, then resize charts
  clearTimeout(window.__spendwise_resize_timer);
  window.__spendwise_resize_timer = setTimeout(() => {
    try {
      if (pieChart) pieChart.resize();
      if (timeChart) timeChart.resize();
    } catch (err) {
      // harmless if chart not created yet
      // console.log('chart resize error', err);
    }
  }, 120);
});
function enableIncomeEdit() {
  const incomeDisplay = $("income-display");
  const currentIncome = income;
  incomeDisplay.innerHTML = `
    <input type="number" id="edit-income" value="${currentIncome}" style="width:120px;">
    <button id="save-income-btn">Save</button>
    <button id="cancel-income-btn">Cancel</button>
  `;

  $("save-income-btn").addEventListener("click", async () => {
    const newIncome = parseFloat($("edit-income").value);
    if(isNaN(newIncome) || newIncome < 0) return alert("Enter valid income");
    await fetch('backend.php?action=set-income', { method:'POST', body: new URLSearchParams({amount: newIncome}) });
    income = newIncome;
    updateUI();
  });

  $("cancel-income-btn").addEventListener("click", updateUI);
}

// Call this when user clicks on income display
$("income-display").addEventListener("click", enableIncomeEdit);

async function loadExpenses() {
  const res = await fetch('backend.php?action=get-expenses');
  const data = await res.json();
  expenses = data;
  updateUI();
}
$("reset-income-btn").addEventListener("click", () => {
  if (confirm("Do you want to reset your income to ₹0?")) {
    income = 0;
    saveData();
    updateUI();
  }
});
window.addEventListener("DOMContentLoaded", () => {

  // your existing loadData() and updateUI() already here
  loadData();
  updateUI();
  
  // ✅ attach reset event here
  const resetButton = document.getElementById("reset-income-btn");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      if (confirm("Do you want to reset income to ₹0 ?")) {
        income = 0;
        saveData();
        updateUI();
      }
    });
  }
});
