import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import DoseActionHandler from './components/DoseActionHandler';
import { I18nProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/ThemeContext';
import { PreferencesProvider } from '@/lib/PreferencesContext';
import { LockProvider } from '@/lib/LockContext';
import LockScreen from '@/components/LockScreen';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import Welcome from '@/pages/Welcome';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Terms from '@/pages/Terms';
import Privacy from '@/pages/Privacy';
import Dashboard from '@/pages/Dashboard';
import Medications from '@/pages/Medications';
import Adherence from '@/pages/Adherence';
import Seizures from '@/pages/Seizures';
import Sleep from '@/pages/Sleep';
import Info from '@/pages/Info';
import Settings from '@/pages/Settings';
import Patients from '@/pages/Patients';
import SideEffects from '@/pages/SideEffects';
import { Navigate } from 'react-router-dom';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  // Render routes — public routes are always accessible,
  // protected routes redirect to Welcome when unauthenticated
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/medications" element={<Medications />} />
          <Route path="/adherence" element={<Adherence />} />
          <Route path="/seizures" element={<Seizures />} />
          <Route path="/sleep" element={<Sleep />} />
          <Route path="/info" element={<Info />} />
          <Route path="/side-effects" element={<SideEffects />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/patients" element={<Patients />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <I18nProvider>
        <ThemeProvider>
          <PreferencesProvider>
            <LockProvider>
              <QueryClientProvider client={queryClientInstance}>
                <Router>
                  <ScrollToTop />
                  <DoseActionHandler />
                  <AuthenticatedApp />
                  <LockScreen />
                </Router>
                <Toaster />
              </QueryClientProvider>
            </LockProvider>
          </PreferencesProvider>
        </ThemeProvider>
      </I18nProvider>
    </AuthProvider>
  )
}

export default App