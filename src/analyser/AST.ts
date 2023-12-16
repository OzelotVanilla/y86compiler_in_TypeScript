import { StmtNode } from "./StmtNode"

export class AST
{
    private stmts
    public get stmt_nodes() { return [...this.stmts] }

    constructor({ stmt_nodes }: AST_Param)
    {
        this.stmts = stmt_nodes
    }
}

type AST_Param = {
    stmt_nodes: StmtNode[]
}