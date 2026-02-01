const BASE_URL = process.env.CRON_BASE_URL || "http://localhost:4000";
const INTERVAL_MINUTES = Number(process.env.CRON_INTERVAL_MINUTES || 1440);
const CRON_SECRET = process.env.CRON_SECRET;

const run = async () => {
  const url = new URL("/api/notifications/deadline/run", BASE_URL);
  if (CRON_SECRET) {
    url.searchParams.set("secret", CRON_SECRET);
  }

  try {
    const response = await fetch(url.toString(), { method: "POST" });
    if (!response.ok) {
      const text = await response.text();
      console.error("Cron failed", response.status, text);
      return;
    }
    const data = await response.json();
    console.log("Cron ok", data);
  } catch (error) {
    console.error("Cron error", error);
  }
};

run();
setInterval(run, INTERVAL_MINUTES * 60 * 1000);
