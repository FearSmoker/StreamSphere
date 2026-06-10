import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Link,
  Stack,
  IconButton,
  InputAdornment,
  TextField,
  Alert,
  Button,
  Divider,
  Typography,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { useAuth } from '../../../contexts/AuthContext';
import Iconify from '../../../components/iconify';

// Google icon SVG
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.8 2.4 30.3 0 24 0 14.8 0 6.9 5.4 2.9 13.3l7.8 6C12.5 13.1 17.8 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.1 5.2-4.5 6.8l7.2 5.6C43.1 36.8 46.1 31.1 46.1 24.5z"/>
      <path fill="#FBBC05" d="M10.7 28.5A14.6 14.6 0 0 1 9.5 24c0-1.6.3-3.1.7-4.5l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.5 10.8l8.2-6.3z"/>
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2.2 1.5-5 2.4-8.7 2.4-6.2 0-11.5-3.6-13.3-9.1l-8.2 6.3C6.9 42.6 14.8 48 24 48z"/>
    </svg>
  );
}

export default function LoginForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState(() => searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(() => {
    // Check for failed OAuth redirect
    return searchParams.get('error') === 'oauth_failed'
      ? 'Google sign-in failed. Please try again or use email & password.'
      : '';
  });
  const [warningMsg, setWarningMsg] = useState('');
  const warningTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setWarningMsg('');
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    try {
      await login(email, password);
      navigate('/videos', { replace: true });
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes("does not exist") || msg.toLowerCase().includes("user doesn't exist")) {
        setWarningMsg("User doesn't exist");
        warningTimeoutRef.current = setTimeout(() => {
          setWarningMsg('');
        }, 3000);
      } else if (msg.includes("password") || msg.toLowerCase().includes("incorrect")) {
        setWarningMsg("Incorrect password");
        warningTimeoutRef.current = setTimeout(() => {
          setWarningMsg('');
        }, 3000);
      } else {
        setErrorMsg(msg || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    // Redirect user to Google
    loginWithGoogle();
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={3}>
        {errorMsg && <Alert severity="error">{errorMsg}</Alert>}

        {/* Google login */}
        {warningMsg && (
          <Typography
            variant="body2"
            sx={{
              color: 'error.main',
              fontWeight: 'medium',
              textAlign: 'center',
              mb: 0.5,
              animation: 'fadeIn 0.2s ease-out',
              '@keyframes fadeIn': {
                from: { opacity: 0, transform: 'translateY(-4px)' },
                to: { opacity: 1, transform: 'translateY(0)' },
              },
            }}
          >
            {warningMsg}
          </Typography>
        )}
        <Button
          id="btn-google-signin"
          fullWidth
          size="large"
          variant="outlined"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          startIcon={<GoogleIcon />}
          sx={(theme) => ({
            borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
            color: theme.palette.mode === 'dark' ? '#e2e8f0' : '#475569',
            bgcolor: theme.palette.mode === 'dark' ? 'transparent' : '#f8fafc',
            textTransform: 'none',
            fontWeight: 500,
            '&:hover': {
              borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
              background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            },
          })}
        >
          {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
        </Button>

        <Divider sx={{ color: 'text.secondary' }}>
          <Typography variant="caption" sx={{ px: 1, color: 'text.secondary' }}>
            or sign in with email
          </Typography>
        </Divider>

        {/* Email login */}
        <TextField
          id="input-email"
          name="email"
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <TextField
          id="input-password"
          name="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                  <Iconify icon={showPassword ? 'eva:eye-fill' : 'eva:eye-off-fill'} />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      <Stack direction="row" alignItems="center" justifyContent="flex-end" sx={{ my: 2 }}>
        <Link variant="subtitle2" underline="hover">
          Forgot password?
        </Link>
      </Stack>

      <LoadingButton
        id="btn-email-signin"
        fullWidth
        size="large"
        type="submit"
        variant="contained"
        loading={loading}
      >
        Sign In
      </LoadingButton>
    </form>
  );
}
