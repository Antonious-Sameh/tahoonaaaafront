import { useEffect } from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PosPage } from './pages/PosPage';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { PurchaseHistoryPage } from './pages/PurchaseHistoryPage';
import { InventoryPage } from './pages/InventoryPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailsPage } from './pages/CustomerDetailsPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { SupplierDetailsPage } from './pages/SupplierDetailsPage';
import { CashboxPage } from './pages/CashboxPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ActivityPage } from './pages/ActivityPage';

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
        <Toaster position="top-center" richColors dir="rtl" />
        <div id="print-portal" />
      </Router>
    </AuthProvider>
  );
}

export default App;
