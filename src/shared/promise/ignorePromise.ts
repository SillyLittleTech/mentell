/**
 * Marks a promise as intentionally unawaited (fire-and-forget) without using the
 * `void` operator, which some linters flag in expression statements.
 */
export function ignorePromise(promise: PromiseLike<unknown>): undefined {
  Promise.resolve(promise).catch((error) => {
    console.error(error);
  });
  return undefined;
}
