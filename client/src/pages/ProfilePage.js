import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link as RouterLink } from 'react-router-dom';
// @mui
import {
  Container,
  Typography,
  Stack,
  Card,
  Grid,
  Avatar,
  TextField,
  Button,
  MenuItem,
  CircularProgress,
  Box,
  Alert,
} from '@mui/material';
// contexts
import { useAuth, api } from '../contexts/AuthContext';
// components
import VideoList from '../sections/@dashboard/products/VideoList';

const PRESET_AVATARS = [
  'https://res.cloudinary.com/desk6uyon/image/upload/v1780977340/streamsphere/avatars/avatar_1.jpg',
  'https://res.cloudinary.com/desk6uyon/image/upload/v1780977341/streamsphere/avatars/Felix.svg',
  'https://res.cloudinary.com/desk6uyon/image/upload/v1780977349/streamsphere/avatars/Aneka.svg',
  'https://res.cloudinary.com/desk6uyon/image/upload/v1780977358/streamsphere/avatars/Jack.svg',
  'https://res.cloudinary.com/desk6uyon/image/upload/v1780977369/streamsphere/avatars/Buster.svg',
  'https://res.cloudinary.com/desk6uyon/image/upload/v1780977377/streamsphere/avatars/Luna.svg',
];

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [theme, setTheme] = useState(user?.preferences?.theme || 'dark');
  const [language, setLanguage] = useState(user?.preferences?.language || 'en');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [videosLoading, setVideosLoading] = useState(false);
  const [watchlistVideos, setWatchlistVideos] = useState([]);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setAvatar(user.avatar);
      setTheme(user.preferences?.theme || 'dark');
      setLanguage(user.preferences?.language || 'en');
    }
  }, [user]);

  // Fetch watchlist videos from backend
  useEffect(() => {
    const fetchWatchlist = async () => {
      if (!user?.watchlist || user.watchlist.length === 0) {
        setWatchlistVideos([]);
        return;
      }
      setVideosLoading(true);
      try {
        const res = await api.post('/api/videos/search', {});
        if (res.data) {
          const filtered = res.data.filter((vid) => user.watchlist.includes(vid._id));
          setWatchlistVideos(filtered);
        }
      } catch (err) {
        console.error('Error fetching watchlist videos:', err);
      } finally {
        setVideosLoading(false);
      }
    };
    fetchWatchlist();
  }, [user?.watchlist]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('Username cannot be empty.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await updateProfile({
        username,
        avatar,
        preferences: { theme, language },
      });
      setSuccessMsg('Profile updated successfully!');
      setIsEditing(false);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title> Profile | StreamSphere </title>
      </Helmet>

      <Container maxWidth="lg">
        <Typography variant="h4" sx={{ mb: 5 }}>
          My Profile
        </Typography>

        {successMsg && <Alert severity="success" sx={{ mb: 3 }}>{successMsg}</Alert>}
        {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

        <Grid container spacing={4}>
          {/* Profile Overview Card */}
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Avatar
                src={avatar?.trim() ? avatar : 'https://res.cloudinary.com/desk6uyon/image/upload/v1780977340/streamsphere/avatars/avatar_1.jpg'}
                alt={user?.username}
                sx={{ width: 120, height: 120, mb: 2, border: '4px solid #54D62C' }}
              />
              <Typography variant="h5" gutterBottom>
                {user?.username}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                {user?.email}
              </Typography>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', px: 1.5, py: 0.5, bgcolor: 'action.selected', borderRadius: 0.75, mb: 3 }}>
                Role: {user?.role}
              </Typography>
              
              {!isEditing && (
                <Button variant="contained" color="inherit" onClick={() => setIsEditing(true)}>
                  Edit Profile
                </Button>
              )}
            </Card>
          </Grid>

          {/* Edit / Preferences Settings Card */}
          <Grid item xs={12} md={8}>
            <Card sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ mb: 3 }}>
                {isEditing ? 'Edit Profile & Settings' : 'Account Settings'}
              </Typography>

              <form onSubmit={handleSave}>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={!isEditing}
                      required
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label="Theme Preference"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      disabled={!isEditing}
                    >
                      <MenuItem value="dark">Dark Mode</MenuItem>
                      <MenuItem value="light">Light Mode</MenuItem>
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label="Language"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      disabled={!isEditing}
                    >
                      <MenuItem value="en">English</MenuItem>
                      <MenuItem value="es">Español</MenuItem>
                      <MenuItem value="fr">Français</MenuItem>
                    </TextField>
                  </Grid>

                  {isEditing && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                        Choose Avatar
                      </Typography>
                      <Grid container spacing={2}>
                        {PRESET_AVATARS.map((av) => (
                          <Grid item key={av}>
                            <Avatar
                              src={av}
                              sx={{
                                width: 50,
                                height: 50,
                                cursor: 'pointer',
                                border: avatar === av ? '3px solid #54D62C' : 'none',
                                '&:hover': { opacity: 0.8 },
                              }}
                              onClick={() => setAvatar(av)}
                            />
                          </Grid>
                        ))}
                      </Grid>
                    </Grid>
                  )}

                  {isEditing && (
                    <Grid item xs={12}>
                      <Stack direction="row" spacing={2} justifyContent="flex-end">
                        <Button
                          variant="outlined"
                          color="inherit"
                          onClick={() => {
                            setIsEditing(false);
                            setAvatar(user?.avatar || '');
                            setUsername(user?.username || '');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button variant="contained" type="submit" loading={loading}>
                          Save Changes
                        </Button>
                      </Stack>
                    </Grid>
                  )}
                </Grid>
              </form>
            </Card>
          </Grid>

          {/* Watchlist Section */}
          <Grid item xs={12}>
            <Card sx={{ p: 4, mt: 2 }}>
              <Typography variant="h5" sx={{ mb: 4 }}>
                My Watchlist
              </Typography>
              
              {videosLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : watchlistVideos.length > 0 ? (
                <VideoList videos={watchlistVideos} />
              ) : (
                <Box sx={{ py: 4, ...theme === 'dark' ? {} : {}, textAlign: 'center' }}>
                  <Typography variant="subtitle1" sx={{ color: 'text.secondary', mb: 2 }}>
                    Your watchlist is currently empty.
                  </Typography>
                  <Button variant="contained" component={RouterLink} to="/videos" color="inherit">
                    Browse Videos
                  </Button>
                </Box>
              )}
            </Card>
          </Grid>
        </Grid>
      </Container>
    </>
  );
}
