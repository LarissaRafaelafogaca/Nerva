import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Pill, TrendingUp, Activity, Moon, Info, Settings, Users, LogOut, Menu, X, AlertCircle } from 'lucide-react';
import NervaLogo from './NervaLogo';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';

export default function AppLayout() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.profile === 'admin' || user?.role === 'admin';

  const navItems = [
    { path: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { path: '/medications', label: t('nav.medications'), icon: Pill },
    { path: '/adherence', label: t('nav.adherence'), icon: TrendingUp },
    { path: '/seizures', label: t('nav.seizures'), icon: Activity },
    { path: '/sleep', label: t('nav.sleep'), icon: Moon },
    { path: '/side-effects', label: t('nav.sideEffects'), icon: AlertCircle },
    { path: '/info', label: t('nav.info'), icon: Info },
    { path: '/settings', label: t('nav.settings'), icon: Settings },
  ];

  if (isAdmin) {
    navItems.splice(1, 0, { path: '/patients', label: t('nav.patients'), icon: Users });
  }

  const mobileNavItems = navItems.slice(0, 5);

  const handleLogout = () => {
    logout(false);
    navigate('/');
  };

  const NavButton = ({ item, onClick }) => {
    const active = location.pathname === item.path;
    return (
      <button
        onClick={() => { navigate(item.path); onClick?.(); }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
          active
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
      >
        <item.icon className="w-4.5 h-4.5 shrink-0" style={{ width: 18, height: 18 }} />
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 flex-col border-r border-border bg-sidebar">
        <div className="p-5 border-b border-border">
          <NervaLogo size={36} withText />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => (
            <NavButton key={item.path} item={item} />
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.full_name || user?.email}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {isAdmin ? t('auth.profileAdmin') : t('auth.profilePatient')}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
          >
            <LogOut className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
            {t('common.logout')}
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 border-b border-border bg-background/95 backdrop-blur">
        <NervaLogo size={30} withText />
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg hover:bg-accent"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-border flex flex-col animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <NervaLogo size={32} withText />
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg hover:bg-accent">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <NavButton key={item.path} item={item} onClick={() => setMobileOpen(false)} />
              ))}
            </nav>
            <div className="p-3 border-t border-border">
              <div className="px-3 py-2 mb-1">
                <p className="text-sm font-medium truncate">{user?.full_name || user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {isAdmin ? t('auth.profileAdmin') : t('auth.profilePatient')}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5"
              >
                <LogOut className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                {t('common.logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="lg:ml-60 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-16 border-t border-border bg-background/95 backdrop-blur px-1">
        {mobileNavItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium truncate max-w-[60px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}