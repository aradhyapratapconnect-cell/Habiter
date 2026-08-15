declare module 'sql.js' {
  interface SqlJsConfig {
    locateFile?: (filename: string) => string;
  }

  interface QueryExecResult {
    columns: string[];
    values: (number | string | null)[][];
  }

  class Database {
    constructor(data?: ArrayLike<number>);
    run(sql: string, params?: (number | string | null)[]): Database;
    exec(sql: string, params?: (number | string | null)[]): QueryExecResult[];
    export(): Uint8Array;
    close(): void;
  }

  interface SqlJsStatic {
    Database: typeof Database;
  }

  export type { Database, SqlJsConfig, SqlJsStatic, QueryExecResult };
  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
