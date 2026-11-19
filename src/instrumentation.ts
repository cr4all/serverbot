function isAdminConsoleProcess(): boolean {
  const raw = String(process.env.ADMIN_CONSOLE ?? '').trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'yes') return true;
  // Same fallback as middleware: admin listens on 5000.
  return String(process.env.PORT ?? '').trim() === '5000';
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;
  if (isAdminConsoleProcess()) {
    console.log('[surebet-auto] skipped on admin console process');
    return;
  }
  const { startSurebetAutoRunner } = await import('@/lib/surebetAutoRunner');
  startSurebetAutoRunner();
}
