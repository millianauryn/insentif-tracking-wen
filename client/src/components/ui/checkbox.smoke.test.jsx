import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('renders with data-slot and base classes (checked)', () => {
    const html = renderToString(<Checkbox checked onCheckedChange={() => {}} />);
    expect(html).toContain('data-slot="checkbox"');
    expect(html).toContain('rounded-md');
  });

  it('renders unchecked without crashing', () => {
    const html = renderToString(<Checkbox checked={false} onCheckedChange={() => {}} />);
    expect(html).toContain('data-slot="checkbox"');
  });
});
