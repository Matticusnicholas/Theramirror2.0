/**
 * Exponential moving average smoother for stabilizing pose-derived values.
 */
export class EMAFilter {
  private value: number | null = null;
  private alpha: number;

  constructor(alpha: number = 0.3) {
    this.alpha = Math.max(0.01, Math.min(1, alpha));
  }

  setAlpha(alpha: number) {
    this.alpha = Math.max(0.01, Math.min(1, alpha));
  }

  update(newValue: number): number {
    if (this.value === null) {
      this.value = newValue;
      return newValue;
    }
    this.value = this.alpha * newValue + (1 - this.alpha) * this.value;
    return this.value;
  }

  get(): number | null {
    return this.value;
  }

  reset() {
    this.value = null;
  }
}
