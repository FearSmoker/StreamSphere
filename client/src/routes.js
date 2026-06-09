import { Navigate, useRoutes } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
// layouts
import DashboardLayout from './layouts/dashboard';
import SimpleLayout from './layouts/simple';
// pages
import BlogPage from './pages/BlogPage';
import UserPage from './pages/UserPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import Page404 from './pages/Page404';
import ProductsPage from './pages/ProductsPage';
import VideoUploadPage from './pages/VideoUploadPage';
import VideoEditPage from './pages/VideoEditPage';
import VideoPlayerPage from './pages/VideoPlayerPage';
import VideoListPage from './pages/VideoListPage';
import VideosPage from './pages/VideosPage';
import DashboardAppPage from './pages/DashboardAppPage';
import WatchPage from './pages/WatchPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
// contexts
import { useAuth } from './contexts/AuthContext';

// ----------------------------------------------------------------------

// Guard component for authenticated routes
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Guard component for admin-only routes
function AdminRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return isAuthenticated && user.role === 'admin' ? children : <Navigate to="/videos" replace />;
}

export default function Router() {
  const routes = useRoutes([
    {
      path: '/',
      element: (
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      ),
      children: [
        { element: <Navigate to="/videos" />, index: true },
        { path: 'dashboard', element: <AdminRoute><DashboardAppPage /></AdminRoute> },
        { path: 'user', element: <AdminRoute><UserPage /></AdminRoute> },
        { path: 'products', element: <ProductsPage /> },
        { path: 'blog', element: <BlogPage /> },
        { path: 'video-upload', element: <AdminRoute><VideoUploadPage /></AdminRoute> },
        { path: 'videos/:id', element: <VideoPlayerPage /> },
        { path: 'watch/:id', element: <WatchPage /> },
        { path: 'video/update/:id', element: <AdminRoute><VideoEditPage /></AdminRoute> },
        { path: 'video-list', element: <AdminRoute><VideoListPage /></AdminRoute> },
        { path: 'videos', element: <VideosPage /> },
        { path: 'profile', element: <ProfilePage /> },
      ],
    },
    {
      path: 'login',
      element: <LoginPage />,
    },
    {
      path: 'register',
      element: <RegisterPage />,
    },
    {
      // Public route: Google redirects here after OAuth with tokens in query params
      path: 'oauth/callback',
      element: <OAuthCallbackPage />,
    },
    {
      element: <SimpleLayout />,
      children: [
        { element: <Navigate to="/videos" />, index: true },
        { path: '404', element: <Page404 /> },
        { path: '*', element: <Navigate to="/404" /> },
      ],
    },
    {
      path: '*',
      element: <Navigate to="/404" replace />,
    },
  ]);

  return routes;
}
