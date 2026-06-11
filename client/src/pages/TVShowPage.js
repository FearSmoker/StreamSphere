import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import ReactPlayer from 'react-player';
import { PlayArrow, Bookmark, BookmarkBorder, ArrowBack, VolumeUp, VolumeOff, Replay } from '@mui/icons-material';

import { API_SERVER, VIDEO_SERVER } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { getThumbnailUrl } from '../utils/resolveAsset';

export default function TVShowPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, toggleWatchlist } = useAuth();

  const [show, setShow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Recommendations state
  const [recommendations, setRecommendations] = useState([]);

  // Selected Season state
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState(1);

  // Loading/saving watchlist states
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [episodeWatchlistLoading, setEpisodeWatchlistLoading] = useState({});

  const [showCover, setShowCover] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [currentGlimpseIdx, setCurrentGlimpseIdx] = useState(0);
  const [glimpseFinished, setGlimpseFinished] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowCover(true);
    setCurrentGlimpseIdx(0);
    setGlimpseFinished(false);
    timerRef.current = setTimeout(() => {
      setShowCover(false);
    }, 1500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [id]);

  const handleWatchAgain = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowCover(true);
    setGlimpseFinished(false);
    setCurrentGlimpseIdx(0);
    timerRef.current = setTimeout(() => {
      setShowCover(false);
    }, 1500);
  };

  const episodeUrls = useMemo(() => {
    if (!show || !show.seasons) return [];
    const urls = [];
    show.seasons.forEach((season) => {
      season.episodes?.forEach((ep) => {
        if (ep.video && ep.video.hlsPath) {
          const path = ep.video.hlsPath;
          let url;
          if (path.startsWith('http://') || path.startsWith('https://')) {
            url = path;
          } else {
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
            url = `${VIDEO_SERVER}/${getRelativeHlsPath(path)}`;
          }
          urls.push({ url, duration: ep.video.duration || 0 });
        }
      });
    });
    return urls;
  }, [show]);

  const currentEpisodeObj = useMemo(() => {
    if (episodeUrls.length === 0) return null;
    if (currentGlimpseIdx >= episodeUrls.length) return null;
    return episodeUrls[currentGlimpseIdx];
  }, [episodeUrls, currentGlimpseIdx]);

  const glimpseUrl = useMemo(() => {
    return currentEpisodeObj?.url || '';
  }, [currentEpisodeObj]);

  const glimpseDurationLimit = useMemo(() => {
    if (!currentEpisodeObj) return 12;
    const dur = currentEpisodeObj.duration || 0;
    return dur < 60 ? 6 : 12;
  }, [currentEpisodeObj]);

  const handleGlimpseTimeout = () => {
    if (currentGlimpseIdx < episodeUrls.length - 1) {
      setCurrentGlimpseIdx((prev) => prev + 1);
    } else {
      setGlimpseFinished(true);
      setShowCover(true);
    }
  };

  const handleGlimpseEnded = () => {
    handleGlimpseTimeout();
  };

  const handlePlayerProgress = (progress) => {
    if (progress.playedSeconds >= glimpseDurationLimit) {
      handleGlimpseTimeout();
    }
  };

  useEffect(() => {
    const fetchShowDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_SERVER}/api/shows/detail/${id}`);
        setShow(response.data);
        if (response.data?.seasons?.length > 0) {
          setSelectedSeasonNumber(response.data.seasons[0].seasonNumber);
        }
      } catch (err) {
        console.error('Failed to load show details:', err);
        setError('Failed to fetch details for this TV Show. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchShowDetails();
  }, [id]);

  // Load recommendations: other shows first, then movies
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!show) return;
      try {
        const [showsRes, videosRes] = await Promise.all([
          axios.post(`${API_SERVER}/api/shows/search`, { limit: 10 }),
          axios.post(`${API_SERVER}/api/videos/search`, { limit: 100 }),
        ]);

        // Exclude current show
        const otherShows = (showsRes.data || [])
          .filter((s) => {
            const isSameId = s._id?.toString() === id?.toString();
            const isSameTitle = s.title?.trim().toLowerCase() === show.title?.trim().toLowerCase();
            return !isSameId && !isSameTitle;
          })
          .map((s) => ({ ...s, isTVShow: true }));

        const movies = (videosRes.data || [])
          .filter((v) => v.contentType === 'movie')
          .map((v) => ({ ...v, isTVShow: false }));

        let recommendedList = [...otherShows];

        // Keyword recommendations fallback
        if (otherShows.length === 0) {
          const showCategories = [];
          if (show.seasons) {
            show.seasons.forEach((season) => {
              if (season.episodes) {
                season.episodes.forEach((ep) => {
                  if (ep.video && ep.video.category) {
                    showCategories.push(ep.video.category);
                  }
                });
              }
            });
          }

          const textToAnalyze = `${show.title || ''} ${show.description || ''} ${showCategories.join(' ')}`.toLowerCase();
          const stopwords = new Set(['the', 'a', 'an', 'and', 'from', 'for', 'of', 'in', 'on', 'to', 'is', 'it', 'its', 'all', 'about', 'with', 'by', 'at', 'this', 'that']);
          
          const keywords = textToAnalyze
             .split(/[\s,.\-!?:;()]+/)
            .map((w) => w.trim())
            .filter((w) => w.length > 2 && !stopwords.has(w));

          const uniqueKeywords = [...new Set(keywords)];

          const scoredMovies = movies.map((movie) => {
            const movieTitle = (movie.title || '').toLowerCase();
            const movieDesc = (movie.description || '').toLowerCase();
            const movieCat = (movie.category || '').toLowerCase();

            let score = 0;
            uniqueKeywords.forEach((keyword) => {
              if (movieTitle.includes(keyword)) {
                score += 3; // higher weight for title match
              }
              if (movieDesc.includes(keyword)) {
                score += 1;
              }
              if (movieCat.includes(keyword)) {
                score += 2; // medium weight for category match
              }
            });
            return { movie, score };
          });

          // Sort by score descending, then fallback to viewCount
          scoredMovies.sort((a, b) => {
            if (b.score !== a.score) {
              return b.score - a.score;
            }
            return (b.movie.viewCount || 0) - (a.movie.viewCount || 0);
          });

          const similarMovies = scoredMovies.map((sm) => sm.movie);
          recommendedList = [...recommendedList, ...similarMovies];
        } else {
          recommendedList = [...recommendedList, ...movies];
        }

        // Deduplicate results
        const uniqueRecommendations = [];
        const seenIds = new Set();
        const seenTitles = new Set();
        recommendedList.forEach((item) => {
          const idStr = item._id?.toString();
          const titleNorm = item.title?.trim().toLowerCase();
          if (!seenIds.has(idStr) && !seenTitles.has(titleNorm)) {
            uniqueRecommendations.push(item);
            if (idStr) seenIds.add(idStr);
            if (titleNorm) seenTitles.add(titleNorm);
          }
        });

        setRecommendations(uniqueRecommendations.slice(0, 10));
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
      }
    };
    fetchRecommendations();
  }, [id, show]);

  // Check if show is watchlisted
  const isShowWatchlisted = useMemo(() => {
    if (!user || !user.watchlist || !show) return false;
    return user.watchlist.includes(show._id);
  }, [user, show]);

  // Toggle watchlist for the entire TV Show
  const handleToggleShowWatchlist = async () => {
    if (watchlistLoading || !show) return;
    setWatchlistLoading(true);
    try {
      await toggleWatchlist(show._id, isShowWatchlisted);
      
      const eventName = isShowWatchlisted ? 'watchlist:removed' : 'watchlist:added';
      const event = new CustomEvent(eventName, {
        detail: { videoTitle: show.title },
      });
      window.dispatchEvent(event);
    } catch (err) {
      console.error('Failed to update show watchlist:', err);
    } finally {
      setWatchlistLoading(false);
    }
  };

  // Toggle watchlist for a single episode
  const handleToggleEpisodeWatchlist = async (videoId, videoTitle) => {
    if (episodeWatchlistLoading[videoId]) return;
    setEpisodeWatchlistLoading((prev) => ({ ...prev, [videoId]: true }));
    const isEpWatchlisted = user?.watchlist?.includes(videoId) || false;
    try {
      await toggleWatchlist(videoId, isEpWatchlisted);
      
      const eventName = isEpWatchlisted ? 'watchlist:removed' : 'watchlist:added';
      const event = new CustomEvent(eventName, {
        detail: { videoTitle },
      });
      window.dispatchEvent(event);
    } catch (err) {
      console.error('Failed to update episode watchlist:', err);
    } finally {
      setEpisodeWatchlistLoading((prev) => ({ ...prev, [videoId]: false }));
    }
  };

  // Get episodes in the currently selected season
  const activeSeason = useMemo(() => {
    if (!show || !show.seasons) return null;
    return show.seasons.find((s) => s.seasonNumber === selectedSeasonNumber) || null;
  }, [show, selectedSeasonNumber]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error || !show) {
    return (
      <Container sx={{ py: 6 }}>
        <Alert severity="error" sx={{ mb: 3 }}>{error || 'TV Show not found.'}</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/videos')} variant="contained">
          Back to Browse
        </Button>
      </Container>
    );
  }

  const firstEpisodeId = show.seasons?.[0]?.episodes?.[0]?.video?._id;

  return (
    <>
      <Helmet>
        <title>{show.title} | StreamSphere</title>
      </Helmet>

      {/* Hero Cover Banner Backdrop */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: { xs: 240, md: 440 },
          overflow: 'hidden',
          boxShadow: 'inset 0 0 80px rgba(0,0,0,0.95)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(8,8,8,0.2) 0%, rgba(8,8,8,0.95) 100%)',
            zIndex: 1,
          },
        }}
      >
        {!showCover && !glimpseFinished && glimpseUrl && (
          <ReactPlayer
            url={glimpseUrl}
            playing={!showCover && !glimpseFinished}
            muted={isMuted}
            width="100%"
            height="100%"
            playsinline
            onEnded={handleGlimpseEnded}
            onProgress={handlePlayerProgress}
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
            backgroundImage: `url(${getThumbnailUrl(show.coverUrl, '/assets/images/covers/cover_default.jpg')})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transition: 'opacity 0.8s ease-in-out',
            opacity: showCover ? 1 : 0,
            zIndex: 0,
          }}
        />

        {!showCover && !glimpseFinished && glimpseUrl && (
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            sx={{
              position: 'absolute',
              bottom: 24,
              right: 24,
              zIndex: 10,
              color: 'common.white',
              bgcolor: 'rgba(0,0,0,0.5)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
            }}
          >
            {isMuted ? <VolumeOff /> : <VolumeUp />}
          </IconButton>
        )}

        {glimpseFinished && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleWatchAgain();
            }}
            endIcon={<Replay />}
            sx={{
              position: 'absolute',
              bottom: 24,
              right: 24,
              zIndex: 10,
              color: 'common.white',
              bgcolor: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              px: 2,
              py: 1,
              fontWeight: 'fontWeightBold',
              fontSize: '0.85rem',
              letterSpacing: '1px',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.2)',
                borderColor: 'common.white',
              },
            }}
          >
            WATCH AGAIN
          </Button>
        )}

        <IconButton
          onClick={() => navigate('/videos')}
          sx={{
            position: 'absolute',
            top: 24,
            left: 24,
            color: 'common.white',
            bgcolor: 'rgba(0,0,0,0.5)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
            zIndex: 10,
          }}
        >
          <ArrowBack />
        </IconButton>
      </Box>

      {/* Content Container */}
      <Container sx={{ mt: -8, position: 'relative', zIndex: 5, pb: 8 }}>
        <Grid container spacing={4}>
          {/* Left Side: Thumbnail cover image */}
          <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'center' }}>
            <Card sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,0.7)', bgcolor: 'background.paper', width: { xs: 180, md: 220 }, height: { xs: 270, md: 330 } }}>
              <CardMedia
                component="img"
                image={getThumbnailUrl(show.thumbnailUrl, '/assets/images/covers/cover_default.jpg')}
                alt={show.title}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </Card>
          </Grid>

          {/* Right Side: Show details, Season Selector & Episode List */}
          <Grid item xs={12} md={8}>
            <Stack spacing={3}>
              <Box>
                {/* Meta details row */}
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                  <Chip label="TV SHOW" color="primary" size="small" sx={{ fontWeight: 'fontWeightBold' }} />
                  <Chip label={`${show.seasons?.length || 0} Seasons`} size="small" variant="outlined" sx={{ color: 'text.secondary', borderColor: 'divider' }} />
                  <Chip label={`Released: ${show.launchYear}`} size="small" variant="outlined" sx={{ color: 'text.secondary', borderColor: 'divider' }} />
                  {show.languages && show.languages.map((lang) => (
                    <Chip key={lang} label={lang} size="small" variant="outlined" sx={{ color: 'text.secondary', borderColor: 'divider' }} />
                  ))}
                </Stack>

                <Typography variant="h2" sx={{ fontWeight: 'fontWeightBold', color: 'common.white', mb: 1.5 }}>
                  {show.title}
                </Typography>

                <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.6, mb: 3 }}>
                  {show.description}
                </Typography>

                {/* TV Show CTA Buttons */}
                <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
                  {firstEpisodeId && (
                    <Button
                      variant="contained"
                      color="primary"
                      size="large"
                      startIcon={<PlayArrow />}
                      onClick={() => navigate(`/watch/${firstEpisodeId}`)}
                      sx={{ borderRadius: '8px', px: 4, py: 1.5, fontWeight: 'fontWeightBold' }}
                    >
                      Watch Season 1 Ep 1
                    </Button>
                  )}

                  <Button
                    variant="outlined"
                    size="large"
                    color={isShowWatchlisted ? 'primary' : 'inherit'}
                    startIcon={isShowWatchlisted ? <Bookmark /> : <BookmarkBorder />}
                    onClick={handleToggleShowWatchlist}
                    disabled={watchlistLoading}
                    sx={{ borderRadius: '8px', px: 3 }}
                  >
                    {isShowWatchlisted ? 'Show in Watchlist' : 'Add Show to Watchlist'}
                  </Button>
                </Stack>
              </Box>

              <Divider sx={{ borderColor: 'divider' }} />

              {/* Season Selection and Episodes display */}
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                  <FormControl sx={{ minWidth: 160 }} size="small">
                    <InputLabel id="season-select-label">Select Season</InputLabel>
                    <Select
                      labelId="season-select-label"
                      id="season-select"
                      value={selectedSeasonNumber}
                      label="Select Season"
                      onChange={(e) => setSelectedSeasonNumber(Number(e.target.value))}
                    >
                      {(show.seasons || []).map((s) => (
                        <MenuItem key={s.seasonNumber} value={s.seasonNumber}>
                          Season {s.seasonNumber}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {activeSeason && (
                    <Chip
                      label={`${activeSeason.episodes?.length || 0} Episodes available`}
                      color="primary"
                      variant="outlined"
                      sx={{ fontWeight: 'fontWeightBold' }}
                    />
                  )}
                </Stack>

                {/* Episodes listing */}
                {!activeSeason || !activeSeason.episodes || activeSeason.episodes.length === 0 ? (
                  <Alert severity="info">No episodes uploaded for this season yet.</Alert>
                ) : (
                  <Stack spacing={2.5}>
                    {activeSeason.episodes.map((ep) => {
                      const isEpWatchlisted = user?.watchlist?.includes(ep.video?._id) || false;
                      const epLoading = episodeWatchlistLoading[ep.video?._id] || false;

                      return (
                        <Card
                          key={ep.episodeNumber}
                          onClick={() => {
                            if (ep.video?._id) {
                              navigate(`/videos/${ep.video._id}`);
                            }
                          }}
                          sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            p: 2,
                            bgcolor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1.5,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              borderColor: 'primary.main',
                              transform: 'translateY(-2px)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            },
                          }}
                        >
                          {/* Episode thumbnail */}
                          <Box
                            sx={{
                              width: { xs: '100%', sm: 180 },
                              aspectRatio: '16/9',
                              position: 'relative',
                              borderRadius: 1,
                              overflow: 'hidden',
                              mr: { xs: 0, sm: 3 },
                              mb: { xs: 2, sm: 0 },
                              flexShrink: 0,
                            }}
                          >
                            <CardMedia
                              component="img"
                              image={getThumbnailUrl(ep.video?.thumbnailUrl, '/assets/images/covers/cover_default.jpg')}
                              alt={ep.video?.title}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/watch/${ep.video?._id}`);
                              }}
                              sx={{
                                position: 'absolute',
                                inset: 0,
                                margin: 'auto',
                                width: 44,
                                height: 44,
                                bgcolor: 'rgba(229, 9, 20, 0.9)',
                                color: '#fff',
                                '&:hover': { bgcolor: 'primary.dark' },
                              }}
                            >
                              <PlayArrow />
                            </IconButton>
                          </Box>

                          {/* Episode content details */}
                          <Stack spacing={1} sx={{ flexGrow: 1, justifyContent: 'center' }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                              <Typography variant="h6" sx={{ fontWeight: 'fontWeightBold' }}>
                                Episode {ep.episodeNumber}: {ep.video?.title}
                              </Typography>
                              
                              {/* Watchlist toggle for individual episode */}
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleEpisodeWatchlist(ep.video?._id, ep.video?.title);
                                }}
                                disabled={epLoading || !ep.video?._id}
                                sx={{ color: isEpWatchlisted ? 'primary.main' : 'text.secondary' }}
                              >
                                {isEpWatchlisted ? <Bookmark sx={{ fontSize: 20 }} /> : <BookmarkBorder sx={{ fontSize: 20 }} />}
                              </IconButton>
                            </Stack>

                            <Typography variant="body2" sx={{ color: 'text.secondary', lineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>
                              {ep.video?.description}
                            </Typography>
                            
                            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                              {ep.video?.viewCount || 0} views • {Math.floor((ep.video?.duration || 0) / 60)} min
                            </Typography>
                          </Stack>
                        </Card>
                      );
                    })}
                  </Stack>
                )}
              </Box>

              <Divider sx={{ borderColor: 'divider', my: 2 }} />

              {/* Recommendations section */}
              {recommendations.length > 0 && (
                <Box>
                  <Typography variant="h5" sx={{ mb: 2.5, fontWeight: 'fontWeightBold', letterSpacing: 0.5 }}>
                    Recommended For You
                  </Typography>
                  <Grid container spacing={3}>
                    {recommendations.map((rec) => (
                      <Grid item xs={6} sm={4} md={3} key={rec._id}>
                        <Card
                          sx={{
                            borderRadius: 1.5,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            bgcolor: 'background.paper',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'scale(1.03)' },
                          }}
                          onClick={() => navigate(rec.isTVShow ? `/shows/${rec._id}` : `/videos/${rec._id}`)}
                        >
                          <Box sx={{ position: 'relative', paddingTop: '150%' }}>
                            <CardMedia
                              component="img"
                              image={getThumbnailUrl(rec.thumbnailUrl || rec.coverUrl, '/assets/images/covers/cover_default.jpg')}
                              alt={rec.title}
                              sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <Chip
                              label={rec.isTVShow ? 'TV SHOW' : 'MOVIE'}
                              size="small"
                              color="primary"
                              sx={{
                                position: 'absolute',
                                top: 8,
                                left: 8,
                                fontWeight: 'fontWeightBold',
                                fontSize: '0.65rem',
                              }}
                            />
                          </Box>
                          <Box sx={{ p: 2 }}>
                            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 'fontWeightBold' }}>
                              {rec.title}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {rec.isTVShow 
                                ? `${rec.seasons?.length || 0} seasons • ${rec.launchYear}`
                                : (rec.launchYear || (rec.recordingDate ? new Date(rec.recordingDate).getFullYear() : ''))
                              }
                            </Typography>
                          </Box>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </>
  );
}
