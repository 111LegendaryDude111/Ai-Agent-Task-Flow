# CONTEXT.md Format

## Single context

Use one root `CONTEXT.md` when the repository has one domain context.

```md
# {Context Name}

{One or two sentences describing this context.}

## Language

**Order**:
A request from a customer to buy one or more items.
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent after fulfillment.
_Avoid_: Bill, payment request

## Relationships

- An **Order** can produce one or more **Invoices**.
- An **Invoice** belongs to exactly one **Customer**.

## Example dialogue

> **Dev:** "When a **Customer** places an **Order**, do we create the **Invoice** immediately?"
> **Domain expert:** "No. An **Invoice** is generated after **Fulfillment** is confirmed."

## Flagged ambiguities

- "account" was used for both **Customer** and **User**. Resolution: keep them distinct.
```

## Multi-context repos

Use root `CONTEXT-MAP.md` when the repository has multiple domain contexts.

```md
# Context Map

## Contexts

- [Ordering](./src/ordering/CONTEXT.md) - receives and tracks customer orders.
- [Billing](./src/billing/CONTEXT.md) - generates invoices and processes payments.

## Relationships

- **Ordering -> Billing**: Ordering emits `OrderPlaced`; Billing consumes it to create payment work.
```

## Rules

- Pick one canonical term and list aliases under `_Avoid_`.
- Keep definitions to one sentence when possible.
- Include only project/domain terms, not generic programming concepts.
- Use bold term names in relationships.
- Capture resolved ambiguity explicitly.
- Do not couple domain language to implementation details.
- If unclear which context owns a term, ask before writing.
