import { NavLink, Outlet } from 'react-router-dom';
import { clearToken } from '../api/client';

const links = [
  { to: '/dashboard', label: 'Workspace' },
  { to: '/settings/keys', label: 'Keys' },
  { to: '/billing', label: 'Billing' },
  { to: '/security', label: 'Security' },
];

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl">
        <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white p-6 md:block">
          <p className="text-lg font-semibold">Carina Cloud</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Carina gets adopted first; Scout is what you turn on when the account becomes business critical.</p>
          <nav className="mt-8 space-y-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => { clearToken(); window.location.href = '/login'; }}
            className="mt-8 text-sm text-slate-500 hover:text-slate-900"
          >
            Sign out
          </button>
        </aside>
        <main className="flex-1 p-4 pb-20 md:p-8">
          <Outlet />
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-slate-200 bg-white md:hidden">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-xs ${isActive ? 'font-semibold text-slate-900' : 'text-slate-600'}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
