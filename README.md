
---

# Callograph

**Callograph** is a structural static analysis engine for TypeScript that builds a full program-level call graph and performs interprocedural purity and async safety analysis.

It goes beyond lint rules by analyzing symbol resolution, cross-file relationships, and effect propagation using the TypeScript Compiler API.

Callograph is built for engineers who want architectural clarity — not stylistic warnings.

---

## 🚀 What Callograph Does

Callograph analyzes your entire TypeScript program and answers questions like:

* Which functions call which?
* Where do side effects originate?
* How does impurity propagate?
* Are promises safely handled?
* Are async boundaries enforced?
* Are errors swallowed?
* Are async effects escaping function boundaries?

It provides structural reasoning about your system.

---

# Core Capabilities (v0.0.9)

---

## 1. Program-Level Call Graph Construction

Callograph builds a complete call graph from your `tsconfig.json`.

It detects:

* Function → function relationships
* Cross-file calls
* Imported symbol resolution
* Method calls (when statically resolvable)
* Interprocedural call edges

Example:

```
Call Graph:

calculateTotal → applyDiscount
applyDiscount → fetchTaxRate
fetchTaxRate → Date.now
```

This graph becomes the foundation for structural effect analysis.

---

## 2. Function Purity Analysis

Callograph determines whether a function is pure or impure based on structural rules.

It detects:

### Parameter Mutation

* Direct reassignment
* Deep property mutation
* Array mutator calls (`push`, `splice`, etc.)

Example:

```
❌ Mutates parameter `items`
```

---

### Outer Scope Writes

Detects writes to variables declared outside the function.

```
❌ Writes to outer scope `cache`
```

---

### Global State Access

Flags access to:

* `process`
* `process.env`
* `window`
* `global`
* `document`
* Console writes
* `Date.now()`
* `Math.random()`

These are marked as non-deterministic or impure operations.

---

## 3. Impurity Propagation (Interprocedural)

If:

```
A → calls B
B is impure
```

Then:

```
A becomes impure
```

Callograph propagates impurity across the call graph using reverse-graph traversal and fixed-point propagation.

This makes impurity structural, not local.

---

## 4. Enterprise Async Safety Engine

Callograph includes a dedicated async analysis engine, separate from purity.

It performs structural async inference.

---

### Floating Promise Detection

Flags:

* Unawaited promises
* Fire-and-forget async calls
* Promises ignored inside expressions
* Promises ignored inside loops (loop-aware escalation)

Example:

```
❌ Floating promise
⚠️ Floating promise inside loop
```

---

### Promise.all Structural Analysis

Detects:

* Unawaited `Promise.all`
* Promise arrays containing unhandled async calls
* Deep inspection of array elements

---

### Async Callback Detection

Flags async callbacks in:

* `forEach`
* `map`
* `filter`
* `reduce`
* `addEventListener`

Example:

```
⚠️ Async callback inside array method
```

---

### Error Swallowing Detection

Detects:

* Empty `.catch()` blocks
* Swallowed promise rejections

Example:

```
❌ Error swallowed in .catch()
```

---

### Async Boundary Enforcement

Flags:

```
async function foo() {
  await fetchData();
}
```

If no `try/catch` boundary exists:

```
⚠️ Async function contains await but has no error boundary
```

---

### Interprocedural Async Propagation

If:

```
A calls B
B returns a promise
A does not await B
```

Then:

```
A is async-unsafe
```

Callograph propagates async risk across the call graph.

---

### Severity Model

Async issues are categorized:

* `error`
* `warning`
* `info`

You can configure thresholds:

```
--async-severity=warning
--fail-on-async
```

---

## 5. CI Integration

Callograph supports CI enforcement:

```
callograph analyze --fail-on-impure
callograph analyze --fail-on-async
```

You can enforce architectural constraints in pipelines.

---

## 6. JSON Output Mode

Structured JSON output for automation:

```
callograph analyze --json
```

Useful for:

* CI dashboards
* Custom reporting
* PR bots
* IDE integrations

---

## 7. Smart Ignore System

Callograph automatically:

* Ignores `node_modules`
* Detects and ignores its own source when analyzing itself

You can manually ignore paths:

```
--ignore=src/generated,dist
```

---

# CLI Usage

Analyze project:

```
callograph analyze
```

Custom tsconfig:

```
callograph analyze tsconfig.build.json
```

Fail on impurity:

```
callograph analyze --fail-on-impure
```

Fail on async violations:

```
callograph analyze --fail-on-async
```

Adjust async severity threshold:

```
callograph analyze --async-severity=warning
```

JSON output:

```
callograph analyze --json
```

---

# Architecture

Callograph pipeline:

```
Load tsconfig
↓
Create TypeScript Program
↓
Collect function declarations (ignore-aware)
↓
Build call graph (TypeChecker-based resolution)
↓
Purity analysis
↓
Impurity propagation
↓
Async flow analysis
↓
Async return propagation
↓
Async risk propagation
↓
Severity filtering
↓
Report (Text or JSON)
```

---

# Design Philosophy

Callograph is designed for:

* Structural clarity
* Deterministic reasoning
* Minimal false positives
* Interprocedural analysis
* CI enforcement
* Performance on mid-sized codebases

It does not aim for perfect theoretical purity inference.

It aims for high-signal architectural diagnostics.

---

# Current Limitations

* Dynamic runtime dispatch cannot always be resolved
* Higher-order functional inference is partial
* No race-condition modeling (sync/async timing hazards)
* No async escape-boundary graph modeling yet
* No IDE plugin yet

---

# Roadmap

Planned enhancements:

* DOT graph export
* Circular dependency detection
* Shared mutable singleton detection
* Closure-captured state analysis
* Module-level effect scoring
* Async escape-boundary modeling
* Mixed sync/async race detection
* HTML graph visualization
* GitHub PR comment bot
* Monorepo project reference support

---

# Versioning

The current release introduces:

* Dedicated async engine
* Interprocedural async propagation
* Severity modeling
* JSON output
* Smart ignore system
* Enterprise boundary detection

Callograph is evolving toward a structural effect analysis engine for TypeScript.

---

# Vision

Callograph aims to become:

> A structural analysis engine that provides deep visibility into side effects, purity, async safety, and architectural boundaries in large TypeScript systems.

---
