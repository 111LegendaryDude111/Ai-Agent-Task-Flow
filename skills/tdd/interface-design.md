# Interface Design for Testability

Good interfaces make behavior easy to verify.

## Guidelines

1. Accept dependencies; do not create external dependencies inside core logic.
2. Return results where possible; avoid hidden side effects.
3. Keep surface area small.
4. Put behavior behind the interface so tests exercise useful outcomes.
5. Keep internal seams private unless callers truly need them.

## Example

```typescript
function calculateDiscount(cart): Discount {
  // deterministic and easy to test
}
```

Harder to test:

```typescript
function applyDiscount(cart): void {
  cart.total -= discount;
}
```

The first exposes a result. The second mutates state and makes verification depend on setup details.
