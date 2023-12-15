Tokeniser
====

Available Type of Token
----

| Token         | Regex                            | Description                                             |
| ------------- | -------------------------------- | ------------------------------------------------------- |
| `operator`    | none                             | Any reserved name like `addq`.                          |
| `identifier`  | `/\w+/`                          | Any name that is not `operator`.                        |
| `directive`   | `/\.\w+/`                        | A directive (compile command) like `.long` or `.align`. |
| `register`    | `/%\w+/`                         | Stands for a register's name.                           |
| `constant`    | `/\$\d+/`                        | A constant (number) like `$42`.                         |
| `numeric`     | `/\-?(?:0[xb])?\d+/`, check base | A sequence of number.                                   |
| `left_paren`  | `/\(/`                           | A left parenthesis.                                     |
| `right_paren` | `/\)/`                           | A right parenthesis.                                    |
| `comma`       | `/\,/`                           | Just literally a comma.                                 |
| `colon`       | `/\:/`                           | Just literally a colon.                                 |
| `new_line`    | `\r`, `\n`, or `\r\n`            | Just literally a new line.                              |

Step of Tokenisation
----

1. Check if it is a ordinary name (identifier) (check if starts with a letter), and, if it is a operator
2. Otherwise, if it is a register name (check if starts with a `%`)
3. Otherwise, if it is a compile command (check if starts with a `.`)
4. Otherwise, if it is a constant ("constant number" de facto) (check if starts with a `$`)
5. Otherwise, if it is a numeric (check if starts with a number)
6. Otherwise, if it is a punctuation (e.g. comma or parenthesis) (check if starts with `,`, `(` or `)`)
7. Otherwise, if it is a line break
8. Otherwise, if it is a comment (check if starts with a `#`)
   1. Simply read until the line end.