/** finish(ctx, spec): the texture pass of spec 7. Clean draws nothing; the other finishes arrive in R7. */
import type { Ctx } from './graphics/types';
import type { Spec } from './spec';
export function finish(_ctx: Ctx, spec: Spec): void {
  if (spec.finish === 'clean') return;
}
