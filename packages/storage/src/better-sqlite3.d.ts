declare module "better-sqlite3" {
  type SqliteValue = string | number | bigint | Buffer | null;
  type SqliteParameter = SqliteValue | boolean | Date;
  type SqliteParameters = SqliteParameter[] | Record<string, SqliteParameter>;

  interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  interface Statement<T = Record<string, unknown>> {
    all(...params: SqliteParameter[]): T[];
    all(params: SqliteParameters): T[];
    get(...params: SqliteParameter[]): T | undefined;
    get(params: SqliteParameters): T | undefined;
    run(...params: SqliteParameter[]): RunResult;
    run(params: SqliteParameters): RunResult;
  }

  interface DatabaseConnection {
    close(): void;
    exec(source: string): this;
    pragma(source: string): unknown;
    prepare<T = Record<string, unknown>>(source: string): Statement<T>;
    transaction<T extends (...args: never[]) => unknown>(fn: T): T;
  }

  interface DatabaseConstructor {
    new (filename: string, options?: Record<string, unknown>): DatabaseConnection;
  }

  const Database: DatabaseConstructor;

  namespace Database {
    export type Database = DatabaseConnection;
    export type Statement<T = Record<string, unknown>> = import("better-sqlite3").Statement<T>;
  }

  export default Database;
}
