import { useEffect, lazy, Suspense } from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';

// Every other page is loaded on demand (route-based code splitting) instead
// of all 16 pages shipping in one upfront bundle — someone opening the app
// just to ring up a sale was downloading the Reports/Settings/Activity
// pages' code too, before ever seeing anything on screen. LoginPage stays
// a normal (non-lazy) import since it's the very first thing an
// unauthenticated visitor sees — splitting it would trade a network
// request for a bundle-size saving on the one screen where that request
// is most visible (nothing else on screen yet to mask a loading flicker).
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const PosPage = lazy(() => import('./pages/PosPage').then((m) => ({ default: m.PosPage })));
const SalesHistoryPage = lazy(() => import('./pages/SalesHistoryPage').then((m) => ({ default: m.SalesHistoryPage })));
const PurchasesPage = lazy(() => import('./pages/PurchasesPage').then((m) => ({ default: m.PurchasesPage })));
const PurchaseHistoryPage = lazy(() => import('./pages/PurchaseHistoryPage').then((m) => ({ default: m.PurchaseHistoryPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const CustomersPage = lazy(() => import('./pages/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const CustomerDetailsPage = lazy(() => import('./pages/CustomerDetailsPage').then((m) => ({ default: m.CustomerDetailsPage })));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage').then((m) => ({ default: m.SuppliersPage })));
const SupplierDetailsPage = lazy(() => import('./pages/SupplierDetailsPage').then((m) => ({ default: m.SupplierDetailsPage })));
const CashboxPage = lazy(() => import('./pages/CashboxPage').then((m) => ({ default: m.CashboxPage })));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ActivityPage = lazy(() => import('./pages/ActivityPage').then((m) => ({ default: m.ActivityPage })));

// Shown in the content area (sidebar/header already rendered by AppLayout)
// while a lazily-loaded page's own chunk downloads — brief on a first
// visit to that page each session, and instant on every visit after (the
// browser caches the chunk).
function PageLoadingFallback() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function RequireAuth({ children }) {
  const { isAuthed, isChecking } = useAuth();
  if (isChecking) {
    // Silently attempting to restore a session from a saved refresh token —
    // avoid a flash of the login screen while that's in flight.
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-slate-950 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  return isAuthed ? children : <Navigate to="/login" replace />;
}

function App() {
  useEffect(() => {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ar');
  }, []);

  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth><SettingsProvider><AppLayout /></SettingsProvider></RequireAuth>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/sales" element={<PosPage />} />
            <Route path="/sales/history" element={<SalesHistoryPage />} />
            <Route path="/purchases" element={<PurchasesPage />} />
            <Route path="/purchases/history" element={<PurchaseHistoryPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailsPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/suppliers/:id" element={<SupplierDetailsPage />} />
            <Route path="/cashbox" element={<CashboxPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        <Toaster position="top-center" richColors dir="rtl" />
      </Router>
    </AuthProvider>
  );
}

export default App;