const Database = require('better-sqlite3');
const { hashPassword } = require('../auth.js');

(async () => {
  const db = new Database('data/incentive.sqlite');
  const hash = await hashPassword('123456');
  const update = db.transaction(() => {
    db.prepare("DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = 'superadmin')").run();
    db.prepare("UPDATE users SET username = 'super admin', password_hash = ? WHERE username = 'superadmin' AND role = 'superadmin'").run(hash);
  });
  update();
  console.log(db.prepare('SELECT id, username, role, active FROM users').all());
  db.close();
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
