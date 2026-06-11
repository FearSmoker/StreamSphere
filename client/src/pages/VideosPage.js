import { Helmet } from 'react-helmet-async';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

// @mui
import {
  Container,
  Stack,
  Typography,
  Box,
  TextField,
  Chip,
  Button,
  Grid,
  Card,
  CardMedia,
  CardContent,
  IconButton,
  InputAdornment,
  LinearProgress,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  ClickAwayListener,
} from '@mui/material';
import ReactPlayer from 'react-player';
import { PlayArrow, InfoOutlined, ArrowBackIosNew, ArrowForwardIos, Search, TrendingUp, Category, Close, VolumeUp, VolumeOff } from '@mui/icons-material';

import { API_SERVER, VIDEO_SERVER } from '../constants';
import { api } from '../contexts/AuthContext';
import { getThumbnailUrl } from '../utils/resolveAsset';
import Moment from 'react-moment';

const getRelativeHlsPath = (hlsPath) => {
  if (!hlsPath) return '';
  const normalized = hlsPath.replace(/\\/g, '/');
  const searchStr = 'uploads/hls/';
  const index = normalized.indexOf(searchStr);
  if (index !== -1) {
    return normalized.substring(index + searchStr.length);
  }
  return normalized.split('/').pop();
};

export default function VideosPage() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setSearchQuery('');
  }, [location.key]);

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Autocomplete state
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const [recommendedVideos, setRecommendedVideos] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);

  // Hero Carousel State
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const heroIntervalRef = useRef(null);

  const [scrollOpacity, setScrollOpacity] = useState(1);
  const [showCover, setShowCover] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      const offset = window.scrollY;
      const opacity = Math.max(0, 1 - offset / 400);
      setScrollOpacity(opacity);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setShowCover(true);
    const timer = setTimeout(() => {
      setShowCover(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [activeHeroIndex]);

  const categories = ['All', 'Action', 'Comedy', 'Drama', 'Romance', 'Horror', 'Thriller & Mystery', 'Sci-Fi & Fantasy', 'Documentary', 'Others'];

  useEffect(() => {
    const fetchVideosAndShows = async () => {
      setLoading(true);
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
          let totalViews = 0;
          const showCats = new Set();
          let firstEpisodeVideo = null;
          if (s.seasons) {
            s.seasons.forEach((season) => {
              season.episodes?.forEach((ep) => {
                const matched = rawVids.find((v) => v._id?.toString() === ep.videoId?.toString());
                if (matched) {
                  totalViews += matched.viewCount || 0;
                  if (matched.category) showCats.add(matched.category);
                  if (!firstEpisodeVideo) firstEpisodeVideo = matched;
                }
              });
            });
          }
          return {
            ...s,
            isTVShow: true,
            viewCount: totalViews,
            categories: Array.from(showCats),
            firstEpisodeVideo,
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
        console.error('Error fetching videos and shows:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchVideosAndShows();
  }, []);

  useEffect(() => {
    const fetchContinueWatching = async () => {
      try {
        const response = await api.get('/api/watch-history/continue');
        if (response.data && response.data.data) {
          const uniqueContinue = [];
          const seenIds = new Set();
          const seenTitles = new Set();
          response.data.data.forEach((item) => {
            if (item && item.video) {
              const idStr = item.video._id?.toString();
              const titleNorm = item.video.title?.trim().toLowerCase();
              if (!seenIds.has(idStr) && !seenTitles.has(titleNorm)) {
                uniqueContinue.push(item);
                if (idStr) seenIds.add(idStr);
                if (titleNorm) seenTitles.add(titleNorm);
              }
            }
          });
          setContinueWatching(uniqueContinue);
        }
      } catch (error) {
        console.error('Error fetching continue watching list:', error);
      }
    };
    fetchContinueWatching();
  }, []);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const [recVideosRes, showsRes] = await Promise.all([
          api.get('/api/videos/recommendations'),
          api.get('/api/shows/'),
        ]);

        const recVideos = (recVideosRes.data || [])
          .filter((v) => v.contentType !== 'episode')
          .map((v) => ({ ...v, isTVShow: false }));

        const shows = (showsRes.data?.data || []).map((s) => ({ ...s, isTVShow: true }));

        const combinedRecs = [];
        const maxLen = Math.max(recVideos.length, shows.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < shows.length) combinedRecs.push(shows[i]);
          if (i < recVideos.length) combinedRecs.push(recVideos[i]);
        }

        const uniqueRecs = [];
        const seenIds = new Set();
        const seenTitles = new Set();
        combinedRecs.forEach((item) => {
          const idStr = item._id?.toString();
          const titleNorm = item.title?.trim().toLowerCase();
          if (!seenIds.has(idStr) && !seenTitles.has(titleNorm)) {
            uniqueRecs.push(item);
            if (idStr) seenIds.add(idStr);
            if (titleNorm) seenTitles.add(titleNorm);
          }
        });

        setRecommendedVideos(uniqueRecs.slice(0, 10));
      } catch (error) {
        console.error('Error fetching recommendations:', error);
      }
    };
    fetchRecommendations();
  }, []);

  // Autocomplete: local suggestion filter
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
      setSearchQuery(autocompleteQuery);
    }
  };

  const handleSuggestionClick = (item) => {
    setSuggestionsOpen(false);
    if (item.isTVShow) {
      navigate(`/shows/${item._id}`);
    } else {
      navigate(`/videos/${item._id}`);
    }
  };

  // Filter & Sort Video Lists
  const trendingVideos = useMemo(() => {
    return [...videos]
      .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
      .slice(0, 10);
  }, [videos]);

  const heroVideos = useMemo(() => {
    // Hero carousel items
    return trendingVideos.slice(0, 4);
  }, [trendingVideos]);

  // Autoplay Hero Carousel
  useEffect(() => {
    if (heroVideos.length <= 1) return;
    
    heroIntervalRef.current = setInterval(() => {
      setActiveHeroIndex((prev) => (prev + 1) % heroVideos.length);
    }, 8000);

    return () => {
      if (heroIntervalRef.current) clearInterval(heroIntervalRef.current);
    };
  }, [heroVideos]);

  const handlePrevHero = () => {
    if (heroVideos.length === 0) return;
    setActiveHeroIndex((prev) => (prev - 1 + heroVideos.length) % heroVideos.length);
  };

  const handleNextHero = () => {
    if (heroVideos.length === 0) return;
    setActiveHeroIndex((prev) => (prev + 1) % heroVideos.length);
  };

  // Filtered List based on Category and Search
  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
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
      const matchesSearch = !searchQuery.trim() || 
        video.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        video.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (video.isTVShow 
          ? (video.categories || []).some(cat => cat?.toLowerCase().includes(searchQuery.toLowerCase()))
          : video.category?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      return matchesCategory && matchesSearch;
    });
  }, [videos, selectedCategory, searchQuery]);

  // Format Duration Helper
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const activeHero = heroVideos[activeHeroIndex];

  const glimpseUrl = useMemo(() => {
    if (!activeHero) return '';
    const videoObj = activeHero.isTVShow ? activeHero.firstEpisodeVideo : activeHero;
    if (!videoObj || !videoObj.hlsPath) return '';
    if (videoObj.hlsPath.startsWith('http://') || videoObj.hlsPath.startsWith('https://')) {
      return videoObj.hlsPath;
    }
    return `${VIDEO_SERVER}/${getRelativeHlsPath(videoObj.hlsPath)}`;
  }, [activeHero]);

  return (
    <>
      <Helmet>
        <title>Browse | StreamSphere</title>
      </Helmet>

      <Container maxWidth="xl" sx={{ pb: 6 }}>
        {/* Header and Global Search Bar */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
          <Box>
            <Typography variant="h3" sx={{ fontWeight: 'fontWeightBold', color: 'primary.main', mb: 0.5 }}>
              StreamSphere
            </Typography>
            <Typography variant="subtitle1" sx={{ color: 'text.secondary' }}>
              Explore premium streaming and on-demand content
            </Typography>
          </Box>
          {/* Autocomplete Search Bar */}
          <ClickAwayListener onClickAway={() => setSuggestionsOpen(false)}>
            <Box sx={{ position: 'relative', width: { xs: '100%', md: 420 } }}>
              <Stack direction="row" spacing={1}>
                <TextField
                  id="video-search-input"
                  placeholder="Search titles, genres..."
                  value={autocompleteQuery}
                  onChange={handleSearchInputChange}
                  onKeyDown={handleSearchSubmit}
                  autoComplete="off"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                    endAdornment: autocompleteQuery ? (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="clear search text"
                          onClick={() => {
                            setAutocompleteQuery('');
                            setSearchQuery('');
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
                      bgcolor: 'background.paper',
                      borderRadius: 2,
                    },
                  }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSearchSubmit}
                  sx={{
                    px: 3,
                    borderRadius: 2,
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
                          onClick={() => handleSuggestionClick(video._id)}
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
                              <Typography variant="body2" sx={{ fontWeight: 'fontWeightMedium', lineHeight: 1.3 }} noWrap>
                                {video.title}
                              </Typography>
                            }
                            secondary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                                <Category sx={{ fontSize: 11, color: 'primary.main' }} />
                                <Typography variant="caption" sx={{ color: 'primary.main', fontSize: '0.68rem' }}>
                                  {video.category || 'General'}
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
        </Stack>

        {/* Category Filters */}
        {searchQuery.trim() === '' && (
          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 3, mb: 2, '&::-webkit-scrollbar': { display: 'none' } }}>
            {categories.map((cat) => (
              <Chip
                key={cat}
                label={cat}
                clickable
                color={selectedCategory === cat ? 'primary' : 'default'}
                onClick={() => setSelectedCategory(cat)}
                sx={{
                  fontSize: '0.9rem',
                  fontWeight: 'fontWeightMedium',
                  px: 1,
                  py: 2,
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: selectedCategory === cat ? 'primary.main' : 'rgba(255, 255, 255, 0.1)',
                  bgcolor: selectedCategory === cat ? 'primary.main' : 'background.paper',
                }}
              />
            ))}
          </Stack>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 12 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : searchQuery.trim() || selectedCategory !== 'All' ? (
          // Search / Filter Grid View
          <Box>
            <Typography variant="h4" sx={{ mb: 3, fontWeight: 'fontWeightBold' }}>
              {searchQuery.trim()
                ? `Showing you the search results for "${searchQuery}"`
                : `Results (${filteredVideos.length})`}
            </Typography>
             {filteredVideos.length > 0 ? (
              <Grid container spacing={3}>
                {filteredVideos.map((video) => (
                  <Grid item xs={6} sm={4} md={3} key={video._id}>
                    <VideoItemCard video={video} formatDuration={formatDuration} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Box sx={{ textAlign: 'center', py: 10 }}>
                <Typography variant="h6" color="text.secondary">
                  No videos found matching your selection.
                </Typography>
              </Box>
            )}
          </Box>
        ) : (
          // Premium OTT Rows Layout
          <Stack spacing={5}>
            {/* Hero Carousel */}
            {activeHero && (
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  height: { xs: 320, md: 480 },
                  borderRadius: 3,
                  overflow: 'hidden',
                  opacity: scrollOpacity,
                  transition: 'opacity 0.15s ease-out',
                  boxShadow: 'inset 0 0 80px rgba(0,0,0,0.95)',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to right, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.85) 100%)',
                    zIndex: 1,
                  },
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '50%',
                    background: 'linear-gradient(to top, rgba(8,8,8,1), rgba(8,8,8,0))',
                    zIndex: 2,
                  },
                }}
              >
                {!showCover && glimpseUrl && (
                  <ReactPlayer
                    url={glimpseUrl}
                    playing={!showCover}
                    muted={isMuted}
                    width="100%"
                    height="100%"
                    loop
                    playsinline
                    config={{
                      file: {
                        forceHLS: true,
                        attributes: {
                          style: { objectFit: 'cover', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }
                        }
                      }
                    }}
                    style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}
                  />
                )}

                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `url(${getThumbnailUrl(activeHero.coverUrl || activeHero.thumbnailUrl, '/assets/images/covers/cover_default.jpg')})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    transition: 'opacity 0.8s ease-in-out',
                    opacity: showCover ? 1 : 0,
                    zIndex: 0,
                  }}
                />

                {!showCover && glimpseUrl && (
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted(!isMuted);
                    }}
                    sx={{
                      position: 'absolute',
                      bottom: { xs: 24, md: 48 },
                      right: { xs: 16, md: 48 },
                      zIndex: 10,
                      color: 'common.white',
                      bgcolor: 'rgba(0,0,0,0.5)',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                    }}
                  >
                    {isMuted ? <VolumeOff /> : <VolumeUp />}
                  </IconButton>
                )}

                {/* Carousel Controls */}
                {heroVideos.length > 1 && (
                  <>
                    <IconButton
                      onClick={handlePrevHero}
                      sx={{
                        position: 'absolute',
                        left: 16,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 3,
                        color: 'common.white',
                        bgcolor: 'rgba(0,0,0,0.5)',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                      }}
                    >
                      <ArrowBackIosNew />
                    </IconButton>
                    <IconButton
                      onClick={handleNextHero}
                      sx={{
                        position: 'absolute',
                        right: 16,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 3,
                        color: 'common.white',
                        bgcolor: 'rgba(0,0,0,0.5)',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                      }}
                    >
                      <ArrowForwardIos />
                    </IconButton>
                  </>
                )}

                {/* Hero Content Panel */}
                <Stack
                  spacing={2}
                  sx={{
                    position: 'absolute',
                    bottom: { xs: 24, md: 48 },
                    left: { xs: 16, md: 48 },
                    width: { xs: '90%', md: '50%' },
                    zIndex: 3,
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label="TRENDING" size="small" color="primary" sx={{ fontWeight: 'fontWeightBold' }} />
                    <Chip label={activeHero.isTVShow ? 'TV SHOW' : activeHero.category} size="small" variant="outlined" sx={{ color: '#fff', borderColor: '#fff' }} />
                  </Stack>

                  <Typography
                    variant="h2"
                    sx={{
                      fontWeight: 'fontWeightBold',
                      color: 'common.white',
                      textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      fontSize: { xs: '1.8rem', md: '3rem' },
                    }}
                  >
                    {activeHero.title}
                  </Typography>

                  <Typography
                    variant="body1"
                    sx={{
                      color: 'text.secondary',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                      fontSize: { xs: '0.85rem', md: '1rem' },
                    }}
                  >
                    {activeHero.description}
                  </Typography>

                  <Stack direction="row" spacing={2} sx={{ pt: 1 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      size="large"
                      startIcon={<PlayArrow />}
                      onClick={() => navigate(activeHero.isTVShow ? `/shows/${activeHero._id}` : `/videos/${activeHero._id}`)}
                      sx={{ borderRadius: '8px', px: 4, py: 1.5, fontWeight: 'fontWeightBold' }}
                    >
                      Play Now
                    </Button>
                    <Button
                      variant="outlined"
                      size="large"
                      startIcon={<InfoOutlined />}
                      onClick={() => navigate(activeHero.isTVShow ? `/shows/${activeHero._id}` : `/videos/${activeHero._id}`)}
                      sx={{
                        borderRadius: '8px',
                        color: 'common.white',
                        borderColor: 'common.white',
                        px: 3,
                        '&:hover': { borderColor: 'primary.light', bgcolor: 'rgba(255,255,255,0.08)' },
                      }}
                    >
                      More Info
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            )}

            {/* Featured Channels Section (StreamSphere Channels Viewers Row) */}
            <Grid container spacing={3} sx={{ mt: 1, mb: 2 }}>
              {[
                { name: 'Action Hits', icon: '💥', desc: 'High-Octane Action', category: 'Action' },
                { name: 'Comedy Club', icon: '😂', desc: 'Laugh Out Loud', category: 'Comedy' },
                { name: 'Drama Special', icon: '🎭', desc: 'Intense Dramas', category: 'Drama' },
                { name: 'Sci-Fi & Fantasy', icon: '🚀', desc: 'Sci-Fi & Fantasy Hits', category: 'Sci-Fi & Fantasy' },
                { name: 'Documentaries', icon: '🌍', desc: 'Real World Stories', category: 'Documentary' },
              ].map((channel, idx) => (
                <Grid item xs={6} sm={4} md={2.4} key={idx}>
                  <Card
                    onClick={() => {
                      setSelectedCategory(channel.category);
                      window.scrollTo({ top: 400, behavior: 'smooth' });
                    }}
                    sx={{
                      position: 'relative',
                      pt: '56.25%',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      border: '3px solid rgba(249, 249, 249, 0.08)',
                      boxShadow: 'rgb(0 0 0 / 69%) 0px 15px 20px -10px, rgb(0 0 0 / 73%) 0px 10px 10px -10px',
                      background: 'linear-gradient(145deg, #181818 0%, #0c0c0c 100%)',
                      transition: 'all 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 0s',
                      '&:hover': {
                        transform: 'scale(1.05)',
                        borderColor: 'rgba(249, 249, 249, 0.7)',
                        boxShadow: 'rgb(0 0 0 / 80%) 0px 25px 35px -15px, rgb(0 0 0 / 72%) 0px 15px 15px -10px',
                        background: 'linear-gradient(145deg, #2a0b0b 0%, #080808 100%)', // crimson hover glow
                        '& .channel-icon': {
                          transform: 'scale(1.25) rotate(-5deg)',
                        },
                      },
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        p: 1.5,
                        textAlign: 'center',
                      }}
                    >
                      <Typography className="channel-icon" variant="h3" sx={{ transition: 'transform 0.25s', mb: 0.5 }}>
                        {channel.icon}
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'fontWeightBold', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.7rem', color: '#fff' }}>
                        {channel.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' }, fontSize: '0.6rem', mt: 0.25 }}>
                        {channel.desc}
                      </Typography>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>


            {/* Continue Watching Section */}
            {continueWatching.length > 0 && (
              <Box>
                <Typography variant="h5" sx={{ mb: 2.5, fontWeight: 'fontWeightBold', letterSpacing: 0.5 }}>
                  Continue Watching
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    spacing: 2,
                    overflowX: 'auto',
                    pt: 2.5,
                    pb: 2.5,
                    px: 2,
                    mx: -2,
                    gap: 3,
                    scrollBehavior: 'smooth',
                    '&::-webkit-scrollbar': { height: 6 },
                    '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                    '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 4 },
                  }}
                >
                  {continueWatching.map((item) => {
                    const video = item.video;
                    if (!video) return null;
                    const progressRatio = item.durationSeconds > 0
                      ? (item.progressSeconds / item.durationSeconds) * 100
                      : 0;

                    const remainingSeconds = Math.max(0, item.durationSeconds - item.progressSeconds);
                    const mins = Math.ceil(remainingSeconds / 60);
                    const timeLeftText = mins >= 60
                      ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''} left`
                      : `${mins}m left`;

                    return (
                      <Box key={item._id} sx={{ minWidth: { xs: 200, sm: 260 }, maxWidth: { xs: 200, sm: 260 } }}>
                        <Card
                          onClick={() => navigate(`/videos/${video._id}`)}
                          sx={{
                            bgcolor: '#141414',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 0s',
                            border: '3px solid rgba(249, 249, 249, 0.08)',
                            boxShadow: 'rgb(0 0 0 / 69%) 0px 15px 20px -10px, rgb(0 0 0 / 73%) 0px 10px 10px -10px',
                            '&:hover': {
                              transform: 'scale(1.05)',
                              borderColor: 'rgba(249, 249, 249, 0.7)',
                              boxShadow: 'rgb(0 0 0 / 80%) 0px 25px 35px -15px, rgb(0 0 0 / 72%) 0px 15px 15px -10px',
                            },
                          }}
                        >
                          <Box sx={{ position: 'relative', pt: '56.25%', width: '100%', overflow: 'hidden' }}>
                            <CardMedia
                              component="img"
                              image={getThumbnailUrl(video.thumbnailUrl, '/assets/images/covers/cover_default.jpg')}
                              alt={video.title}
                              sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            {/* Linear Progress Bar of playback */}
                            <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                              <LinearProgress
                                variant="determinate"
                                value={progressRatio}
                                color="primary"
                                sx={{ height: 4, bgcolor: 'rgba(255,255,255,0.2)' }}
                              />
                            </Box>
                          </Box>
                          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'fontWeightBold', textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
                              {video.category || 'Others'}
                            </Typography>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'fontWeightBold', color: 'text.primary', mb: 1, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {video.title}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {timeLeftText}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* Trending Section */}
            {trendingVideos.length > 0 && (
              <Box>
                <Typography variant="h5" sx={{ mb: 2.5, fontWeight: 'fontWeightBold', letterSpacing: 0.5 }}>
                  Trending Now
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    spacing: 2,
                    overflowX: 'auto',
                    pt: 2.5,
                    pb: 2.5,
                    px: 2,
                    mx: -2,
                    gap: 3,
                    scrollBehavior: 'smooth',
                    '&::-webkit-scrollbar': { height: 6 },
                    '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                    '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 4 },
                  }}
                >
                  {trendingVideos.map((video) => (
                    <Box key={video._id} sx={{ minWidth: { xs: 120, sm: 160 }, maxWidth: { xs: 120, sm: 160 } }}>
                      <VideoItemCard video={video} formatDuration={formatDuration} />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Recommended Row */}
            {recommendedVideos.length > 0 && (
              <Box>
                <Typography variant="h5" sx={{ mb: 2.5, fontWeight: 'fontWeightBold', letterSpacing: 0.5 }}>
                  Recommended For You
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    spacing: 2,
                    overflowX: 'auto',
                    pt: 2.5,
                    pb: 2.5,
                    px: 2,
                    mx: -2,
                    gap: 3,
                    scrollBehavior: 'smooth',
                    '&::-webkit-scrollbar': { height: 6 },
                    '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                    '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 4 },
                  }}
                >
                  {recommendedVideos.map((video) => (
                    <Box key={video._id} sx={{ minWidth: { xs: 120, sm: 160 }, maxWidth: { xs: 120, sm: 160 } }}>
                      <VideoItemCard video={video} formatDuration={formatDuration} />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Stack>
        )}
      </Container>
    </>
  );
}

// ----------------------------------------------------------------------

function VideoItemCard({ video, formatDuration }) {
  const navigate = useNavigate();
  const { title, thumbnailUrl, viewCount, category, recordingDate, _id: id, isTVShow, seasons, launchYear } = video;

  const totalEpisodes = useMemo(() => {
    if (!seasons) return 0;
    return seasons.reduce((sum, s) => sum + (s.episodes?.length || 0), 0);
  }, [seasons]);

  const handleCardClick = () => {
    if (isTVShow) {
      navigate(`/shows/${id}`);
    } else {
      navigate(`/videos/${id}`);
    }
  };

  return (
    <Card
      onClick={handleCardClick}
      sx={{
        bgcolor: '#141414',
        borderRadius: '10px',
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 0s',
        border: '3px solid rgba(249, 249, 249, 0.1)',
        boxShadow: 'rgb(0 0 0 / 69%) 0px 26px 30px -10px, rgb(0 0 0 / 73%) 0px 16px 10px -10px',
        '&:hover': {
          transform: 'scale(1.05)',
          borderColor: 'rgba(249, 249, 249, 0.8)',
          boxShadow: 'rgb(0 0 0 / 80%) 0px 40px 58px -16px, rgb(0 0 0 / 72%) 0px 30px 22px -10px',
        },
      }}
    >
      <Box sx={{ position: 'relative', pt: '150%', width: '100%', overflow: 'hidden' }}>
        <CardMedia
          component="img"
          image={getThumbnailUrl(thumbnailUrl, '/assets/images/covers/cover_default.jpg')}
          alt={title}
          sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {/* Floating Duration/Info Chip */}
        {isTVShow && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              bgcolor: 'rgba(0,0,0,0.75)',
              color: 'common.white',
              px: 1,
              py: 0.25,
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 'fontWeightBold',
            }}
          >
            {`${seasons?.length || 0} Seasons`}
          </Box>
        )}
      </Box>

      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'fontWeightBold', textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
          {isTVShow ? 'TV Show' : (category || 'Others')}
        </Typography>

        <Typography variant="subtitle1" sx={{ fontWeight: 'fontWeightBold', color: 'text.primary', mb: 1, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {title}
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
          <Typography variant="caption">
            {isTVShow ? `${totalEpisodes} Episodes` : `${viewCount || 0} views`}
          </Typography>
          <Typography variant="caption">
            {isTVShow ? launchYear : <Moment fromNow>{recordingDate}</Moment>}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
