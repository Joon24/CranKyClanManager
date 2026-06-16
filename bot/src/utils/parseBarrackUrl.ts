export type ParseInputResult = string | { numericId: true } | null;

/**
 * 입력값에서 닉네임 추출
 * - 병영 URL (닉네임 포함)  → 닉네임 추출
 * - 병영 URL (숫자 ID만)    → { numericId: true }
 * - 일반 텍스트              → 그대로 닉네임으로 사용
 */
export function parseInput(input: string | null | undefined): ParseInputResult {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  const numericMatch = trimmed.match(/barracks\.sa\.nexon\.com\/(\d+)/i);
  if (numericMatch) {
    return { numericId: true };
  }

  const urlMatch = trimmed.match(
    /(?:sa\.nexon\.com|barracks\.sa\.nexon\.com)\/(?:profile|Profile\/pMain\.aspx\?nick=)([^/?&#]+)/i
  );
  if (urlMatch) {
    return decodeURIComponent(urlMatch[1]);
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  return trimmed;
}
