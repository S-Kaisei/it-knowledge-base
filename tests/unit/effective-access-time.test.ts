import { describe, expect, it } from 'vitest';
import { clampToStep, effectiveAccessTime, formatCalculation, missPenaltyModelTime, speedup } from '~/lib/simulators/effective-access-time';

describe('effectiveAccessTime（IPA 方式: h·Tc + (1−h)·Tm）', () => {
  it('h=0.9, Tc=10, Tm=100 のとき 19 ns', () => {
    expect(effectiveAccessTime(0.9, 10, 100)).toBeCloseTo(19, 10);
  });

  it('h=1 ならキャッシュの時間そのもの', () => {
    expect(effectiveAccessTime(1, 10, 100)).toBe(10);
  });

  it('h=0 ならメモリの時間そのもの', () => {
    expect(effectiveAccessTime(0, 10, 100)).toBe(100);
  });

  it('典型値: h=0.95, Tc=5, Tm=60 → 7.75 ns', () => {
    expect(effectiveAccessTime(0.95, 5, 60)).toBeCloseTo(7.75, 10);
  });

  it('時間 0 は許容する', () => {
    expect(effectiveAccessTime(0.5, 0, 0)).toBe(0);
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY])('ヒット率 %s は RangeError', (h) => {
    expect(() => effectiveAccessTime(h, 10, 100)).toThrow(RangeError);
  });

  it.each([
    [-1, 100],
    [10, -1],
    [Number.NaN, 100],
    [10, Number.NaN],
    [10, Number.POSITIVE_INFINITY],
  ])('負・NaN・無限の時間（Tc=%s, Tm=%s）は RangeError', (tc, tm) => {
    expect(() => effectiveAccessTime(0.9, tc, tm)).toThrow(RangeError);
  });
});

describe('missPenaltyModelTime（ミスペナルティ方式: Thit + (1−h)·Tpenalty）', () => {
  it('h=0.9, Thit=10, Tpenalty=100 のとき 20 ns（IPA 方式より Tc 分だけ長い計算になる）', () => {
    expect(missPenaltyModelTime(0.9, 10, 100)).toBeCloseTo(20, 10);
  });

  it('h=1 ならヒット時間、h=0 ならヒット時間 + ペナルティ', () => {
    expect(missPenaltyModelTime(1, 10, 100)).toBe(10);
    expect(missPenaltyModelTime(0, 10, 100)).toBe(110);
  });

  it('不正な入力は RangeError', () => {
    expect(() => missPenaltyModelTime(2, 10, 100)).toThrow(RangeError);
    expect(() => missPenaltyModelTime(0.9, -10, 100)).toThrow(RangeError);
    expect(() => missPenaltyModelTime(0.9, 10, Number.NaN)).toThrow(RangeError);
  });
});

describe('speedup', () => {
  it('メモリのみと比べた倍率', () => {
    expect(speedup(100, 19)).toBeCloseTo(5.263, 3);
    expect(speedup(100, 100)).toBe(1);
  });

  it('実効アクセス時間 0 や負・NaN は RangeError', () => {
    expect(() => speedup(100, 0)).toThrow(RangeError);
    expect(() => speedup(100, -1)).toThrow(RangeError);
    expect(() => speedup(Number.NaN, 10)).toThrow(RangeError);
  });
});

describe('clampToStep', () => {
  it('範囲内に収め、刻みに合わせる', () => {
    expect(clampToStep(95, 40, 200, 10)).toBe(100);
    expect(clampToStep(5, 40, 200, 10)).toBe(40);
    expect(clampToStep(500, 40, 200, 10)).toBe(200);
    expect(clampToStep(12.4, 1, 30, 1)).toBe(12);
    expect(clampToStep(Number.NaN, 1, 30, 1)).toBe(1);
  });
});

describe('formatCalculation', () => {
  it('数値を埋めた式を返す', () => {
    expect(formatCalculation(0.9, 10, 100)).toBe('0.90×10 + 0.10×100');
    expect(formatCalculation(1, 5, 60)).toBe('1.00×5 + 0.00×60');
  });
});
