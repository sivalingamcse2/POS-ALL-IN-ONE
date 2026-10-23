import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import ActivateAccount from './pages/ActivateAccount';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import SupermarketPOS from './pages/SupermarketPOS';
import MobilePOS from './pages/MobilePOS';
import Menu from './pages/Menu';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import CRM from './pages/CRM';
import HRMS from './pages/HRMS';
import Orders from './pages/Orders';
import KitchenDisplay from './pages/KitchenDisplay';
import QRMenu from './pages/QRMenu';
import Kiosk from './pages/Kiosk';
import GuestOrdering from './pages/GuestOrdering';

function ProtectedRoute({ children, permission }) {
  const { isAuthenticated, hasPermission, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (permission && !hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}

function App() {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
      } />
      <Route path="/activate" element={<ActivateAccount />} />

      <Route path="/order/:tableId" element={<GuestOrdering />} />

      <Route path="/mobile-pos" element={
        <ProtectedRoute permission="POS">
          <MobilePOS />
        </ProtectedRoute>
      } />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        
        {/* Supermarket & Retail POS Terminal */}
        <Route path="supermarket-pos" element={
          <ProtectedRoute permission="POS">
            <SupermarketPOS />
          </ProtectedRoute>
        } />

        {/* Restaurant & Dining Table POS Terminal */}
        <Route path="pos" element={
          <ProtectedRoute permission="POS">
            <POS />
          </ProtectedRoute>
        } />

        {/* Storage & Cloud now lives inside Settings */}
        <Route path="storage" element={<Navigate to="/settings?tab=storage" replace />} />

        <Route path="menu" element={
          <ProtectedRoute permission="Inventory">
            <Menu />
          </ProtectedRoute>
        } />
        <Route path="inventory" element={
          <ProtectedRoute permission="Inventory">
            <Inventory />
          </ProtectedRoute>
        } />
        <Route path="reports" element={
          <ProtectedRoute permission="Reports">
            <Reports />
          </ProtectedRoute>
        } />
        <Route path="users" element={
          <ProtectedRoute permission="UserMgmt">
            <Navigate to="/settings?tab=users" replace />
          </ProtectedRoute>
        } />
        <Route path="crm" element={<CRM />} />
        <Route path="employees" element={<Navigate to="/hrms" replace />} />
        <Route path="hrms" element={<HRMS />} />
        <Route path="orders" element={<Orders />} />
        <Route path="kds" element={<KitchenDisplay />} />
        <Route path="qr-menu" element={<QRMenu />} />
        <Route path="kiosk" element={<Kiosk />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
