# PayCalc

A small calculator web app where the **answer is locked behind a $2 paywall**.
The user can type any expression freely, but the result is blurred until they pay.

> The payment flow in this repo is **mocked** for demo purposes. No real charges occur.
> A "Reset" button on the page clears the unlocked state from `localStorage`.

## Features

- Standard calculator (digits, `+ - * /`, `%`, parentheses, decimals)
- Keyboard support (digits, operators, `Enter`, `Backspace`, `Esc`)
- Result is blurred until unlocked
- $2 payment modal with Luhn-checked card number, expiry and CVC validation
- Unlocked state persists in `localStorage` for the session
- Safe expression evaluation (input is whitelisted to digits/operators/parens before eval)

## Run it

It's a static site — no build step.

```bash
# from the repo root
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` directly in a browser.

## Files

- `index.html` — markup for the calculator and payment modal
- `styles.css` — dark theme, blurred-answer styles, modal styles
- `app.js` — calculator engine + paywall + mocked payment

## Wiring up real payments

The mock lives in `app.js`:

```js
function mockChargeCard() {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ ok: true, id: "mock_" + Date.now() }), 900);
  });
}
```

To take real money you should **never** charge a card from the browser directly.
Instead:

1. Create a backend endpoint, e.g. `POST /api/create-payment-intent`, that uses
   [Stripe](https://docs.stripe.com/payments/payment-intents) (or similar) with
   your **secret key** to create a PaymentIntent for $2.00 USD.
2. On the client, replace `mockChargeCard` with a call to that endpoint and use
   [Stripe Elements](https://docs.stripe.com/payments/elements) to collect the
   card details (so raw PAN never touches your server).
3. After Stripe confirms the PaymentIntent succeeded, call `setUnlocked(true)`.
4. For multi-device persistence, store the unlock on the backend against a user
   account or session, not in `localStorage`.

## Disclaimer

This is a demo. Do not use the mocked card form to collect real card data.
