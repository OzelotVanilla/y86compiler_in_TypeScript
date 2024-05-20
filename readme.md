y86compiler_in_TypeScript
====

A TypeScript-based Y86 assembly language's assembler, following a compiler-like structure.
It could generate the machine code in the form of `Uint8Array`.

Usage
----

To compile directly from source code, import `compileY86Code` from `@pl_and_ts/y86compiler`.
Notice that you will get a `Result` which might contains machine code, or an compilation error.

`.gitignore` config
----

Please create your own `.gitignore` for the cloned project.

```
.gitignore

lib/
es/
dist/

node_modules/
tsconfig.tsbuildinfo
```