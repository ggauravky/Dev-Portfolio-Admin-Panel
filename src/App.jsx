import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy } from 'react';
import Login from './pages/admin/Login';
import AdminRoutes from './routes/AdminRoutes';
import { AdminAuthProvider } from './context/AdminAuth';
import { workspaceRoutes } from './routes/workspace';
import { PageHeader, TextLink } from './components/ui/Primitives';

const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const BusinessPage = lazy(() => import('./pages/admin/business/Registry'));
const System = lazy(() => import('./pages/admin/business/System'));
const Chats = lazy(() => import('./pages/admin/Chats'));
const Finance = lazy(() => import('./pages/admin/Finance'));
const pages = { dashboard: Dashboard, business: BusinessPage, system: System, chats: Chats, finance: Finance };

function NotFound() {
  return <div className="space-y-5">
    <PageHeader title="Page unavailable" description="The requested workspace page could not be found." />
    <TextLink to="/admin">Return to overview</TextLink>
  </div>;
}

function App() {
    return (
        <BrowserRouter>
          <AdminAuthProvider>
            <Routes>
                <Route path="/" element={<Navigate to="/admin" />} />
                <Route path="/admin/login" element={<Login />} />

                {/* Protected admin routes */}
                <Route element={<AdminRoutes />}>
                    {workspaceRoutes.map(({ path, page, props }) => {
                      const View = pages[page];
                      return <Route path={path} key={path} element={<View {...props} />} />;
                    })}
                    <Route path="/admin/*" element={<NotFound />} />
                </Route>
            </Routes>
          </AdminAuthProvider>
        </BrowserRouter>
    );
}

export default App;
