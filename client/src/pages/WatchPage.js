import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ReactPlayer from 'react-player';

// @mui
import { Box, Typography, Button, IconButton, CircularProgress, Alert, Chip, Tooltip } from '@mui/material';
import { ArrowBack, Visibility, HdOutlined, ExpandMore } from '@mui/icons-material';

import { VIDEO_SERVER } from '../constants';
import { api } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

// Quality text suffix helper
const renderQualityText = (q) => {
  if (q && q.height >= 1080) {
    let suffix = '';
    if (q.height === 1080) suffix = 'HD';
    else if (q.height === 1440) suffix = '2K';
    else if (q.height === 2160) suffix = '4K';
    else if (q.height === 4320) suffix = '8K';
    else if (q.height > 2160) suffix = '8K';
    else if (q.height > 1440) suffix = '4K';
    else suffix = 'HD';

    return (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
        {q.label}
        <Box
          component="sup"
          sx={{
            fontSize: '0.55rem',
            ml: 0.4,
            color: 'primary.light',
            fontWeight: 'bold',
            verticalAlign: 'super',
            lineHeight: 1,
          }}
        >
          {suffix}
        </Box>
      </Box>
    );
  }
  return q ? q.label : '';
};

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




export default function WatchPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streamUrl, setStreamUrl] = useState('');

  // Live viewer count
  const [viewerCount, setViewerCount] = useState(1);

  // Quality selection
  const [qualities, setQualities] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState('Auto');
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const qualityMenuRef = useRef(null);

  // Player progress states
  const playerRef = useRef(null);
  const [initialStartSeconds, setInitialStartSeconds] = useState(0);
  const [hasSeeked, setHasSeeked] = useState(false);

  const progressRef = useRef(0);
  const durationRef = useRef(0);

  // Fullscreen and hold states
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupType, setPopupType] = useState(null); // 'enter-fs' | 'exit-fs'
  const [escHolding, setEscHolding] = useState(false);
  const [escHoldProgress, setEscHoldProgress] = useState(0);

  const holdStartRef = useRef(null);
  const animationFrameRef = useRef(null);
  const popupTimeoutRef = useRef(null);
  const hasShownInitialPopupRef = useRef(false);
  const fKeyPressedRef = useRef(false);

  // Reset popup state on video change
  useEffect(() => {
    hasShownInitialPopupRef.current = false;
    fKeyPressedRef.current = false;
    setPopupVisible(false);
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
      popupTimeoutRef.current = null;
    }
  }, [id]);

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!document.fullscreenElement;
      setIsFullscreen(isFS);
      if (isFS) {
        if (popupTimeoutRef.current) {
          clearTimeout(popupTimeoutRef.current);
          popupTimeoutRef.current = null;
        }
        setPopupVisible(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Lock Escape key in fullscreen
  useEffect(() => {
    if (isFullscreen) {
      if (navigator.keyboard && navigator.keyboard.lock) {
        navigator.keyboard.lock(['Escape']).catch((err) => {
          console.warn('Keyboard lock failed:', err);
        });
      }
    } else {
      if (navigator.keyboard && navigator.keyboard.unlock) {
        navigator.keyboard.unlock();
      }
    }
  }, [isFullscreen]);

  // Trigger popup
  const triggerPopup = (type, durationMs = 3500) => {
    if (type === 'enter-fs' && (document.fullscreenElement || fKeyPressedRef.current)) {
      return;
    }
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
    }
    setPopupType(type);
    setPopupVisible(true);
    popupTimeoutRef.current = setTimeout(() => {
      if (!holdStartRef.current) {
        setPopupVisible(false);
      }
    }, durationMs);
  };

  // Show popup when video is ready
  useEffect(() => {
    if (!loading && video && !hasShownInitialPopupRef.current) {
      if (!document.fullscreenElement && !fKeyPressedRef.current) {
        triggerPopup('enter-fs');
      }
      hasShownInitialPopupRef.current = true;
    }
  }, [loading, video]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error('Failed to enter fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Failed to exit fullscreen:', err);
      });
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => {
        console.error('Failed to exit fullscreen:', err);
      });
    }
  };

  // Keydown/keyup event handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();
      if (key === 'f') {
        e.preventDefault();
        e.stopPropagation();
        
        fKeyPressedRef.current = true;
        
        // Immediately dismiss the custom popup toast
        if (popupTimeoutRef.current) {
          clearTimeout(popupTimeoutRef.current);
        }
        setPopupVisible(false);
        
        toggleFullscreen();
      } else if (e.key === 'Escape' || e.key === 'Esc') {
        if (document.fullscreenElement) {
          e.preventDefault();
          e.stopPropagation();
          
          if (!holdStartRef.current) {
            setEscHolding(true);
            setEscHoldProgress(0);
            holdStartRef.current = Date.now();
            
            const duration = 1200; // 1.2s hold duration
            const updateProgress = () => {
              if (!holdStartRef.current) return;
              const elapsed = Date.now() - holdStartRef.current;
              const pct = Math.min(100, (elapsed / duration) * 100);
              setEscHoldProgress(pct);

              if (elapsed < duration) {
                animationFrameRef.current = requestAnimationFrame(updateProgress);
              } else {
                exitFullscreen();
                cleanupHold();
              }
            };
            
            if (popupTimeoutRef.current) {
              clearTimeout(popupTimeoutRef.current);
            }
            setPopupVisible(true);
            setPopupType('exit-fs');
            animationFrameRef.current = requestAnimationFrame(updateProgress);
          }
        }
      }
    };

    const cleanupHold = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      holdStartRef.current = null;
      setEscHolding(false);
      setEscHoldProgress(0);
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        cleanupHold();
        if (document.fullscreenElement) {
          triggerPopup('exit-fs', 1500);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      cleanupHold();
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []);


  useEffect(() => {
    const fetchVideoDetailsAndHistory = async () => {
      setLoading(true);
      setError(null);
      try {

        const response = await api.get(`/api/videos/detail/${id}`);
        const data = response.data;
        setVideo(data);

        // Set qualities
        if (data.qualities && data.qualities.length > 0) {
          setQualities(data.qualities);
        }

        // Get stream path
        let finalUrl;
        if (data.hlsPath && (data.hlsPath.startsWith('http://') || data.hlsPath.startsWith('https://'))) {
          finalUrl = data.hlsPath;
        } else {
          const hlsFilename = data.hlsPath
            ? getRelativeHlsPath(data.hlsPath)
            : `${data.fileName || data.title}.m3u8`;
          finalUrl = `${VIDEO_SERVER}/${hlsFilename}`;
        }
        setStreamUrl(finalUrl);

        // Resume saved progress
        const historyRes = await api.get('/api/watch-history/continue');
        if (historyRes.data && historyRes.data.data) {
          const matched = historyRes.data.data.find((item) => item.videoId === id);
          if (matched && !matched.completed) {
            setInitialStartSeconds(matched.progressSeconds || 0);
          }
        }
      } catch (err) {
        console.error('Failed to load playback details:', err);
        setError('Could not load video player. Please check connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchVideoDetailsAndHistory();
  }, [id]);

  // Join/leave watch party
  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('join:video-room', { videoId: id });
    const handleRoomCount = ({ videoId, count }) => {
      if (videoId === id) setViewerCount(count);
    };
    socket.on('room:count', handleRoomCount);
    return () => {
      socket.emit('leave:video-room', { videoId: id });
      socket.off('room:count', handleRoomCount);
    };
  }, [socket, id]);

  // Periodically sync progress
  useEffect(() => {
    const saveWatchProgress = async () => {
      const currentProgress = progressRef.current;
      const currentDuration = durationRef.current;

      if (currentProgress > 0 && currentDuration > 0) {
        try {
          await api.post('/api/watch-history/update', {
            videoId: id,
            progressSeconds: currentProgress,
            durationSeconds: currentDuration,
          });
        } catch (err) {
          console.error('[WatchPage] Failed to sync progress:', err);
        }
      }
    };

    const interval = setInterval(saveWatchProgress, 5000);
    return () => {
      clearInterval(interval);
      saveWatchProgress();
    };
  }, [id]);

  const handleProgress = (state) => {
    progressRef.current = state.playedSeconds;
  };

  const handleDuration = (duration) => {
    durationRef.current = duration;
  };

  const handleReady = () => {
    if (playerRef.current) {
      if (initialStartSeconds > 0 && !hasSeeked) {
        playerRef.current.seekTo(initialStartSeconds, 'seconds');
        setHasSeeked(true);
      }

      // Load HLS levels
      const hls = playerRef.current.getInternalPlayer('hls');
      if (hls && hls.levels && hls.levels.length > 0) {
        const mappedQualities = hls.levels.map((level, index) => ({
          label: `${level.height}p`,
          height: level.height,
          index: index,
        }));
        
        const uniqueQualities = [];
        const seenHeights = new Set();
        mappedQualities.forEach(q => {
          if (!seenHeights.has(q.height) && q.height > 0) {
            seenHeights.add(q.height);
            uniqueQualities.push(q);
          }
        });
        
        setQualities(uniqueQualities);
      }
    }
  };

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(event.target)) {
        setQualityMenuOpen(false);
      }
    };
    if (qualityMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [qualityMenuOpen]);

  const handleSelectQuality = (qualityLabel) => {
    setSelectedQuality(qualityLabel);
    
    // Use HLS level switching
    const hls = playerRef.current?.getInternalPlayer('hls');
    if (hls && qualities.length > 0) {
      if (qualityLabel === 'Auto') {
        hls.currentLevel = -1;
      } else {
        const qObj = qualities.find(q => q.label === qualityLabel);
        if (qObj && qObj.index !== undefined) {
          hls.currentLevel = qObj.index;
        }
      }
      return;
    }

    // Fallback for native players
    if (qualityLabel === 'Auto' || !video) {
      if (video && video.hlsPath) {
        if (video.hlsPath.startsWith('http://') || video.hlsPath.startsWith('https://')) {
          setStreamUrl(video.hlsPath);
        } else {
          setStreamUrl(`${VIDEO_SERVER}/${getRelativeHlsPath(video.hlsPath)}`);
        }
      }
    } else {
      const quality = qualities.find(q => q.label === qualityLabel);
      if (quality && quality.path) {
        if (quality.path.startsWith('http://') || quality.path.startsWith('https://')) {
          setStreamUrl(quality.path);
        } else {
          setStreamUrl(`${VIDEO_SERVER}/${getRelativeHlsPath(quality.path)}`);
        }
      }
    }
  };

  return (
    <>
      <Helmet>
        <title>{video ? `Watching ${video.title}` : 'Watch | StreamSphere'}</title>
      </Helmet>

      <Box
        ref={containerRef}
        sx={{
          width: '100vw',
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          bgcolor: '#000000',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          color: '#ffffff',
          outline: 'none',
          '&:focus': {
            outline: 'none',
          },
          '&:focus-visible': {
            outline: 'none',
          },
          '& *': {
            outline: 'none !important',
          },
          '& *:focus': {
            outline: 'none !important',
          },
          '& *:focus-visible': {
            outline: 'none !important',
          },
          '&:fullscreen': {
            width: '100vw',
            height: '100vh',
            bgcolor: '#000000',
            outline: 'none',
          }
        }}
      >
        {/* Fullscreen toast */}
        {popupVisible && (popupType === 'enter-fs' || escHolding) && (
          <Box
            sx={{
              position: 'absolute',
              top: 40,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: 'rgba(28, 28, 30, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '24px',
              px: 3,
              py: 1.2,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              zIndex: 30000,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
              animation: 'fadeInDown 0.3s ease-out',
              '@keyframes fadeInDown': {
                from: { opacity: 0, transform: 'translate(-50%, -20px)' },
                to: { opacity: 1, transform: 'translate(-50%, 0)' },
              },
            }}
          >
            <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500, letterSpacing: '0.02em' }}>
              {popupType === 'enter-fs' ? 'Press' : 'Exiting full screen...'}
            </Typography>
            {popupType === 'enter-fs' && (
              <>
                <Box
                  sx={{
                    border: '1px solid rgba(255, 255, 255, 0.6)',
                    borderRadius: '6px',
                    px: 1.2,
                    py: 0.3,
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 2px 0 rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    textTransform: 'uppercase',
                  }}
                >
                  f
                </Box>
                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500, letterSpacing: '0.02em' }}>
                  to enter full screen
                </Typography>
              </>
            )}
            {popupType === 'exit-fs' && escHolding && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '3px',
                  width: `${escHoldProgress}%`,
                  bgcolor: 'primary.main',
                  transition: 'width 0.05s linear',
                  borderBottomLeftRadius: '24px',
                  borderBottomRightRadius: escHoldProgress >= 99 ? '24px' : '0',
                }}
              />
            )}
          </Box>
        )}

        {/* Header bar */}
        <Box
          sx={{
            p: 2,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0))',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <IconButton
            onClick={() => navigate(`/videos/${id}`)}
            sx={{
              color: '#ffffff',
              bgcolor: 'rgba(255, 255, 255, 0.15)',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.3)' },
            }}
          >
            <ArrowBack />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 'fontWeightBold', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
              {video?.title || 'Streaming Video'}
            </Typography>
            {video?.category && (
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'fontWeightBold', textTransform: 'uppercase', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                {video.category}
              </Typography>
            )}
          </Box>

          {/* Viewer count */}
          <Chip
            icon={<Visibility sx={{ fontSize: '1rem !important' }} />}
            label={`${viewerCount} watching`}
            size="small"
            sx={{
              bgcolor: viewerCount > 1 ? 'rgba(220, 38, 38, 0.85)' : 'rgba(255,255,255,0.15)',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '0.72rem',
              backdropFilter: 'blur(4px)',
              border: viewerCount > 1 ? '1px solid rgba(255,100,100,0.5)' : '1px solid rgba(255,255,255,0.2)',
              transition: 'all 0.3s ease',
            }}
          />

          {/* Quality switcher */}
          {qualities.length > 0 && (
            <Box ref={qualityMenuRef} sx={{ position: 'relative' }}>
              <Tooltip title="Video Quality">
                <Button
                  id="quality-selector-btn"
                  onClick={() => setQualityMenuOpen(!qualityMenuOpen)}
                  aria-controls={qualityMenuOpen ? 'quality-menu' : undefined}
                  aria-haspopup="true"
                  aria-expanded={qualityMenuOpen ? 'true' : undefined}
                  startIcon={<HdOutlined sx={{ fontSize: '1rem !important', color: '#fff' }} />}
                  endIcon={<ExpandMore sx={{ color: '#fff' }} />}
                  variant="outlined"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '0.72rem',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '16px',
                    height: '24px',
                    minWidth: 'auto',
                    px: 1.5,
                    py: 0,
                    textTransform: 'none',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.25)',
                      border: '1px solid rgba(255,255,255,0.3)',
                    },
                    '& .MuiButton-startIcon': { mr: 0.5, ml: -0.25 },
                    '& .MuiButton-endIcon': { ml: 0.5, mr: -0.25 },
                  }}
                >
                  {selectedQuality === 'Auto' ? 'Auto' : (() => {
                    const activeQ = qualities.find(q => q.label === selectedQuality);
                    return activeQ ? renderQualityText(activeQ) : selectedQuality;
                  })()}
                </Button>
              </Tooltip>

              {qualityMenuOpen && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    bgcolor: 'rgba(18, 18, 18, 0.95)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    minWidth: 120,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    py: 0.5,
                    zIndex: 20000,
                  }}
                >
                  <Button
                    onClick={() => {
                      handleSelectQuality('Auto');
                      setQualityMenuOpen(false);
                    }}
                    sx={{
                      color: '#fff',
                      justifyContent: 'flex-start',
                      px: 2,
                      py: 0.75,
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      textTransform: 'none',
                      width: '100%',
                      borderRadius: 0,
                      bgcolor: selectedQuality === 'Auto' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
                    }}
                  >
                    Auto
                  </Button>
                  {[...qualities].reverse().map((q) => (
                    <Button
                      key={q.label}
                      onClick={() => {
                        handleSelectQuality(q.label);
                        setQualityMenuOpen(false);
                      }}
                      sx={{
                        color: '#fff',
                        justifyContent: 'flex-start',
                        px: 2,
                        py: 0.75,
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        textTransform: 'none',
                        width: '100%',
                        borderRadius: 0,
                        bgcolor: selectedQuality === q.label ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
                      }}
                    >
                      {renderQualityText(q)}
                    </Button>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Player container */}
        <Box sx={{ flexGrow: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {loading ? (
            <CircularProgress color="primary" size={60} />
          ) : error ? (
            <Box sx={{ textAlign: 'center', px: 3 }}>
              <Alert severity="error" variant="filled" sx={{ mb: 2 }}>{error}</Alert>
              <Button variant="contained" onClick={() => navigate(`/videos/${id}`)} color="primary">
                Return to details page
              </Button>
            </Box>
          ) : (
            <ReactPlayer
              ref={playerRef}
              url={streamUrl}
              controls
              playing
              width="100%"
              height="100%"
              style={{ position: 'absolute', top: 0, left: 0 }}
              onProgress={handleProgress}
              onDuration={handleDuration}
              onReady={handleReady}
              config={{
                file: {
                  forceHLS: true,
                  attributes: {
                    controlsList: 'nodownload',
                  },
                },
              }}
            />
          )}
        </Box>
      </Box>
    </>
  );
}
