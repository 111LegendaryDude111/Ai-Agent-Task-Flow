# Deepening

Deepening turns shallow modules into modules with better leverage and locality.

## Dependency categories

### 1. In-process

Pure computation or in-memory state. Usually safe to deepen directly. Test through the new interface.

### 2. Local-substitutable

Dependency has a local test stand-in, such as an in-memory filesystem or test database. Deepen if the stand-in can run deterministically in tests.

### 3. Remote but owned

Your own service across a network seam. Define a port at the seam. Production uses an HTTP/gRPC/queue adapter; tests use an in-memory adapter.

### 4. True external

Third-party provider. Inject a port and test with a mock adapter. Keep provider details behind the module interface.

## Seam discipline

- Do not add a port for only one real adapter unless tests need a second adapter.
- Keep internal seams private.
- Do not expose internals only to make tests easier.

## Testing strategy

- Replace shallow module tests with tests at the deepened module interface.
- Assert observable outcomes.
- Avoid tests that change when implementation internals move.
