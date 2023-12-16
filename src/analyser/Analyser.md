Analyser
====

It only analyse the correctness of the syntax here, and generate a symbol table which links symbol name to its definition.

Allowed Syntax of the Y86 Program
----

### Directive statement

It is a possible directive present in one line, with args or not

```ebnf
DirectiveStatement = ".", name, [parameter] ;
parameter = number ;
```

Example:

```y86
.text
.align 4
.long  0x1234
```

### Operation statement

It is the statement that contains the operation, one operator, with specified number of parameters.

It may or may not contains a leading label.

### Label statement

A single line that only contains label and a colon.

Abstract Syntax Tree (AST) structure
----

## Flow of Analysis

For each new line:

1. If encounter an operator, then change to the mode of expecting no-leading-label statements.
   1. Read until the end of the line, check the number of operands.
   2. Then check if each operand is adhere to the required type (cannot put a number if it needs a register)
   3. After the check, generate 
2. If encounter an identifier, check if there is a colon, after that
   1. If there is a new line, end and check next line
   2. If not, there should be a operation statement. Check it.
3. If encounter a directive, check if correct parameter.
