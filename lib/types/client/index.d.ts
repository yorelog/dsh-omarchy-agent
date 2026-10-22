import type { Context } from '@deepseek-ai/cordis';
/** Services the client plugin needs before `apply` runs. */
export declare const inject: string[];
/**
 * Register one view per tool name. A name that is not registered keeps the
 * generic tool card, so this stays additive.
 * @param ctx - client root context with `slots` available.
 */
export declare function apply(ctx: Context): void;
