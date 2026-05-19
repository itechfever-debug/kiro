// PayCalc — calculator with $2 paywall on the answer.
// Payment is MOCKED. Wire up Stripe (or another processor) on a real backend before going live.

(function () {
  "use strict";

  const STORAGE_KEY = "paycalc:unlocked";
  const PRICE_USD = 2;

  const expressionEl = document.getElementById("expression");
  const resultEl = document.getElementById("result");
  const resultValueEl = document.getElementById("resultValue");
  const unlockBtn = document.getElementById("unlockBtn");
  const unlockStatus = document.getElementById("unlockStatus");
  const resetBtn = document.getElementById("resetBtn");

  const modal = document.getElementById("paymentModal");
  const payForm = document.getElementById("payForm");
  const payBtn = document.getElementById("payBtn");
  const payError = document.getElementById("payError");
  const payExpression = document.getElementById("payExpression");
  const cardNumberEl = document.getElementById("cardNumber");
  const cardExpiryEl = document.getElementById("cardExpiry");
  const cardCvcEl = document.getElementById("cardCvc");

  /** @type {{ expression: string, result: string|null }} */
  const state = {
    expression: "",
    result: null,
  };

  // --------- Calculator engine ---------

  function setExpression(next) {
    state.expression = next;
    expressionEl.textContent = next || "0";
  }

  function appendValue(value) {
    // Prevent two operators in a row (basic guard, not exhaustive)
    const lastChar = state.expression.slice(-1);
    const operators = ["+", "-", "*", "/", "%", "."];
    if (operators.includes(value) && operators.includes(lastChar)) {
      setExpression(state.expression.slice(0, -1) + value);
      return;
    }
    setExpression(state.expression + value);
  }

  function clearAll() {
    setExpression("");
    setResult(null);
  }

  function backspace() {
    setExpression(state.expression.slice(0, -1));
  }

  // Safe-ish evaluator: only allow digits, operators, parens, spaces, and dots.
  function safeEvaluate(expr) {
    if (!expr || !expr.trim()) return null;
    if (!/^[\d+\-*/().%\s]+$/.test(expr)) {
      throw new Error("Invalid characters in expression");
    }
    // Function constructor with a sanitized string. Since we whitelisted chars,
    // arbitrary code can't be injected.
    // eslint-disable-next-line no-new-func
    const value = Function("return (" + expr + ")")();
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("Result is not a finite number");
    }
    // Trim floating-point noise
    return Math.round(value * 1e10) / 1e10;
  }

  function compute() {
    try {
      const value = safeEvaluate(state.expression);
      if (value === null) return;
      setResult(String(value));
    } catch (err) {
      setResult("Error");
    }
  }

  function setResult(value) {
    state.result = value;
    resultValueEl.textContent = value === null ? "\u00A0" : value;
    renderLockState();
  }

  // --------- Paywall state ---------

  function isUnlocked() {
    return localStorage.getItem(STORAGE_KEY) === "1";
  }

  function setUnlocked(unlocked) {
    if (unlocked) {
      localStorage.setItem(STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    renderLockState();
  }

  function renderLockState() {
    const unlocked = isUnlocked();
    unlockStatus.textContent = unlocked ? "Unlocked" : "Locked";
    unlockStatus.classList.toggle("status__pill--unlocked", unlocked);
    unlockStatus.classList.toggle("status__pill--locked", !unlocked);

    const hasResult = state.result !== null && state.result !== "Error";
    if (unlocked || !hasResult) {
      resultEl.classList.remove("display__result--locked");
      unlockBtn.hidden = true;
    } else {
      resultEl.classList.add("display__result--locked");
      unlockBtn.hidden = false;
    }

    // If result is "Error" we want it visible and not locked
    if (state.result === "Error") {
      resultEl.classList.remove("display__result--locked");
      unlockBtn.hidden = true;
    }
  }

  // --------- Payment modal (mocked) ---------

  function openPaymentModal() {
    if (state.result === null || state.result === "Error") return;
    payExpression.textContent = `${state.expression} = ?`;
    payError.hidden = true;
    payError.textContent = "";
    modal.hidden = false;
    setTimeout(() => cardNumberEl.focus(), 50);
  }

  function closePaymentModal() {
    modal.hidden = true;
    payBtn.disabled = false;
    payBtn.textContent = `Pay $${PRICE_USD.toFixed(2)}`;
  }

  function formatCardNumber(value) {
    const digits = value.replace(/\D/g, "").slice(0, 19);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  }
  function formatExpiry(value) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length < 3) return digits;
    return digits.slice(0, 2) + "/" + digits.slice(2);
  }

  // Luhn check for plausible card number
  function luhnValid(num) {
    const digits = num.replace(/\D/g, "");
    if (digits.length < 12) return false;
    let sum = 0;
    let alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = parseInt(digits.charAt(i), 10);
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  function validatePaymentForm() {
    const number = cardNumberEl.value.replace(/\s/g, "");
    const expiry = cardExpiryEl.value;
    const cvc = cardCvcEl.value;

    if (!luhnValid(number)) return "Please enter a valid card number.";
    const m = expiry.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return "Expiry must be in MM/YY format.";
    const month = parseInt(m[1], 10);
    const year = 2000 + parseInt(m[2], 10);
    if (month < 1 || month > 12) return "Invalid expiry month.";
    const now = new Date();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    if (endOfMonth < now) return "Card is expired.";
    if (!/^\d{3,4}$/.test(cvc)) return "CVC must be 3 or 4 digits.";
    return null;
  }

  // Mocked payment processor. Replace with a real call to your backend
  // (e.g. POST /api/create-payment-intent that calls Stripe).
  function mockChargeCard() {
    return new Promise((resolve) => {
      setTimeout(() => resolve({ ok: true, id: "mock_" + Date.now() }), 900);
    });
  }

  async function handlePay(e) {
    e.preventDefault();
    payError.hidden = true;
    const errMsg = validatePaymentForm();
    if (errMsg) {
      payError.textContent = errMsg;
      payError.hidden = false;
      return;
    }

    payBtn.disabled = true;
    payBtn.textContent = "Processing…";
    try {
      const res = await mockChargeCard();
      if (!res.ok) throw new Error("Charge failed");
      setUnlocked(true);
      closePaymentModal();
    } catch (err) {
      payError.textContent = "Payment failed. Please try again.";
      payError.hidden = false;
      payBtn.disabled = false;
      payBtn.textContent = `Pay $${PRICE_USD.toFixed(2)}`;
    }
  }

  // --------- Wire up events ---------

  document.querySelectorAll(".key").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const value = btn.dataset.value;
      if (action === "clear") return clearAll();
      if (action === "backspace") return backspace();
      if (action === "equals") return compute();
      if (value !== undefined) appendValue(value);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (!modal.hidden) return; // don't capture keys while paying
    const k = e.key;
    if ((k >= "0" && k <= "9") || "+-*/().%".includes(k)) {
      appendValue(k);
    } else if (k === "Enter" || k === "=") {
      e.preventDefault();
      compute();
    } else if (k === "Backspace") {
      backspace();
    } else if (k === "Escape") {
      clearAll();
    }
  });

  unlockBtn.addEventListener("click", openPaymentModal);
  resetBtn.addEventListener("click", () => {
    setUnlocked(false);
  });

  modal.addEventListener("click", (e) => {
    if (e.target.matches("[data-close-modal]")) closePaymentModal();
  });

  cardNumberEl.addEventListener("input", () => {
    cardNumberEl.value = formatCardNumber(cardNumberEl.value);
  });
  cardExpiryEl.addEventListener("input", () => {
    cardExpiryEl.value = formatExpiry(cardExpiryEl.value);
  });
  cardCvcEl.addEventListener("input", () => {
    cardCvcEl.value = cardCvcEl.value.replace(/\D/g, "").slice(0, 4);
  });

  payForm.addEventListener("submit", handlePay);

  // Initial render
  renderLockState();
})();
