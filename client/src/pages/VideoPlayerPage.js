import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import axios from 'axios';

// @mui
import {
  Container,
  Typography,
  Stack,
  Box,
  Button,
  Grid,
  Card,
  CardMedia,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
} from '@mui/material';
import { PlayArrow, Bookmark, BookmarkBorder, Edit, ArrowBack } from '@mui/icons-material';

import { API_SERVER } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { getThumbnailUrl } from '../utils/resolveAsset';
import Moment from 'react-moment';

// ----------------------------------------------------------------------

export default function VideoPlayerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, toggleWatchlist } = useAuth();
  
  const [video, setVideo] = useState(null);
  const [recommendedVideos, setRecommendedVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  useEffect(() => {
    const fetchVideoDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_SERVER}/api/videos/detail/${id}`);
        setVideo(response.data);
      } catch (err) {
        console.error('Failed to load video details:', err);
        setError('Failed to fetch details for this video. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchVideoDetails();
  }, [id]);

  useEffect(() => {
    if (video && video.category) {
      const fetchRecommendations = async () => {
        try {
          const response = await axios.get(`${API_SERVER}/api/videos/recommendations?category=${encodeURIComponent(video.category)}`);
          if (response.data) {
            // Filter out current video, matches by title, and list duplicates
            const filtered = response.data.filter((v) => {
              const isSameId = v._id?.toString() === video._id?.toString();
              const isSameTitle = v.title?.trim().toLowerCase() === video.title?.trim().toLowerCase();
              return !isSameId && !isSameTitle;
            });
            const uniqueRecs = [];
            const seenIds = new Set();
            const seenTitles = new Set();
            filtered.forEach((item) => {
              const idStr = item._id?.toString();
              const titleNorm = item.title?.trim().toLowerCase();
              if (!seenIds.has(idStr) && !seenTitles.has(titleNorm)) {
                uniqueRecs.push(item);
                if (idStr) seenIds.add(idStr);
                if (titleNorm) seenTitles.add(titleNorm);
              }
            });
            setRecommendedVideos(uniqueRecs);
          }
        } catch (error) {
          console.error('Error fetching recommendations:', error);
        }
      };
      fetchRecommendations();
    }
  }, [video]);

  const isWatchlisted = useMemo(() => {
    if (!user || !user.watchlist) return false;
    return user.watchlist.includes(id);
  }, [user, id]);

  const handleToggleWatchlist = async () => {
    if (watchlistLoading) return;
    setWatchlistLoading(true);
    try {
      await toggleWatchlist(id, isWatchlisted);
      if (!isWatchlisted) {
        const event = new CustomEvent('watchlist:added', {
          detail: { videoTitle: video?.title || 'Video' }
        });
        window.dispatchEvent(event);
      } else {
        const event = new CustomEvent('watchlist:removed', {
          detail: { videoTitle: video?.title || 'Video' }
        });
        window.dispatchEvent(event);
      }
    } catch (err) {
      console.error('Failed to update watchlist:', err);
    } finally {
      setWatchlistLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins} min ${secs}s`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error || !video) {
    return (
      <Container sx={{ py: 6 }}>
        <Alert severity="error" sx={{ mb: 3 }}>{error || 'Video not found.'}</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/videos')} variant="contained">
          Back to Browse
        </Button>
      </Container>
    );
  }

  const isAdmin = user?.role === 'admin';
  const resolutionStr = video.resolution?.width && video.resolution?.height
    ? `${video.resolution.width}x${video.resolution.height}`
    : 'HD';

  return (
    <>
      <Helmet>
        <title>{video.title} | StreamSphere</title>
      </Helmet>

      {/* Hero Backdrop Banner */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: { xs: 240, md: 400 },
          backgroundImage: `url(${getThumbnailUrl(video.thumbnailUrl, '/assets/images/covers/cover_default.jpg')})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(8,8,8,0.2) 0%, rgba(8,8,8,0.95) 100%)',
          },
        }}
      >
        <IconButton
          onClick={() => navigate('/videos')}
          sx={{
            position: 'absolute',
            top: 24,
            left: 24,
            color: 'common.white',
            bgcolor: 'rgba(0,0,0,0.5)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
          }}
        >
          <ArrowBack />
        </IconButton>
      </Box>

      {/* Content Section */}
      <Container sx={{ mt: -6, position: 'relative', zIndex: 5, pb: 8 }}>
        <Grid container spacing={4}>
          {/* Left: Thumbnail card */}
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,0.7)' }}>
              <CardMedia
                component="img"
                image={getThumbnailUrl(video.thumbnailUrl, '/assets/images/covers/cover_default.jpg')}
                alt={video.title}
                sx={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }}
              />
            </Card>
          </Grid>

          {/* Right: Metadata, Title, Description, and Actions */}
          <Grid item xs={12} md={8}>
            <Stack spacing={3}>
              <Box>
                {/* Category & Resolution tags */}
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                  <Chip label={video.category || 'General'} color="primary" size="small" sx={{ fontWeight: 'fontWeightBold' }} />
                  <Chip label={resolutionStr} size="small" variant="outlined" sx={{ color: 'text.secondary', borderColor: 'divider' }} />
                  {video.language && (
                    <Chip label={video.language} size="small" variant="outlined" sx={{ color: 'text.secondary', borderColor: 'divider' }} />
                  )}
                  {video.tags && video.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      sx={{
                        bgcolor: 'primary.lighter',
                        color: 'primary.darker',
                        fontWeight: 'fontWeightBold',
                        border: '1px solid',
                        borderColor: 'primary.light',
                      }}
                    />
                  ))}
                </Stack>

                <Typography variant="h2" sx={{ fontWeight: 'fontWeightBold', color: 'common.white', mb: 1 }}>
                  {video.title}
                </Typography>

                {/* Subtitle / Details row */}
                <Stack direction="row" spacing={3} alignItems="center" sx={{ color: 'text.secondary' }}>
                  <Typography variant="subtitle2">
                    Duration: {formatDuration(video.duration)}
                  </Typography>
                  <Typography variant="subtitle2">
                    Views: {video.viewCount || 0}
                  </Typography>
                  <Typography variant="subtitle2">
                    Published: <Moment format="MMM DD, YYYY">{video.recordingDate || video.createdAt}</Moment>
                  </Typography>
                </Stack>
              </Box>

              {/* Action Buttons */}
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={<PlayArrow />}
                  onClick={() => navigate(`/watch/${video._id}`)}
                  sx={{ borderRadius: '8px', px: 4, py: 1.5, fontWeight: 'fontWeightBold' }}
                >
                  Play Now
                </Button>

                <Button
                  variant="outlined"
                  size="large"
                  color={isWatchlisted ? 'primary' : 'inherit'}
                  startIcon={isWatchlisted ? <Bookmark /> : <BookmarkBorder />}
                  onClick={handleToggleWatchlist}
                  disabled={watchlistLoading}
                  sx={{ borderRadius: '8px', px: 3 }}
                >
                  {isWatchlisted ? 'In Watchlist' : 'Add to Watchlist'}
                </Button>

                {isAdmin && (
                  <Button
                    variant="outlined"
                    size="large"
                    color="primary"
                    startIcon={<Edit />}
                    onClick={() => navigate(`/video/update/${video._id}`)}
                    sx={{ borderRadius: '8px', px: 3 }}
                  >
                    Edit Video
                  </Button>
                )}
              </Stack>

              {/* Description Panel */}
              <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 3, mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 'fontWeightBold', mb: 1.5 }}>
                  Description
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                  {video.description}
                </Typography>
              </Box>

              {/* Related Content Row */}
              {recommendedVideos.length > 0 && (
                <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 3 }}>
                  <Typography variant="h5" sx={{ mb: 2.5, fontWeight: 'fontWeightBold', letterSpacing: 0.5 }}>
                    Related Content
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
                    {recommendedVideos.map((recVideo) => (
                      <Box key={recVideo._id} sx={{ minWidth: { xs: 200, sm: 260 }, maxWidth: { xs: 200, sm: 260 } }}>
                        <Card
                          sx={{
                            borderRadius: 2,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            bgcolor: 'background.paper',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            transition: 'transform 0.2s ease',
                            '&:hover': { transform: 'scale(1.03)', '& .play-icon': { opacity: 1 } },
                          }}
                          onClick={() => navigate(`/videos/${recVideo._id}`)}
                        >
                          <Box sx={{ position: 'relative', paddingTop: '56.25%' }}>
                            <CardMedia
                              component="img"
                              image={getThumbnailUrl(recVideo.thumbnailUrl, '/assets/images/covers/cover_default.jpg')}
                              alt={recVideo.title}
                              sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <Box className="play-icon" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}>
                              <PlayArrow sx={{ fontSize: 48, color: 'primary.main' }} />
                            </Box>
                            <Box sx={{ position: 'absolute', bottom: 8, right: 8, bgcolor: 'rgba(0,0,0,0.7)', px: 1, py: 0.2, borderRadius: 1 }}>
                              <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                                {formatDuration(recVideo.duration)}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ p: 2 }}>
                            <Typography variant="subtitle2" sx={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {recVideo.title}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {recVideo.viewCount || 0} views • <Moment fromNow>{recVideo.recordingDate || recVideo.createdAt}</Moment>
                            </Typography>
                          </Box>
                        </Card>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </>
  );
}
