# Deep Modules

A deep module gives callers high leverage through a small interface.

```text
small interface
large useful implementation behind it
```

A shallow module has an interface almost as complex as its implementation. It adds little leverage and often spreads knowledge across callers.

During TDD, look for chances to deepen modules after GREEN:

- reduce the number of public entry points;
- simplify parameters;
- move repeated caller knowledge behind the interface;
- keep tests at the interface, not internal helpers;
- avoid introducing seams unless variation is real.

Do not deepen while RED. Get behavior passing first, then refactor safely.
