import { rawQuery, dbReady } from "./client";

async function main() {
  await dbReady();
  const t = await rawQuery(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1",
  );
  console.log(
    "TABLES",
    t.rows.length,
    t.rows.map((x) => (x as { table_name: string }).table_name).join("|"),
  );
  const e = await rawQuery(
    "SELECT typname FROM pg_type WHERE typtype='e' ORDER BY 1",
  );
  console.log(
    "ENUMS",
    e.rows.map((x) => (x as { typname: string }).typname).join("|"),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
