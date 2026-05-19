# Task CLI E2E Fixture

Фикстура для детерминированной проверки lifecycle:

1. `verify <feature> <seq>`
2. `complete <feature> <seq> "summary"`
3. `verify-feature <feature>`
4. `archive <feature>`

Runtime-файлы создаются runner-скриптом в `.tmp/` и удаляются после проверки.
