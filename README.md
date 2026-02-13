Here is a **senior-level README** for `callograph` v0.1.0 — written as if this is a serious static analysis tool.

You can paste this directly into your `README.md`.

---

# Callograph

**Callograph** is a static analysis tool for TypeScript projects that builds a program-level call graph and detects side effects, impurity propagation, and unsafe async behavior.

It is designed for engineers who want deeper insight into how code behaves — beyond lint rules — by analyzing symbol resolution and cross-file call relationships using the TypeScript Compiler API.

---

## Why Callograph?

Modern TypeScript codebases suffer from:

* Hidden side effects
* Implicit mutation
* Unintended global state access
* Async misuse
* Impure utilities leaking into shared modules
* Lack of deterministic boundaries

Callograph provides structural visibility into function relationships and propagates impurity across the call graph to surface real architectural risks.

---

## Core Capabilities (v0.1.0)

### 1. Call Graph Construction

Builds a full program-level call graph from your `tsconfig.json`.

It identifies:

* Function → function relationships
* Cross-file calls
* Imported symbol calls
* Method calls (where statically resolvable)

Example output:

```
Call Graph:

calculateTotal → applyDiscount
applyDiscount → fetchTaxRate
fetchTaxRate → Date.now
```

---

### 2. Function Purity Detection

Callograph analyzes whether a function is:

* Mutating its parameters
* Writing to outer scope variables
* Accessing global state
* Calling impure functions

Example:

```
src/utils/calc.ts:42
Function: calculateTotal
Status: ❌ Impure

Reasons:
  - Mutates parameter `items`
  - Calls impure function `fetchTaxRate`
```

---

### 3. Impurity Propagation

If:

```
A → calls B
B → impure
```

Then:

```
A becomes impure
```

This propagation makes Callograph significantly more powerful than simple AST pattern scanning.

It reasons about effect chains.

---

### 4. Global State & Non-Determinism Detection

Flags usage of:

* `process.env`
* `Date.now()`
* `Math.random()`
* `global`
* `window`
* Console writes (optional strict mode)

Useful for teams enforcing deterministic or pure-core architectures.

---

### 5. Parameter Mutation Detection

Detects:

* Direct reassignment
* Deep property mutation
* Array mutation (`push`, `splice`, etc.)

Example:

```
❌ Parameter mutation detected:
updateUser(user) → user.name = "new"
```

---

### 6. Async Safety Checks

Flags:

* Unawaited promises
* Fire-and-forget async calls
* Async functions lacking error handling (basic detection)

---

### 7. CI Integration

Callograph can fail CI if impure functions are detected.

```
callograph analyze --fail-on-impure
```

This allows enforcement of architectural constraints.

---

## Installation

```bash
npm install --save-dev callograph
```

Or use directly:

```bash
npx callograph analyze
```

---

## Usage

Analyze project based on `tsconfig.json`:

```bash
callograph analyze
```

JSON output:

```bash
callograph analyze --json
```

Fail CI if impurity detected:

```bash
callograph analyze --fail-on-impure
```

Export DOT graph:

```bash
callograph analyze --dot
```

---

## Architecture

Callograph uses:

* TypeScript Compiler API
* Program-level symbol resolution
* TypeChecker-based call resolution
* AST traversal via `ts.forEachChild`
* Impurity propagation via call graph traversal

Pipeline:

```
Load tsconfig
↓
Create Program
↓
Extract function symbols
↓
Build call graph
↓
Detect side effects
↓
Propagate impurity
↓
Report results
```

---

## Design Philosophy

Callograph does not attempt perfect purity inference.
It aims to provide practical, high-signal diagnostics with minimal noise.

It prioritizes:

* Deterministic analysis
* CI compatibility
* Clear reasoning in output
* Minimal false positives
* Performance (<2s on mid-sized codebases)

---

## Limitations (v0.1.0)

* Dynamic runtime dispatch cannot always be resolved.
* Higher-order functions are partially supported.
* Deep framework-specific analysis is not included.
* No IDE integration yet.

---

## Roadmap

* Shared mutable singleton detection
* Closure-captured state analysis
* Circular call detection
* Effect scoring per module
* Interactive HTML graph visualization
* GitHub PR comment bot
* Monorepo support with project references

---

## License

MIT

---

## Contributing

Contributions are welcome.

* Open an issue to discuss architecture changes.
* Keep changes deterministic and type-safe.
* Add tests for new analysis rules.

---

## Vision

Callograph aims to become:

> A structural analysis tool that gives engineers clarity over side effects, purity, and call relationships in large TypeScript systems.

---