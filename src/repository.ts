import {Pool, ResultSetHeader, RowDataPacket} from "mysql2/promise";
import {URLEntry} from "./index";


export class UrlRepository {

    private readonly sqlPool: Pool

    constructor(sqlPool: Pool) {
        this.sqlPool = sqlPool
    }

    async findById(id: string): Promise<URLEntry | null> {
        const conn = await this.sqlPool.getConnection()
        const [result] = await conn.query<RowDataPacket[]>("SELECT id, url FORM urls WHERE id = ?", [id])
        if (result.length === 1) {
            const row = result[0]
            return {
                id: row['id'],
                url: row['url'],
            }
        } else if (result.length === 0) {
            return null
        } else {
            throw new Error("Unexpected number of resulting rows.")
        }
    }

    async save(entry: URLEntry): Promise<void> {
        const conn = await this.sqlPool.getConnection()
        const [result] = await conn.query<ResultSetHeader>("INSERT INTO urls SET ?", [entry])
        if (result.affectedRows !== 1) {
            throw new Error(`Affected rows expected to be 1, got ${result.affectedRows}`)
        }
    }

}
