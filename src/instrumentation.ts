export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;
  const { startSurebetAutoRunner } = await import('@/lib/surebetAutoRunner');
  startSurebetAutoRunner();
}
