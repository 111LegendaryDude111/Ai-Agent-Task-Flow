# Mocking

Mock at system seams, not inside your own implementation.

## Usually OK to mock

- Third-party APIs.
- Email/payment/SMS providers.
- Time and randomness.
- Filesystem when a real temp directory is not practical.
- Databases only when no lightweight test database or local substitute exists.

## Do not mock

- Your own modules.
- Internal collaborators.
- Private methods.
- Code you control and can exercise through the public interface.

## Design for testability

Accept dependencies instead of constructing them inside logic.

```typescript
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}
```

Avoid hidden construction:

```typescript
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

Prefer specific SDK-style interfaces over generic fetchers. Specific methods make mocks smaller and clearer.
