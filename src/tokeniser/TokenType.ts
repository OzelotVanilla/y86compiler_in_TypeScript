export enum TokenType
{
    /**
     *  Defined operator in y86 ISA such as `addq`.
     */
    operator = "operator",

    /**
     * Register name such as `%rax`.
    */
    register = "register",

    /**
     * Constant value like `$42`.
     */
    constant = "const_num",

    /**
     * Directive (compile command) like `.long` or `.pos`.
     */
    directive = "directive",

    /**
     * Names (starts with letter, with letter or number following).
     */
    identifier = "identifier",

    /**
     * Numbers that is ranged from `0` to `9`, like `8` in `8(%rbp)`.
     */
    numeric = "numeric",

    /**
     * Literally left parenthesis `(`.
     */
    left_paren = "left_paren",

    /**
     * Literally right parenthesis `)`.
     */
    right_paren = "right_paren",

    /**
     * Literally a comma `,`.
     */
    comma = "comma",

    /**
     * Literally a colon `:`.
     */
    colon = "colon",

    /**
     * Line break, exactly be `\r`, `\n`, or `\r\n`.
     */
    new_line = "new_line"
}