export interface TokenSelectionResult<TokenLike = unknown> {
  subjectToken: TokenLike | null;
  enemyToken: TokenLike | null;
  errors: string[];
}

interface SelectionSource<TokenLike = unknown> {
  controlled?: TokenLike[];
  targets?: Iterable<TokenLike>;
}

export function getCurrentTokenSelection<TokenLike = unknown>(): TokenSelectionResult<TokenLike> {
  return resolveTokenSelection({
    controlled: canvas.tokens?.controlled as TokenLike[] | undefined,
    targets: game.user?.targets as Iterable<TokenLike> | undefined
  });
}

export function resolveTokenSelection<TokenLike = unknown>(
  source: SelectionSource<TokenLike>
): TokenSelectionResult<TokenLike> {
  const controlled = source.controlled ?? [];
  const targets = Array.from(source.targets ?? []);
  const errors: string[] = [];

  const subjectToken = controlled.length === 1 ? controlled[0] : null;
  const enemyToken = targets.length === 1 ? targets[0] : null;

  if (controlled.length === 0) errors.push('No PC token selected. Select one PC token.');
  if (controlled.length > 1) errors.push('Multiple tokens selected. Select only one PC token.');
  if (targets.length === 0) errors.push('No target selected. Target one enemy token.');
  if (targets.length > 1) errors.push('Multiple targets selected. Target only one enemy token.');

  return { subjectToken, enemyToken, errors };
}
