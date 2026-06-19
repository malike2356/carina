export type SpinnerFaceSet = 'kawaii' | 'minimal' | 'dots' | 'moon' | 'cat';

export const SPINNER_FACES: Record<SpinnerFaceSet, string[]> = {
  kawaii: ['(◕‿◕)', '(◠‿◠)', '(◡‿◡)', '(◕‿◕)'],
  minimal: ['◷', '◶', '◵', '◴'],
  moon: ['(', '(', 'O', 'O', '@', 'O', 'O', '('],
  cat: ['=^..^=', '>^..^<', '=^..^=', '>^..^<'],
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
};

export function pickSpinnerFace(set: SpinnerFaceSet, tick: number): string {
  const faces = SPINNER_FACES[set];
  return faces[tick % faces.length] ?? faces[0]!;
}
