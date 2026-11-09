import mysql from "mysql2/promise";

export function openDatabase(config) {
  return mysql.createPool({ ...config, charset: "utf8mb4", jsonStrings: true, connectionLimit: 6, queueLimit: 24, connectTimeout: 8000 });
}

async function transaction(pool, action) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await action(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

export function archiveDatabase(pool) {
  return {
    prepare(sql) {
      return {
        bind(...values) {
          const execute = async (connection = pool) => (await connection.execute(sql, values))[0];
          return {
            execute,
            run: () => execute(),
            async first() { return (await execute())[0]; },
            async all() { return { results: await execute() }; },
          };
        },
      };
    },
    batch(statements) {
      return transaction(pool, async connection => {
        for (const statement of statements) await statement.execute(connection);
      });
    },
  };
}

export function sessionStore(pool) {
  return {
    createSession(subject, { email, displayName }, tokenHash, expires, previousHash) {
      return transaction(pool, async connection => {
        await connection.execute("INSERT INTO accounts (id, subject_hash, email, display_name) VALUES (UUID(), ?, ?, ?) ON DUPLICATE KEY UPDATE email=VALUES(email), display_name=VALUES(display_name)", [subject, email, displayName]);
        if (previousHash) await connection.execute("DELETE FROM sessions WHERE token_hash=?", [previousHash]);
        await connection.execute("INSERT INTO sessions (token_hash, account_id, expires) SELECT ?, id, ? FROM accounts WHERE subject_hash=?", [tokenHash, expires, subject]);
      });
    },
    async getSession(tokenHash, now) {
      const [rows] = await pool.execute("SELECT a.id AS userId, a.email, a.display_name AS displayName FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires>?", [tokenHash, now]);
      return rows[0];
    },
    async deleteSession(tokenHash) {
      await pool.execute("DELETE FROM sessions WHERE token_hash=?", [tokenHash]);
    },
  };
}
