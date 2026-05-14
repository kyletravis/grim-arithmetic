import { TokenSelectionResult } from '../foundry/selection';

export function resolvePairSelection<TokenLike>(
  pcToken: TokenLike | null,
  enemyToken: TokenLike | null
): TokenSelectionResult<TokenLike> {
  const errors: string[] = [];
  if (!pcToken) {
    errors.push('PC token is no longer on the canvas. The encounter may have changed since the danger board was rendered.');
  }
  if (!enemyToken) {
    errors.push('Enemy token is no longer on the canvas. The encounter may have changed since the danger board was rendered.');
  }
  return { subjectToken: pcToken, enemyToken, errors };
}
