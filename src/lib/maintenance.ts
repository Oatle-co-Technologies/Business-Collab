export async function runMaintenance(tasks: {
  safety: () => Promise<unknown>;
  email: () => Promise<{ enabled: boolean; failed: number }>;
  cleanup: () => Promise<unknown>;
}) {
  const safety = await Promise.allSettled([Promise.resolve().then(tasks.safety)]);
  const [email, cleanup] = await Promise.allSettled([Promise.resolve().then(tasks.email), Promise.resolve().then(tasks.cleanup)]);
  const ok = safety[0].status === "fulfilled" && cleanup.status === "fulfilled" && email.status === "fulfilled" && email.value.failed === 0;
  return { ok, emailEnabled: email.status === "fulfilled" ? email.value.enabled : null };
}
