import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

// Handles callback redirects from Google OAuth and sets credentials.
export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleOAuthCallback } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');
    const error = searchParams.get('error');

    if (error) {
      // OAuth failed — goes back to login with an error flag
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    if (token) {
      handleOAuthCallback(token, refreshToken)
        .then(() => navigate('/videos', { replace: true }))
        .catch(() => navigate('/login?error=oauth_failed', { replace: true }));
    } else {
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate, handleOAuthCallback]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 2,
        background: 'linear-gradient(135deg, #0a0a0f 0%, #12121f 100%)',
      }}
    >
      <CircularProgress size={48} sx={{ color: '#E50914' }} />
      <Typography variant="h6" sx={{ color: '#e2e8f0' }}>
        Signing you in with Google…
      </Typography>
    </Box>
  );
}
