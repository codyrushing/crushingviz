import postgres = require('postgres');

const sql = postgres('postgres://localhost/test');

async function test() {
  await sql.begin(async (tx) => {
    const result = await tx`SELECT 1`;
    console.log(result);
  });
}
