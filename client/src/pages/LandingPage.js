import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import axios from 'axios';
// @mui
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  IconButton,
  Container,
  Stack,
  TextField,
  Link,
  InputAdornment,
  Menu,
  MenuItem,
  Grid,
  Card,
  CardMedia,
  CardContent,
  useTheme,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  ClickAwayListener,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Search,
  Category as CategoryIcon,
  LightMode,
  DarkMode,
  PlayArrow,
  Tv,
  Devices,
  Speed,
  Favorite,
  VolumeUp,
  Fullscreen,
  Pause,
  ChevronRight,
  TrendingUp,
  Close,
} from '@mui/icons-material';

// Contexts & Components
import { useThemeMode } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/logo';
import { API_SERVER } from '../constants';
import { getThumbnailUrl } from '../utils/resolveAsset';

// ----------------------------------------------------------------------

const CATEGORIES = ['All', 'Action', 'Comedy', 'Drama', 'Romance', 'Horror', 'Thriller & Mystery', 'Sci-Fi & Fantasy', 'Documentary', 'Others'];

export default function LandingPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { themeMode, toggleThemeMode } = useThemeMode();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const hasToken = !!localStorage.getItem('token');
  const isUserLoggedIn = isAuthenticated || (authLoading && hasToken);

  // Search and Category state for filtering showcase cards
  const [searchVal, setSearchVal] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [contentTypeFilter, setContentTypeFilter] = useState('All'); // 'All', 'movie', 'tvshow'

  const [currentPage, setCurrentPage] = useState(1);
  const [nextPageDialogOpen, setNextPageDialogOpen] = useState(false);

  // Autocomplete state
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  // Loaded database videos and shows
  const [videos, setVideos] = useState([]);

  // Fetch shows and videos on mount
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const [videosRes, showsRes] = await Promise.all([
          axios.post(`${API_SERVER}/api/videos/search`, { limit: 200 }),
          axios.get(`${API_SERVER}/api/shows/`),
        ]);

        const rawVids = videosRes.data || [];
        const movies = rawVids
          .filter((v) => v.contentType !== 'episode')
          .map((v) => ({ ...v, isTVShow: false }));

        const shows = (showsRes.data?.data || []).map((s) => {
          const showCats = new Set();
          if (s.seasons) {
            s.seasons.forEach((season) => {
              season.episodes?.forEach((ep) => {
                const matched = rawVids.find((v) => v._id?.toString() === ep.videoId?.toString());
                if (matched && matched.category) showCats.add(matched.category);
              });
            });
          }
          return {
            ...s,
            isTVShow: true,
            categories: Array.from(showCats),
          };
        });

        const combined = [...shows, ...movies];
        const uniqueVideos = [];
        const seenIds = new Set();
        const seenTitles = new Set();
        combined.forEach((item) => {
          const idStr = item._id?.toString();
          const titleNorm = item.title?.trim().toLowerCase();
          if (!seenIds.has(idStr) && !seenTitles.has(titleNorm)) {
            uniqueVideos.push(item);
            if (idStr) seenIds.add(idStr);
            if (titleNorm) seenTitles.add(titleNorm);
          }
        });

        setVideos(uniqueVideos);
      } catch (error) {
        console.error('Error fetching landing page content:', error);
      }
    };
    fetchContent();
  }, []);

  // Categories Menu anchor
  const [anchorEl, setAnchorEl] = useState(null);
  const isMenuOpen = Boolean(anchorEl);

  // Email Get Started State
  const [getStartedEmail, setGetStartedEmail] = useState('');
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  const handleOpenMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleCategorySelect = (category) => {
    setContentTypeFilter('All'); // Show all content matching the category (movies or TV shows)
    setSelectedCategory(category);
    handleCloseMenu();
    // Scroll to videos showcase section
    const showcaseSection = document.getElementById('explore-section');
    if (showcaseSection) {
      showcaseSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleContentTypeSelect = (type) => {
    setContentTypeFilter(type);
    setSelectedCategory('All');
    // Scroll to videos showcase section
    const showcaseSection = document.getElementById('explore-section');
    if (showcaseSection) {
      showcaseSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleNavbarLinkClick = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
    setSearchVal(''); // Reset search results view but keep autocomplete query
  };

  const handleGetStartedSubmit = async (e) => {
    e.preventDefault();
    if (!getStartedEmail || !getStartedEmail.trim()) {
      setEmailError('Email address is required.');
      return;
    }
    // Simple email regex check
    if (!/\S+@\S+\.\S+/.test(getStartedEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setEmailError('');
    setEmailCheckLoading(true);

    try {
      const response = await axios.post(`${API_SERVER}/api/auth/check-email`, { email: getStartedEmail.trim() });
      const exists = response.data?.exists;
      if (exists) {
        navigate(`/login?email=${encodeURIComponent(getStartedEmail.trim())}`);
      } else {
        navigate(`/register?email=${encodeURIComponent(getStartedEmail.trim())}`);
      }
    } catch (err) {
      console.error('Email check failed, falling back to register', err);
      // Fallback
      navigate(`/register?email=${encodeURIComponent(getStartedEmail.trim())}`);
    } finally {
      setEmailCheckLoading(false);
    }
  };

  // Local autocomplete search suggestion list
  const suggestions = useMemo(() => {
    const q = autocompleteQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return videos
      .filter((item) => 
        item.title?.toLowerCase().includes(q) || 
        item.description?.toLowerCase().includes(q) ||
        (item.isTVShow 
          ? (item.categories || []).some(cat => cat?.toLowerCase().includes(q))
          : item.category?.toLowerCase().includes(q)
        )
      )
      .slice(0, 8);
  }, [videos, autocompleteQuery]);

  const handleSearchInputChange = (e) => {
    const val = e.target.value;
    setAutocompleteQuery(val);
    setSuggestionsOpen(val.trim().length >= 2);
  };

  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      setSuggestionsOpen(false);
      setSearchVal(autocompleteQuery);
      // Scroll to showcase section
      const showcaseSection = document.getElementById('explore-section');
      if (showcaseSection) {
        showcaseSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleSuggestionClick = (item) => {
    setSuggestionsOpen(false);
    navigate('/login');
  };

  // Filtered actual videos based on search input and categories dropdown selection
  const filteredMockVideos = useMemo(() => {
    let rawFiltered = videos;

    // Apply sorting if logged in (to get top 25 trending content)
    if (isAuthenticated) {
      rawFiltered = [...rawFiltered].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    }

    rawFiltered = rawFiltered.filter((video) => {
      // 1. Content Type Filter
      if (contentTypeFilter === 'movie' && video.isTVShow) return false;
      if (contentTypeFilter === 'tvshow' && !video.isTVShow) return false;

      // 2. Category Filter
      let matchesCategory = false;
      if (selectedCategory === 'All') {
        matchesCategory = true;
      } else if (video.isTVShow) {
        matchesCategory = (video.categories || []).some(
          (cat) => cat?.toLowerCase() === selectedCategory.toLowerCase()
        );
      } else {
        matchesCategory = video.category?.toLowerCase() === selectedCategory.toLowerCase();
      }

      // 3. Search Filter
      const matchesSearch =
        !searchVal.trim() ||
        video.title?.toLowerCase().includes(searchVal.toLowerCase()) ||
        video.description?.toLowerCase().includes(searchVal.toLowerCase()) ||
        (video.isTVShow 
          ? (video.categories || []).some(cat => cat?.toLowerCase().includes(searchVal.toLowerCase()))
          : video.category?.toLowerCase().includes(searchVal.toLowerCase())
        );

      return matchesCategory && matchesSearch;
    });

    if (isAuthenticated) {
      // Top 25 max items
      return rawFiltered.slice(0, 25);
    }

    // Limit based on selection type:
    // If 'tvshow', limit to 4.
    // If 'movie', limit to 4.
    // If 'All', limit to 5.
    if (contentTypeFilter === 'movie') {
      return rawFiltered.slice(0, 4);
    }
    if (contentTypeFilter === 'tvshow') {
      return rawFiltered.slice(0, 4);
    }
    return rawFiltered.slice(0, 5);
  }, [videos, contentTypeFilter, selectedCategory, searchVal, isAuthenticated]);

  const totalPages = useMemo(() => {
    if (!isAuthenticated) return 1;
    return Math.ceil(filteredMockVideos.length / 10) || 1;
  }, [filteredMockVideos, isAuthenticated]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const paginatedMockVideos = useMemo(() => {
    if (!isAuthenticated) return filteredMockVideos;
    const startIndex = (currentPage - 1) * 10;
    return filteredMockVideos.slice(startIndex, startIndex + 10);
  }, [filteredMockVideos, currentPage, isAuthenticated]);

  return (
    <>
      <Helmet>
        <title>StreamSphere — Welcome to the StreamSphere</title>
      </Helmet>

      {/* Main Page Container */}
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          color: 'text.primary',
        }}
      >
        {/* Navigation Bar */}
        <AppBar
          position="sticky"
          sx={{
            bgcolor: themeMode === 'dark' ? '#080808' : '#fff',
            backgroundImage: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Container maxWidth="xl">
            <Toolbar disableGutters sx={{ justifyContent: 'space-between', height: 70 }}>
              {/* Left Side: Logo & Links */}
              <Stack direction="row" alignItems="center" spacing={3}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Logo sx={{ width: 35, height: 35 }} />
                  <Link component={RouterLink} to="/" sx={{ textDecoration: 'none', color: 'primary.main', display: 'flex', alignItems: 'center' }}>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 800,
                        color: 'primary.main',
                        letterSpacing: -0.5,
                        fontFamily: 'Public Sans, sans-serif',
                        display: { xs: 'none', sm: 'block' },
                      }}
                    >
                      StreamSphere
                    </Typography>
                  </Link>
                </Stack>

                {/* Navbar Buttons (Amazon layout: Home, Movies, TV Shows adjacent to logo) */}
                <Stack direction="row" alignItems="center" spacing={1} sx={{ display: { xs: 'none', md: 'flex' } }}>
                  <Button
                    onClick={() => handleNavbarLinkClick('hero-section')}
                    sx={{ color: 'text.primary', fontWeight: 600, px: 2, '&:hover': { color: 'primary.main' } }}
                  >
                    Home
                  </Button>
                  <Button
                    onClick={() => handleContentTypeSelect('movie')}
                    sx={{ color: 'text.primary', fontWeight: 600, px: 2, '&:hover': { color: 'primary.main' } }}
                  >
                    Movies
                  </Button>
                  <Button
                    onClick={() => handleContentTypeSelect('tvshow')}
                    sx={{ color: 'text.primary', fontWeight: 600, px: 2, '&:hover': { color: 'primary.main' } }}
                  >
                    TV shows
                  </Button>

                  {/* Amazon style categories dropdown */}
                  <Button
                    onClick={handleOpenMenu}
                    startIcon={<CategoryIcon />}
                    sx={{
                      color: 'text.primary',
                      fontWeight: 600,
                      px: 2,
                      ml: 1,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                      textTransform: 'none',
                      '&:hover': {
                        borderColor: 'primary.main',
                        color: 'primary.main',
                      },
                    }}
                  >
                    Categories
                  </Button>
                  <Menu anchorEl={anchorEl} open={isMenuOpen} onClose={handleCloseMenu} sx={{ mt: 1 }}>
                    {CATEGORIES.map((category) => (
                      <MenuItem
                        key={category}
                        selected={category === selectedCategory}
                        onClick={() => handleCategorySelect(category)}
                        sx={{ minWidth: 160 }}
                      >
                        {category}
                      </MenuItem>
                    ))}
                  </Menu>
                </Stack>
              </Stack>

              {/* Right Side: Search Icon + Search bar, Light/Dark mode, Sign In */}
              <Stack direction="row" alignItems="center" spacing={2}>
                {/* Autocomplete Search Bar */}
                <ClickAwayListener onClickAway={() => setSuggestionsOpen(false)}>
                  <Box sx={{ position: 'relative', width: { xs: 200, sm: 300, md: 340 } }}>
                    <Stack direction="row" spacing={1}>
                      <TextField
                        id="video-search-input"
                        placeholder="Search titles, genres..."
                        value={autocompleteQuery}
                        onChange={handleSearchInputChange}
                        onKeyDown={handleSearchSubmit}
                        autoComplete="off"
                        size="small"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Search sx={{ color: 'text.secondary', width: 20, height: 20 }} />
                            </InputAdornment>
                          ),
                          endAdornment: autocompleteQuery ? (
                            <InputAdornment position="end">
                              <IconButton
                                aria-label="clear search text"
                                onClick={() => {
                                  setAutocompleteQuery('');
                                  setSearchVal('');
                                  setSuggestionsOpen(false);
                                }}
                                edge="end"
                                size="small"
                              >
                                <Close sx={{ fontSize: 20 }} />
                              </IconButton>
                            </InputAdornment>
                          ) : null,
                        }}
                        sx={{
                          flexGrow: 1,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1,
                            bgcolor: themeMode === 'dark' ? '#141414' : '#f5f5f5',
                            '& fieldset': {
                              borderColor: 'transparent',
                            },
                            '&:hover fieldset': {
                              borderColor: 'primary.main',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: 'primary.main',
                            },
                          },
                        }}
                      />
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSearchSubmit}
                        size="small"
                        sx={{
                          px: 2.5,
                          borderRadius: 1,
                          fontWeight: 'fontWeightBold',
                          textTransform: 'none',
                        }}
                      >
                        Search
                      </Button>
                    </Stack>

                    {/* Suggestions Dropdown */}
                    {suggestionsOpen && suggestions.length > 0 && (
                      <Paper
                        elevation={8}
                        sx={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          mt: 0.5,
                          zIndex: 1300,
                          maxHeight: 360,
                          overflowY: 'auto',
                          bgcolor: 'background.paper',
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                          '&::-webkit-scrollbar': { width: 4 },
                          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 },
                        }}
                      >
                        <List dense disablePadding>
                          {suggestions.map((video, index) => (
                            <Box key={video._id}>
                              <ListItem
                                button
                                id={`suggestion-${video._id}`}
                                onClick={() => handleSuggestionClick(video)}
                                sx={{
                                  py: 1,
                                  px: 2,
                                  cursor: 'pointer',
                                  '&:hover': { bgcolor: 'action.hover' },
                                  transition: 'background 0.15s',
                                }}
                              >
                                <ListItemAvatar sx={{ minWidth: 52 }}>
                                  <Avatar
                                    src={video.thumbnailUrl || ''}
                                    variant="rounded"
                                    sx={{ width: 40, height: 28, borderRadius: 1, bgcolor: 'background.default' }}
                                  >
                                    <Search sx={{ fontSize: 16, color: 'text.secondary' }} />
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={
                                    <Typography variant="body2" sx={{ fontWeight: 'fontWeightMedium', lineHeight: 1.3, color: 'text.primary' }} noWrap>
                                      {video.title}
                                    </Typography>
                                  }
                                  secondary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                                      <CategoryIcon sx={{ fontSize: 11, color: 'primary.main' }} />
                                      <Typography variant="caption" sx={{ color: 'primary.main', fontSize: '0.68rem' }}>
                                        {video.isTVShow ? 'TV Show' : (video.category || 'General')}
                                      </Typography>
                                      {video.viewCount > 0 && (
                                        <>
                                          <TrendingUp sx={{ fontSize: 11, color: 'text.disabled', ml: 0.5 }} />
                                          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>
                                            {video.viewCount.toLocaleString()} views
                                          </Typography>
                                        </>
                                      )}
                                    </Box>
                                  }
                                />
                              </ListItem>
                              {index < suggestions.length - 1 && <Divider sx={{ opacity: 0.4 }} />}
                            </Box>
                          ))}
                        </List>
                        <Box
                          sx={{
                            px: 2, py: 1,
                            borderTop: '1px solid',
                            borderColor: 'divider',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                          onClick={handleSearchSubmit}
                        >
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Press Enter or click to see all results for &ldquo;{autocompleteQuery}&rdquo;
                          </Typography>
                        </Box>
                      </Paper>
                    )}
                  </Box>
                </ClickAwayListener>

                {/* Light/Dark mode button */}
                <IconButton onClick={toggleThemeMode} sx={{ color: 'text.primary' }}>
                  {themeMode === 'dark' ? <LightMode /> : <DarkMode />}
                </IconButton>

                {/* Sign In / Watch Now Button */}
                <Button
                  variant="contained"
                  onClick={() => navigate(isUserLoggedIn ? '/videos' : '/login')}
                  sx={{
                    bgcolor: 'primary.main',
                    color: '#fff',
                    fontWeight: 700,
                    px: 3,
                    borderRadius: 1,
                    textTransform: 'none',
                    boxShadow: '0 4px 10px rgba(229, 9, 20, 0.3)',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                      boxShadow: '0 4px 14px rgba(229, 9, 20, 0.5)',
                    },
                  }}
                >
                  {isUserLoggedIn ? 'Watch Now' : 'Sign In'}
                </Button>
              </Stack>
            </Toolbar>
          </Container>
        </AppBar>

        {/* Hero Banner Section */}
        <Box
          id="hero-section"
          sx={{
            py: { xs: 8, md: 12 },
            position: 'relative',
            background:
              themeMode === 'dark'
                ? 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(8,8,8,1) 100%), url("https://images.unsplash.com/photo-1574375927938-d5a98e8fed85?w=1600")'
                : 'linear-gradient(to bottom, rgba(255,255,255,0.8) 0%, rgba(249,250,251,1) 100%), url("https://images.unsplash.com/photo-1574375927938-d5a98e8fed85?w=1600")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            textAlign: 'center',
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Container maxWidth="md">
            <Typography
              variant="overline"
              sx={{
                color: 'primary.main',
                fontWeight: 800,
                letterSpacing: 2,
                fontSize: { xs: '0.8rem', sm: '1rem' },
              }}
            >
              Premium OTT Platform
            </Typography>
            <Typography
              variant="h1"
              sx={{
                fontWeight: 900,
                mt: 1,
                mb: 3,
                letterSpacing: -1,
                lineHeight: 1.1,
                fontSize: { xs: '2.5rem', sm: '4rem', md: '4.5rem' },
                background:
                  themeMode === 'dark'
                    ? 'linear-gradient(45deg, #fff 30%, #E50914 90%)'
                    : 'linear-gradient(45deg, #161C24 30%, #E50914 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Welcome to the StreamSphere
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: 'text.secondary',
                mb: 4,
                fontWeight: 500,
                lineHeight: 1.6,
                fontSize: { xs: '1.1rem', sm: '1.4rem' },
              }}
            >
              A modern OTT platform for premium content streaming. Dive into an infinite library of blockbuster movies, engaging TV shows, gripping thrillers, and captivating documentaries.
            </Typography>

            {/* Email Get Started Bar */}
            {!isUserLoggedIn && (
              <Box sx={{ mt: 5, mb: 4 }}>
                <Typography
                  variant="h6"
                  sx={{
                    color: themeMode === 'dark' ? '#fff' : '#161C24',
                    fontWeight: 600,
                    mb: 2,
                  }}
                >
                  Ready to watch? Enter your email to create or restart your membership.
                </Typography>
                <Box
                  component="form"
                  onSubmit={handleGetStartedSubmit}
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    maxWidth: 650,
                    mx: 'auto',
                    gap: { xs: 1.5, sm: 0 },
                    width: '100%',
                  }}
                >
                  <TextField
                    fullWidth
                    placeholder="Email address"
                    value={getStartedEmail}
                    onChange={(e) => {
                      setGetStartedEmail(e.target.value);
                      setEmailError('');
                    }}
                    error={!!emailError}
                    helperText={emailError}
                    FormHelperTextProps={{
                      sx: {
                        color: 'error.main',
                        fontSize: '0.85rem',
                        mt: 0.5,
                        textAlign: 'left',
                        fontWeight: 600,
                      },
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: { xs: 1, sm: '4px 0 0 4px' },
                        bgcolor: themeMode === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)',
                        color: 'text.primary',
                        height: 56,
                        '& fieldset': {
                          borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
                          borderWidth: 1.5,
                        },
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={emailCheckLoading}
                    endIcon={<ChevronRight sx={{ fontSize: 24 }} />}
                    sx={{
                      bgcolor: 'primary.main',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '1.15rem',
                      height: 56,
                      px: 4,
                      minWidth: 180,
                      whiteSpace: 'nowrap',
                      borderRadius: { xs: 1, sm: '0 4px 4px 0' },
                      textTransform: 'none',
                      boxShadow: 'none',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      },
                    }}
                  >
                    {emailCheckLoading ? 'Checking...' : 'Get Started'}
                  </Button>
                </Box>
              </Box>
            )}

            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                size="large"
                onClick={() => handleNavbarLinkClick('explore-section')}
                sx={{
                  borderColor: themeMode === 'dark' ? '#fff' : 'primary.main',
                  color: themeMode === 'dark' ? '#fff' : 'primary.main',
                  px: 4,
                  py: 1.2,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  borderRadius: 1,
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover',
                  },
                }}
              >
                Browse Preview
              </Button>
            </Stack>
          </Container>
        </Box>

        {/* "What is StreamSphere" Section */}
        <Container id="about-section" maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700 }}>
                About the Platform
              </Typography>
              <Typography variant="h2" sx={{ fontWeight: 800, mt: 1, mb: 3 }}>
                What is StreamSphere?
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: '1.1rem', mb: 3, lineHeight: 1.7 }}>
                StreamSphere is a state-of-the-art streaming platform engineered to deliver cinema-grade high-fidelity videos straight to your devices. Built for creators and viewers alike, StreamSphere features real-time notifications, a highly responsive design, dark/light styling options, and custom playlists.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: '1.1rem', lineHeight: 1.7 }}>
                Whether you want to experience heart-pounding action, laugh out loud with comedies, get lost in dramatic stories, or dive into factual documentaries, StreamSphere is your ultimate digital dashboard.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  position: 'relative',
                  borderRadius: 2,
                  overflow: 'hidden',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Box
                  component="img"
                  src="/streamsphere_banner.png"
                  alt="StreamSphere Experience"
                  sx={{ width: '100%', height: 'auto', display: 'block' }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(to right, rgba(0,0,0,0.4), transparent)',
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </Container>

        {/* Demo Video Section */}
        <Box
          id="demo-section"
          sx={{
            py: { xs: 8, md: 12 },
            bgcolor: themeMode === 'dark' ? '#0d0d0d' : '#f4f6f8',
            borderTop: `1px solid ${theme.palette.divider}`,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Container maxWidth="md">
            <Box textAlign="center" sx={{ mb: 6 }}>
              <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700 }}>
                Platform Walkthrough
              </Typography>
              <Typography variant="h2" sx={{ fontWeight: 800, mt: 1, mb: 2 }}>
                See StreamSphere In Action
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', maxW: 600, mx: 'auto' }}>
                Explore the premium features, dashboard uploads, watchlist additions, and fluid playbacks. Play the walkthrough video below to learn more about the project.
              </Typography>
            </Box>

            {/* Custom Interactive Demo Video Placeholder */}
            <Box
              sx={{
                width: '100%',
                aspectRatio: '16/9',
                borderRadius: 2,
                overflow: 'hidden',
                position: 'relative',
                background: 'linear-gradient(135deg, #000 0%, #161c24 100%)',
                border: '3px solid #E50914',
                boxShadow: '0 20px 40px rgba(229, 9, 20, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                color: '#fff',
                p: 3,
              }}
            >
              {/* Top Bar of Mock Player */}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box
                    sx={{ width: 8, height: 8, bgcolor: 'primary.main', borderRadius: '50%', animation: 'pulse 1.5s infinite' }}
                  />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: 0.5, color: '#e50914' }}>
                    DEMO PLAYER
                  </Typography>
                </Stack>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  1080p Full HD
                </Typography>
              </Stack>

              {/* Center Play Button Overlay */}
              <Box
                sx={{
                  alignSelf: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  '&:hover .play-circle': {
                    transform: 'scale(1.1)',
                    bgcolor: 'primary.main',
                  },
                }}
              >
                <Box
                  className="play-circle"
                  sx={{
                    width: 70,
                    height: 70,
                    borderRadius: '50%',
                    bgcolor: 'rgba(229, 9, 20, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s',
                    mb: 2,
                    boxShadow: '0 4px 20px rgba(229, 9, 20, 0.5)',
                  }}
                >
                  <PlayArrow sx={{ fontSize: 40, color: '#fff', ml: 0.5 }} />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                  Demo Video Coming Soon
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>
                  The walkthough demonstration will display here.
                </Typography>
              </Box>

              {/* Bottom Controls Bar of Mock Player */}
              <Box sx={{ width: '100%' }}>
                {/* Seekbar Line */}
                <Box sx={{ width: '100%', height: 4, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2, mb: 2, position: 'relative' }}>
                  <Box sx={{ width: '30%', height: '100%', bgcolor: 'primary.main', borderRadius: 2 }} />
                </Box>
                
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <IconButton size="small" sx={{ color: '#fff' }}>
                      <Pause sx={{ fontSize: 20 }} />
                    </IconButton>
                    <IconButton size="small" sx={{ color: '#fff' }}>
                      <VolumeUp sx={{ fontSize: 20 }} />
                    </IconButton>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      0:45 / 3:15
                    </Typography>
                  </Stack>
                  <IconButton size="small" sx={{ color: '#fff' }}>
                    <Fullscreen sx={{ fontSize: 20 }} />
                  </IconButton>
                </Stack>
              </Box>
            </Box>
          </Container>
        </Box>

        {/* "Reasons to Watch" Section */}
        <Container id="reasons-section" maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
          <Box textAlign="center" sx={{ mb: 8 }}>
            <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700 }}>
              Why Choose Us
            </Typography>
            <Typography variant="h2" sx={{ fontWeight: 800, mt: 1, mb: 2 }}>
              Reasons to Watch StreamSphere
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', maxW: 600, mx: 'auto' }}>
              Explore what makes our platform the leading selection for streaming quality, interactivity, and speed.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {[
              {
                icon: <Tv sx={{ fontSize: 40, color: 'primary.main' }} />,
                title: 'High-Fidelity Cinema Playback',
                desc: 'Stream your movies and learning content in glorious high-definition without lags, buffering, or resolution adjustments.',
              },
              {
                icon: <Devices sx={{ fontSize: 40, color: 'primary.main' }} />,
                title: 'Watch Across Any Device',
                desc: 'Pick up where you left off on your phone, tablet, laptop, or home television screens with automated session sync.',
              },
              {
                icon: <Speed sx={{ fontSize: 40, color: 'primary.main' }} />,
                title: 'Smart HLS Video Processing',
                desc: 'Our backend encodes files into adaptive bitrates, optimizing quality dynamically based on your internet speed.',
              },
              {
                icon: <Favorite sx={{ fontSize: 40, color: 'primary.main' }} />,
                title: 'Interactive Watchlist & Feedback',
                desc: 'Save videos for later, leave reviews, track view counts, and experience active socket processing notifications.',
              },
            ].map((reason, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    bgcolor: themeMode === 'dark' ? '#141414' : '#fff',
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 2,
                    p: 4,
                    transition: 'transform 0.3s, box-shadow 0.3s',
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  <Box sx={{ mb: 2 }}>{reason.icon}</Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
                    {reason.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                    {reason.desc}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>

        {/* Mock Showcase Explore Section */}
        <Box
          id="explore-section"
          sx={{
            py: { xs: 8, md: 12 },
            bgcolor: themeMode === 'dark' ? '#080808' : '#f9fafb',
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Container maxWidth="lg">
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="flex-end" sx={{ mb: 6 }}>
              <Box>
                <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700 }}>
                  Content Preview
                </Typography>
                {searchVal.trim() ? (
                  <>
                    <Typography variant="h2" sx={{ fontWeight: 800, mt: 1, mb: 2 }}>
                      Showing you the search results for &ldquo;{searchVal}&rdquo;
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                      Found {filteredMockVideos.length} matching result(s).
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography variant="h2" sx={{ fontWeight: 800, mt: 1, mb: 2 }}>
                      Discover Streaming Options
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                      Filter by category dropdown or search bar above to see the library contents.
                    </Typography>
                  </>
                )}
              </Box>
              {!searchVal.trim() && (
                <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 700 }}>
                  Selected Category: {selectedCategory} ({filteredMockVideos.length} found)
                </Typography>
              )}
            </Stack>

            {/* Showcase Grid */}
            {filteredMockVideos.length === 0 ? (
              <Box textAlign="center" sx={{ py: 8 }}>
                <Typography variant="h5" sx={{ color: 'text.secondary' }}>
                  No preview videos match your filters.
                </Typography>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => {
                    setSelectedCategory('All');
                    setSearchVal('');
                    setContentTypeFilter('All');
                    setAutocompleteQuery('');
                  }}
                  sx={{ mt: 2 }}
                >
                  Reset Filters
                </Button>
              </Box>
            ) : (
              <Grid container spacing={4}>
                {paginatedMockVideos.map((video) => (
                  <Grid item xs={6} sm={4} md={3} key={video._id}>
                    <Card
                      onClick={() => {
                        if (isAuthenticated) {
                          if (video.isTVShow) {
                            navigate(`/shows/${video._id}`);
                          } else {
                            navigate(`/videos/${video._id}`);
                          }
                        } else {
                          navigate('/login');
                        }
                      }}
                      sx={{
                        borderRadius: 2,
                        overflow: 'hidden',
                        height: '100%',
                        cursor: 'pointer',
                        bgcolor: themeMode === 'dark' ? '#141414' : '#fff',
                        border: `1px solid ${theme.palette.divider}`,
                        transition: 'transform 0.3s',
                        '&:hover': {
                          transform: 'scale(1.02)',
                        },
                      }}
                    >
                      <Box sx={{ position: 'relative', pt: '150%', overflow: 'hidden' }}>
                        <CardMedia
                          component="img"
                          image={getThumbnailUrl(video.thumbnailUrl, '/assets/images/covers/cover_default.jpg')}
                          alt={video.title}
                          sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {video.isTVShow && (
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: 8,
                              right: 8,
                              bgcolor: 'rgba(0,0,0,0.8)',
                              color: '#fff',
                              px: 1,
                              borderRadius: 0.5,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            {`${video.seasons?.length || 0} Seasons`}
                          </Box>
                        )}
                      </Box>
                      <CardContent sx={{ p: 3 }}>
                        <Typography
                          variant="overline"
                          sx={{
                            color: 'primary.main',
                            fontWeight: 700,
                            display: 'inline-block',
                            mb: 1,
                          }}
                        >
                          {video.isTVShow ? 'TV Show' : (video.category || 'General')}
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, lineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', height: 48 }}>
                          {video.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {video.isTVShow ? `${video.seasons?.reduce((sum, s) => sum + (s.episodes?.length || 0), 0)} Episodes` : `${video.viewCount || 0} views`}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}

             {isAuthenticated ? (
              /* Pagination Controls */
              <Stack direction="row" spacing={2} justifyContent="center" alignItems="center" sx={{ mt: 6 }}>
                <Button 
                  variant="outlined" 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  sx={{ borderRadius: 1 }}
                >
                  Previous
                </Button>
                <Typography variant="body1" sx={{ fontWeight: 'fontWeightBold' }}>
                  Page {currentPage} of {totalPages}
                </Typography>
                <Button 
                  variant="outlined" 
                  onClick={() => {
                    if (currentPage >= totalPages) {
                      setNextPageDialogOpen(true);
                    } else {
                      setCurrentPage(prev => prev + 1);
                    }
                  }}
                  sx={{ borderRadius: 1 }}
                >
                  Next
                </Button>
              </Stack>
            ) : (
              <Box textAlign="center" sx={{ mt: 8 }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/login')}
                  sx={{
                    bgcolor: 'primary.main',
                    color: '#fff',
                    px: 5,
                    py: 1.5,
                    fontWeight: 700,
                    fontSize: '1rem',
                    boxShadow: '0 4px 15px rgba(229, 9, 20, 0.4)',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                  }}
                >
                  Sign In to View All Videos
                </Button>
              </Box>
            )}
          </Container>
        </Box>

        {/* CTA banner */}
        {!isUserLoggedIn && (
          <Box sx={{ bgcolor: 'primary.main', color: '#fff', py: 8, textAlign: 'center' }}>
            <Container maxWidth="md">
              <Typography variant="h3" sx={{ fontWeight: 900, mb: 2 }}>
                Ready to Dive into StreamSphere?
              </Typography>
              <Typography variant="body1" sx={{ mb: 4, fontSize: '1.1rem', opacity: 0.9 }}>
                Create an account now to start building your personal watchlists, sharing feedback, and uploading your own streaming collections.
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/register')}
                sx={{
                  bgcolor: '#fff',
                  color: 'primary.main',
                  px: 5,
                  py: 1.5,
                  fontWeight: 800,
                  fontSize: '1rem',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                  },
                }}
              >
                Sign Up for Free
              </Button>
            </Container>
          </Box>
        )}

        {/* Footer */}
        <Box
          component="footer"
          sx={{
            py: 6,
            bgcolor: themeMode === 'dark' ? '#0d0d0d' : '#f4f6f8',
            textAlign: 'center',
            mt: 'auto',
            borderTop: `2px solid ${theme.palette.primary.main}`,
          }}
        >
          <Container>
            <Stack spacing={2} alignItems="center" justifyContent="center">
              {/* Logo in center */}
              <Stack direction="row" alignItems="center" spacing={1}>
                <Logo sx={{ width: 40, height: 40 }} />
                <Link component={RouterLink} to="/" sx={{ textDecoration: 'none', color: 'primary.main', display: 'flex', alignItems: 'center' }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 800,
                      color: 'primary.main',
                      letterSpacing: -0.5,
                      fontFamily: 'Public Sans, sans-serif',
                    }}
                  >
                    StreamSphere
                  </Typography>
                </Link>
              </Stack>

              {/* Copyright message */}
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                © 2026 StreamSphere. All rights reserved.
              </Typography>
            </Stack>
          </Container>
        </Box>
        <Dialog
          open={nextPageDialogOpen}
          onClose={() => setNextPageDialogOpen(false)}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
          PaperProps={{
            sx: {
              bgcolor: 'background.paper',
              borderRadius: 2,
              p: 1,
            }
          }}
        >
          <DialogTitle id="alert-dialog-title" sx={{ fontWeight: 'fontWeightBold', color: 'primary.main' }}>
            {"View More Content"}
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description" sx={{ color: 'text.primary', fontSize: '1.1rem' }}>
              Click on Watch Now to view more content.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setNextPageDialogOpen(false)} variant="contained" autoFocus>
              OK
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
}
