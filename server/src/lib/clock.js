// "Now" for a circle. Real circles use the real clock. Demo circles carry an
// offset so evaluators can fast-forward a morning and watch the escalation
// ladder fire without waiting until 10 AM.
export function nowFor(circle) {
  const offset = circle?.isDemo ? circle.demoOffsetMin || 0 : 0;
  return new Date(Date.now() + offset * 60000);
}
