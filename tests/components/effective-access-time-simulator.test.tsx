import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { mdxComponents } from '~/components/article/mdx-components';
import { EffectiveAccessTimeSimulator } from '~/components/simulators/effective-access-time-simulator';

const result = () => screen.getByText('実効アクセス時間 T = h×Tc + (1−h)×Tm').parentElement as HTMLElement;

describe('EffectiveAccessTimeSimulator', () => {
  it('既定値（h=90%, Tc=10 ns, Tm=100 ns）で 19.0 ns と式・倍率を表示する', () => {
    render(<EffectiveAccessTimeSimulator />);
    expect(screen.getByRole('region', { name: '実効アクセス時間シミュレーター' })).toBeInTheDocument();
    expect(screen.getByText('入力はこのページ内だけで計算されます')).toBeVisible();
    expect(screen.getByRole('slider', { name: 'ヒット率 h' })).toHaveValue('90');
    expect(screen.getByRole('slider', { name: 'キャッシュ Tc' })).toHaveValue('10');
    expect(screen.getByRole('slider', { name: 'メモリ Tm' })).toHaveValue('100');
    const live = result();
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('19.0');
    expect(live).toHaveTextContent('= 0.90×10 + 0.10×100');
    expect(live).toHaveTextContent('約 5.3 倍');
    // Alternative model is shown for comparison, clearly labelled.
    expect(screen.getByText('参考: ミスペナルティ方式（Tc + (1−h)×Tm）')).toBeVisible();
    expect(screen.getByText('20.0 ns')).toBeVisible();
  });

  it('スライダーには値の <output> と aria-valuetext がある', () => {
    render(<EffectiveAccessTimeSimulator />);
    const hit = screen.getByRole('slider', { name: 'ヒット率 h' });
    expect(hit).toHaveAttribute('aria-valuetext', '90%');
    expect(hit).toHaveAttribute('min', '50');
    expect(hit).toHaveAttribute('max', '100');
    expect(screen.getByRole('slider', { name: 'メモリ Tm' })).toHaveAttribute('step', '10');
    expect(screen.getByText('90%', { selector: 'output' })).toBeInTheDocument();
  });

  it('ヒット率を動かすと結果が更新される', () => {
    render(<EffectiveAccessTimeSimulator />);
    fireEvent.change(screen.getByRole('slider', { name: 'ヒット率 h' }), { target: { value: '80' } });
    const live = result();
    expect(live).toHaveTextContent('28.0');
    expect(live).toHaveTextContent('= 0.80×10 + 0.20×100');
    expect(screen.getByText('80%', { selector: 'output' })).toBeInTheDocument();
    expect(screen.getByText('30.0 ns')).toBeVisible();
  });

  it('Tc・Tm を動かすと結果が更新される', () => {
    render(<EffectiveAccessTimeSimulator />);
    fireEvent.change(screen.getByRole('slider', { name: 'キャッシュ Tc' }), { target: { value: '5' } });
    fireEvent.change(screen.getByRole('slider', { name: 'メモリ Tm' }), { target: { value: '200' } });
    expect(result()).toHaveTextContent('24.5'); // 0.9*5 + 0.1*200
  });

  it('props の初期値を反映する', () => {
    render(<EffectiveAccessTimeSimulator defaultHitRate={0.95} defaultCacheNs={5} defaultMemoryNs={60} />);
    expect(screen.getByRole('slider', { name: 'ヒット率 h' })).toHaveValue('95');
    expect(result()).toHaveTextContent('7.8'); // 0.95*5 + 0.05*60 = 7.75
    expect(result()).toHaveTextContent('= 0.95×5 + 0.05×60');
  });

  it('範囲外の props はスライダーの範囲に収める', () => {
    render(<EffectiveAccessTimeSimulator defaultHitRate={0.2} defaultCacheNs={99} defaultMemoryNs={95} />);
    expect(screen.getByRole('slider', { name: 'ヒット率 h' })).toHaveValue('50');
    expect(screen.getByRole('slider', { name: 'キャッシュ Tc' })).toHaveValue('30');
    expect(screen.getByRole('slider', { name: 'メモリ Tm' })).toHaveValue('100');
  });

  it('サーバー側レンダリング（prerender）でも既定の結果を出力する', () => {
    const html = renderToString(<EffectiveAccessTimeSimulator />);
    expect(html).toContain('19.0');
    expect(html).toContain('0.90×10 + 0.10×100');
  });

  it('MDX から使えるよう登録されている', () => {
    expect(mdxComponents.EffectiveAccessTimeSimulator).toBe(EffectiveAccessTimeSimulator);
  });
});
