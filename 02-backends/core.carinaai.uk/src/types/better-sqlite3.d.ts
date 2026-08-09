declare module 'better-sqlite3' {
  namespace Database {
    type RunResult = {
      changes: number;
      lastInsertRowid: number | bigint;
    };

    interface Statement {
      run(...params: unknown[]): RunResult;
      all(...params: unknown[]): unknown[];
      get(...params: unknown[]): unknown;
    }

    interface Database {
      pragma(sql: string): unknown;
      exec(sql: string): this;
      prepare(sql: string): Statement;
      transaction<T extends (...args: never[]) => unknown>(fn: T): T;
      close(): void;
    }
  }

  class Database {
    constructor(filename: string);
    pragma(sql: string): unknown;
    exec(sql: string): this;
    prepare(sql: string): Database.Statement;
    transaction<T extends (...args: never[]) => unknown>(fn: T): T;
    close(): void;
  }

  export = Database;
}
