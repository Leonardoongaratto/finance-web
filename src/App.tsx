import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { EmptyState, Loading } from './components/ui';
import { useTheme } from './lib/theme';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DebtsPage = lazy(() => import('./pages/DebtsPage'));
const GoalsPage = lazy(() => import('./pages/GoalsPage'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const InvestmentsPage = lazy(() => import('./pages/InvestmentsPage'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));

const LINKS = [
  { to: '/', label: 'Painel' },
  { to: '/metas', label: 'Metas' },
  { to: '/transacoes', label: 'Transações' },
];

export default function App() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  const location = useLocation();
  const [showQuickCapture, setShowQuickCapture] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        event.key.toLowerCase() === 'n' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || '')
      ) {
        event.preventDefault();
        setShowQuickCapture(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="app-header">
        <Link className="brand" to="/">
          Finanças
        </Link>
        <nav className="nav" aria-label="Principal">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="btn btn-small"
          onClick={toggle}
          aria-label={dark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
        >
          {dark ? 'Tema claro' : 'Tema escuro'}
        </button>
      </header>
      <main className="container">
        <RouteErrorBoundary key={location.pathname}>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/transacoes" element={<TransactionsPage />} />
              <Route path="/importar" element={<ImportPage />} />
              <Route path="/investimentos" element={<InvestmentsPage />} />
              <Route path="/metas" element={<GoalsPage />} />
              <Route path="/dividas" element={<DebtsPage />} />
              <Route
                path="*"
                element={
                  <EmptyState title="Página não encontrada" description="O endereço não existe neste app.">
                    <Link className="btn btn-primary" to="/">
                      Ir para o Painel
                    </Link>
                  </EmptyState>
                }
              />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </main>

      <button
        type="button"
        className="floating-action-btn"
        onClick={() => setShowQuickCapture(true)}
        aria-label="Adicionar lançamento rápido"
      >
        <span>+ Lançar</span>
        <span className="fab-shortcut" aria-hidden="true">
          N
        </span>
      </button>

      <QuickCaptureModal
        isOpen={showQuickCapture}
        onClose={() => setShowQuickCapture(false)}
        onSaved={() => {
          window.dispatchEvent(new CustomEvent('finance-reload'));
        }}
      />
    </>
  );
}
