// PayCalc — calculator with $2 demo paywall on the answer.

(function () {
  "use strict";

  const STORAGE_KEY = "paycalc:unlocked";
  const PRICE_USD = 2;

  const expressionEl = document.getElementById("expression");
  const resultEl     = document.getElementById("result");
  const resultValueEl= document.getElementById("resultValue");
  const unlockBtn    = document.getElementById("unlockBtn");
  const unlockStatus = document.getElementById("unlockStatus");
  const resetBtn     = document.getElementById("resetBtn");

  const modal          = document.getElementById("paymentModal");
  const payExpression  = document.getElementById("payExpression");
  const payBtn         = document.getElementById("payBtn");
  const revealBtn      = document.getElementById("revealBtn");
  const txnIdEl        = document.getElementById("txnId");
  const progressFill   = document.getElementById("progressFill");

  const stepConfirm    = document.getElementById("stepConfirm");
  const stepProcessing = document.getElementById("stepProcessing");
  const stepSuccess    = document.getElementById("stepSuccess");

  const state = { expression: "", result: null };

  // ── Calculator ──────────────────────────────────────────────

  function setExpression(next) {
    state.expression = next;
    expressionEl.textContent = next || "0";
  }

  function appendValue(value) {
    const last = state.expression.slice(-1);
    const ops  = ["+", "-", "*", "/", "%", "."];
    if (ops.includes(value) && ops.includes(last)) {
      setExpression(state.expression.slice(0, -1) + value);
      return;
    }
    setExpression(state.expression + value);
  }

  function clearAll()  { setExpression(""); setResult(null); }
  function backspace() { setExpression(state.expression.slice(0, -1)); }

  function safeEvaluate(expr) {
    if (!expr || !expr.trim()) return null;
    if (!/^[\d+\-*/().%\s]+$/.test(expr)) throw new Error("Invalid input");
    // eslint-disable-next-line no-new-func
    const v = Function("return (" + expr + ")")();
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error("Not a number");
    return Math.round(v * 1e10) / 1e10;
  }

  function compute() {
    try {
      const v = safeEvaluate(state.expression);
      if (v !== null) setResult(String(v));
    } catch { setResult("Error"); }
  }

  function setResult(value) {
    state.result = value;
    resultValueEl.textContent = value === null ? "\u00A0" : value;
    renderLockState();
  }

  // ── Paywall ──────────────────────────────────────────────────

  function isUnlocked() { return localStorage.getItem(STORAGE_KEY) === "1"; }

  function setUnlocked(on) {
    on ? localStorage.setItem(STORAGE_KEY, "1") : localStorage.removeItem(STORAGE_KEY);
    renderLockState();
  }

  function renderLockState() {
    const unlocked  = isUnlocked();
    const hasResult = state.result !== null && state.result !== "Error";

    unlockStatus.textContent = unlocked ? "Unlocked" : "Locked";
    unlockStatus.classList.toggle("status__pill--unlocked", unlocked);
    unlockStatus.classList.toggle("status__pill--locked",   !unlocked);

    const showLock = !unlocked && hasResult;
    resultEl.classList.toggle("display__result--locked", showLock);
    unlockBtn.hidden = !showLock;

    if (state.result === "Error") {
      resultEl.classList.remove("display__result--locked");
      unlockBtn.hidden = true;
    }
  }

  // ── Demo payment flow ────────────────────────────────────────

  function showStep(step) {
    stepConfirm.hidden    = step !== "confirm";
    stepProcessing.hidden = step !== "processing";
    stepSuccess.hidden    = step !== "success";
  }

  function openPaymentModal() {
    if (!state.result || state.result === "Error") return;
    payExpression.textContent = `${state.expression} = ?`;
    showStep("confirm");
    payBtn.disabled = false;
    payBtn.textContent = `Pay $${PRICE_USD.toFixed(2)}`;
    modal.hidden = false;
  }

  function closePaymentModal() {
    modal.hidden = true;
  }

  function runDemoPayment() {
    payBtn.disabled = true;
    showStep("processing");

    // Animate progress bar over ~1.8 s
    progressFill.style.transition = "none";
    progressFill.style.width = "0%";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        progressFill.style.transition = "width 1.8s cubic-bezier(.4,0,.2,1)";
        progressFill.style.width = "100%";
      });
    });

    setTimeout(() => {
      txnIdEl.textContent = "TXN-" + Math.random().toString(36).slice(2, 10).toUpperCase();
      showStep("success");
    }, 2000);
  }

  // ── Events ───────────────────────────────────────────────────

  document.querySelectorAll(".key").forEach(btn => {
    btn.addEventListener("click", () => {
      const { action, value } = btn.dataset;
      if (action === "clear")     return clearAll();
      if (action === "backspace") return backspace();
      if (action === "equals")    return compute();
      if (value !== undefined)    appendValue(value);
    });
  });

  document.addEventListener("keydown", e => {
    if (!modal.hidden) return;
    const k = e.key;
    if ((k >= "0" && k <= "9") || "+-*/().%".includes(k)) appendValue(k);
    else if (k === "Enter" || k === "=") { e.preventDefault(); compute(); }
    else if (k === "Backspace") backspace();
    else if (k === "Escape")    clearAll();
  });

  unlockBtn.addEventListener("click", openPaymentModal);
  payBtn.addEventListener("click", runDemoPayment);

  revealBtn.addEventListener("click", () => {
    setUnlocked(true);
    closePaymentModal();
  });

  modal.addEventListener("click", e => {
    if (e.target.matches("[data-close-modal]")) closePaymentModal();
  });

  resetBtn.addEventListener("click", () => setUnlocked(false));

  renderLockState();
})();
