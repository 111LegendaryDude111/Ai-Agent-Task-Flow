# Good and Bad Tests

## Good tests

Good tests verify observable behavior through public interfaces.

```typescript
test("user can checkout with valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

Good tests:

- describe what the system does;
- use public interfaces;
- survive internal refactors;
- avoid asserting private call order or internals;
- fail when behavior breaks.

## Bad tests

Bad tests couple to implementation details.

```typescript
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

Red flags:

- mocking internal collaborators;
- testing private methods;
- asserting call counts/order instead of outcomes;
- querying storage directly when a public read interface exists;
- test name describes how code works, not user/caller behavior.

Prefer:

```typescript
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```
