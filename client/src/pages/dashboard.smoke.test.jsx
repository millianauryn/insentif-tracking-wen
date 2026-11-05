import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

describe('Dashboard render smoke', () => {
  it('recent-list status uses the house status-pill class (unlayered CSS wins over shadcn bg-primary)', () => {
    const html = renderToString(
      <MemoryRouter>
        <Dashboard
          documents={[
            { id: 1, period: '2026-10', status: 'Final', salesman: 'Rina' },
            { id: 2, period: '2026-10', status: 'Draft', salesman: 'Budi' },
          ]}
          user={{ role: 'superadmin' }}
          period="November 2026"
          onNewDoc={() => {}}
          onLoadDoc={() => {}}
        />
      </MemoryRouter>
    );
    expect(html).toContain('status-pill final');
    expect(html).toContain('status-pill draft');
  });
});
