import { StmtNode } from "./StmtNode"

export class AST
{
    private stmts
    public get stmt_nodes() { return [...this.stmts] }
    public readonly source_code

    constructor({ stmt_nodes, source_code }: AST_Param)
    {
        this.stmts = stmt_nodes
        this.source_code = source_code
    }
}

type AST_Param = {
    stmt_nodes: StmtNode[],
    source_code: string
}