import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
// @mui
import { styled } from '@mui/material/styles';
import {
  Container,
  Stack,
  TextField,
  FormControl,
  Typography,
  Button,
  Alert,
  LinearProgress,
  Box,
  Chip,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  Select,
  MenuItem,
  InputLabel,
  OutlinedInput,
  Checkbox,
  ListItemText,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { useFormik } from 'formik';
import { useNavigate } from 'react-router-dom';

import { useSocket } from '../contexts/SocketContext';
import { api } from '../contexts/AuthContext';

const StyledContent = styled('div')(({ theme }) => ({
  maxWidth: 640,
  margin: 'auto',
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  alignContent: 'center',
  alignItems: 'left',
  flexDirection: 'column',
  padding: theme.spacing(6, 0),
}));

// Video pipeline stages and their configs
const STATUS_CONFIG = {
  idle:          { label: 'Waiting',       color: 'inherit',  barColor: '#90caf9', progress: 0,   indeterminate: false },
  creating_show: { label: 'Creating Show…', color: 'info',     barColor: '#ab47bc', progress: 15,  indeterminate: true  },
  uploading:     { label: 'Uploading…',    color: 'info',     barColor: '#42a5f5', progress: 30,  indeterminate: true  },
  uploaded:      { label: 'Queued',        color: 'info',     barColor: '#42a5f5', progress: 35,  indeterminate: false },
  processing:    { label: 'Processing…',   color: 'warning',  barColor: '#ffa726', progress: 0,   indeterminate: false }, // progress is live %
  ready:         { label: 'Done ✓',        color: 'success',  barColor: '#66bb6a', progress: 100, indeterminate: false },
  failed:        { label: 'Failed ✗',      color: 'error',    barColor: '#f44336', progress: 100, indeterminate: false },
};

const LANGUAGES_LIST = [
  'English',
  'Hindi',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Russian',
  'Chinese',
  'Japanese',
  'Korean',
  'Arabic',
  'Turkish',
  'Bangla',
  'Urdu',
];

export default function VideoUploadPage() {
  const navigate       = useNavigate();
  const socket         = useSocket();
  const [uploadedId, setUploadedId]         = useState(null);
  const [pipelineStatus, setPipelineStatus] = useState('idle');
  const [hlsPercent, setHlsPercent]         = useState(0);   // transcode percent
  const [errorDetail, setErrorDetail]       = useState('');
  const navigatedRef = useRef(false);
  const uploadedIdRef = useRef(null); // ref for socket callbacks

  const [showsList, setShowsList] = useState([]);

  // Sync ref with state
  useEffect(() => { uploadedIdRef.current = uploadedId; }, [uploadedId]);

  // Fetch shows list on mount
  useEffect(() => {
    const fetchShows = async () => {
      try {
        const response = await api.get('/api/shows/');
        setShowsList(response.data?.data || []);
      } catch (err) {
        console.error('Failed to fetch TV shows list:', err);
      }
    };
    fetchShows();
  }, []);

  // Socket event listeners
  useEffect(() => {
    const idMatches = (d) => !uploadedIdRef.current || d.id === uploadedIdRef.current;

    const onUploaded = (d) => {
      if (!idMatches(d)) return;
      setPipelineStatus('uploaded');
    };

    const onProcessing = (d) => {
      if (!idMatches(d)) return;
      setPipelineStatus('processing');
      setHlsPercent(0);
    };

    const onProgress = (d) => {
      if (!idMatches(d)) return;
      // Update progress in processing stage
      setPipelineStatus((prev) => {
        if (prev !== 'processing') return prev;
        setHlsPercent(Math.min(100, Math.max(0, d.percent || 0)));
        return prev;
      });
    };

    const onReady = (d) => {
      if (!idMatches(d)) return;
      setPipelineStatus('ready');
      setHlsPercent(100);
      if (!navigatedRef.current) {
        navigatedRef.current = true;
        setTimeout(() => navigate('/videos'), 3500);
      }
    };

    const onFailed = (d) => {
      if (!idMatches(d)) return;
      setPipelineStatus('failed');
      setErrorDetail(d.error || 'Processing failed.');
    };

    socket.on('video:uploaded',   onUploaded);
    socket.on('video:processing', onProcessing);
    socket.on('video:progress',   onProgress);
    socket.on('video:ready',      onReady);
    socket.on('video:failed',     onFailed);

    return () => {
      socket.off('video:uploaded',   onUploaded);
      socket.off('video:processing', onProcessing);
      socket.off('video:progress',   onProgress);
      socket.off('video:ready',      onReady);
      socket.off('video:failed',     onFailed);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, navigate]);

  // Form submit and upload logic
  const postToServer = async (values) => {
    const {
      title,
      category,
      description,
      recordingDate,
      visibility,
      languages,
      contentType,
      showSelectionType,
      showId,
      seasonNumber,
      episodeNumber,
      showTitle,
      showDescription,
      showLaunchYear,
      showThumbnailFile,
      showCoverFile,
    } = values;

    const publishDate = recordingDate?.toDate ? recordingDate.toDate() : recordingDate;
    let targetShowId = showId;

    try {
      // 1. If it's a TV Show episode & user wants to create a new show
      if (contentType === 'episode' && showSelectionType === 'new') {
        setPipelineStatus('creating_show');
        const showFormData = new FormData();
        showFormData.append('title', showTitle);
        showFormData.append('description', showDescription);
        showFormData.append('launchYear', showLaunchYear);
        showFormData.append('languages', JSON.stringify(languages));
        showFormData.append('showImagesType', values.showImagesType || 'auto');
        if (values.showImagesType === 'upload') {
          showFormData.append('thumbnail', showThumbnailFile);
          showFormData.append('cover', showCoverFile);
        }

        const showResponse = await api.post('/api/shows/create', showFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (showResponse.data?.status === 'success') {
          targetShowId = showResponse.data.id;
        } else {
          throw new Error(showResponse.data?.message || 'Failed to create TV Show');
        }
      }

      // 2. Upload video file
      setPipelineStatus('uploading');
      const formData = new FormData();
      formData.append('title', title);
      formData.append('visibility', visibility);
      formData.append('category', category);
      formData.append('description', description);
      formData.append('languages', JSON.stringify(languages));
      formData.append('contentType', contentType);
      formData.append('recordingDate', new Date(publishDate).toISOString());
      formData.append('video', values.videoFile);

      if (values.thumbnailType === 'upload' && values.thumbnailFile) {
        formData.append('thumbnail', values.thumbnailFile);
      }

      if (contentType === 'episode') {
        formData.append('showId', targetShowId);
        formData.append('seasonNumber', seasonNumber);
        formData.append('episodeNumber', episodeNumber);
      }

      const response = await api.post(`/api/videos/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', Accept: '*/*' },
      });

      const videoId = response.data?.id || null;
      setUploadedId(videoId);
      uploadedIdRef.current = videoId;
      setPipelineStatus('uploaded');
    } catch (error) {
      setPipelineStatus('failed');
      const msg = error.response?.data?.error?.message || error.response?.data?.message || error.message || 'Upload failed';
      setErrorDetail(msg);
    }
  };

  const formik = useFormik({
    initialValues: {
      contentType: 'movie',
      title: '',
      description: '',
      visibility: 'Public',
      languages: ['English'],
      recordingDate: new Date(),
      category: 'Others',
      videoFile: null,
      thumbnailType: 'auto',
      thumbnailFile: null,

      // TV Show episode options
      showSelectionType: 'existing',
      showId: '',
      seasonNumber: 1,
      episodeNumber: 1,

      // New TV Show options
      showTitle: '',
      showDescription: '',
      showLaunchYear: new Date().getFullYear(),
      showImagesType: 'auto',
      showThumbnailFile: null,
      showCoverFile: null,
    },
    onSubmit: async (values) => { await postToServer(values); },
    validate: (values) => {
      const errors = {};
      
      // Basic validations
      if (!values.title) errors.title = 'Title is required';
      if (!values.description) errors.description = 'Description is required';
      if (!values.visibility) errors.visibility = 'Visibility is required';
      if (!values.category) errors.category = 'Category is required';
      if (!values.recordingDate) errors.recordingDate = 'Recording date is required';

      // Video File Validation
      if (!values.videoFile) {
        errors.videoFile = 'File is required';
      } else if (values.videoFile.size > 500000000) {
        errors.videoFile = 'File must be < 500 MB';
      } else if (!['video/mp4', 'video/webm'].includes(values.videoFile.type)) {
        errors.videoFile = 'Only .mp4 or .webm files are supported';
      }

      // Video Thumbnail Validation
      if (values.thumbnailType === 'upload') {
        if (!values.thumbnailFile) {
          errors.thumbnailFile = 'Thumbnail file is required';
        } else if (values.thumbnailFile.size > 5000000) {
          errors.thumbnailFile = 'Thumbnail file must be < 5 MB';
        } else if (!['image/jpeg', 'image/png', 'image/webp'].includes(values.thumbnailFile.type)) {
          errors.thumbnailFile = 'Only .jpg, .png, or .webp images are supported';
        }
      }

      // Languages list size limit (up to 12)
      if (!values.languages || values.languages.length === 0) {
        errors.languages = 'Select at least one language';
      } else if (values.languages.length > 12) {
        errors.languages = 'You can select up to 12 languages';
      }

      // Conditional validation for TV Show
      if (values.contentType === 'episode') {
        if (values.showSelectionType === 'existing') {
          if (!values.showId) {
            errors.showId = 'Please select a TV show';
          }
        } else {
          if (!values.showTitle) errors.showTitle = 'TV Show title is required';
          if (!values.showDescription) errors.showDescription = 'TV Show description is required';
          if (!values.showLaunchYear) {
            errors.showLaunchYear = 'Launch year is required';
          } else if (isNaN(values.showLaunchYear) || values.showLaunchYear < 1800 || values.showLaunchYear > 2100) {
            errors.showLaunchYear = 'Enter a valid year between 1800 and 2100';
          }

          if (values.showImagesType === 'upload') {
            if (!values.showThumbnailFile) {
              errors.showThumbnailFile = 'TV Show card thumbnail is required';
            } else if (values.showThumbnailFile.size > 5000000) {
              errors.showThumbnailFile = 'File must be < 5 MB';
            } else if (!['image/jpeg', 'image/png', 'image/webp'].includes(values.showThumbnailFile.type)) {
              errors.showThumbnailFile = 'Only .jpg, .png, or .webp images are supported';
            }

            if (!values.showCoverFile) {
              errors.showCoverFile = 'TV Show backdrop cover is required';
            } else if (values.showCoverFile.size > 5000000) {
              errors.showCoverFile = 'File must be < 5 MB';
            } else if (!['image/jpeg', 'image/png', 'image/webp'].includes(values.showCoverFile.type)) {
              errors.showCoverFile = 'Only .jpg, .png, or .webp images are supported';
            }
          }
        }

        if (values.seasonNumber === undefined || values.seasonNumber < 1) {
          errors.seasonNumber = 'Season number must be >= 1';
        }
        if (values.episodeNumber === undefined || values.episodeNumber < 1) {
          errors.episodeNumber = 'Episode number must be >= 1';
        }
      }

      return errors;
    },
  });

  // Derived UI state
  const cfg = STATUS_CONFIG[pipelineStatus] || STATUS_CONFIG.idle;
  const isSubmitting = ['creating_show', 'uploading', 'uploaded', 'processing'].includes(pipelineStatus);

  const barValue    = pipelineStatus === 'processing' ? hlsPercent : cfg.progress;
  const barVariant  = cfg.indeterminate ? 'indeterminate' : 'determinate';

  const isEpisode = formik.values.contentType === 'episode';

  // Linear progress bar styles
  const barSx = {
    borderRadius: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    '& .MuiLinearProgress-bar': {
      backgroundColor: cfg.barColor,
      transition: pipelineStatus === 'processing' ? 'transform 0.3s ease' : undefined,
    },
  };

  return (
    <>
      <Helmet>
        <title>StreamSphere | Upload {isEpisode ? 'Episode' : 'Movie'}</title>
      </Helmet>

      <Container>
        <StyledContent>
          <Typography variant="h4" sx={{ mb: 2, fontWeight: 'fontWeightBold' }}>
            Upload {isEpisode ? 'TV Show Episode' : 'Movie'}
          </Typography>

          {pipelineStatus !== 'idle' && (
            <Box sx={{ mb: 4, p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Processing status:</Typography>
                <Chip label={cfg.label} color={cfg.color === 'inherit' ? 'default' : cfg.color} size="small" />
                {pipelineStatus === 'processing' && (
                  <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 700 }}>
                    {hlsPercent}%
                  </Typography>
                )}
              </Stack>
              <LinearProgress
                variant={barVariant}
                value={barValue}
                sx={barSx}
              />
              {pipelineStatus === 'failed' && (
                <Alert severity="error" sx={{ mt: 1 }}>{errorDetail}</Alert>
              )}
              {pipelineStatus === 'ready' && (
                <Alert severity="success" sx={{ mt: 1 }}>
                  Your video is ready! Redirecting to browse…
                </Alert>
              )}
              {pipelineStatus === 'processing' && (
                <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                  Transcoding video to HLS format. This may take a moment…
                </Typography>
              )}
            </Box>
          )}

          <form onSubmit={formik.handleSubmit}>
            <Stack spacing={3}>
              {/* Content Type Selector */}
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ mb: 1, fontWeight: 'fontWeightBold', color: 'text.primary' }}>
                  Content Type
                </FormLabel>
                <RadioGroup
                  row
                  aria-label="contentType"
                  name="contentType"
                  value={formik.values.contentType}
                  onChange={(e) => {
                    formik.setFieldValue('contentType', e.target.value);
                  }}
                >
                  <FormControlLabel value="movie" control={<Radio />} label="Movie" />
                  <FormControlLabel value="episode" control={<Radio />} label="TV Show Episode" />
                </RadioGroup>
              </FormControl>

              {/* Video File chooser */}
              <Stack spacing={1}>
                <FormLabel sx={{ fontWeight: 'fontWeightBold', color: 'text.primary' }}>
                  Video File
                </FormLabel>
                <label htmlFor="video">
                  <input
                    style={{ display: 'none' }}
                    name="video"
                    accept="video/mp4,video/webm"
                    id="video"
                    type="file"
                    onChange={(e) => formik.setFieldValue('videoFile', e.currentTarget.files[0])}
                  />
                  <Button
                    variant="contained"
                    component="span"
                    disabled={isSubmitting}
                    sx={{
                      bgcolor: 'primary.main',
                      color: '#fff',
                      fontWeight: 'bold',
                      '&:hover': { bgcolor: 'primary.dark' },
                    }}
                  >
                    Choose {isEpisode ? 'Episode' : 'Movie'} File
                  </Button>
                </label>

                <TextField
                  value={formik.values.videoFile?.name || ''}
                  placeholder="No file chosen"
                  error={Boolean(formik.errors?.videoFile)}
                  helperText={formik.errors?.videoFile}
                  InputProps={{ readOnly: true }}
                />
              </Stack>

              {/* TV Show Grouping and Metadata options (if Episode) */}
              {isEpisode && (
                <Box sx={{ p: 2.5, borderRadius: 1.5, border: '1px dashed', borderColor: 'primary.main', bgcolor: 'rgba(229, 9, 20, 0.03)' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'fontWeightBold', mb: 2, color: 'primary.main' }}>
                    TV Show Playlist Info
                  </Typography>

                  <FormControl component="fieldset" sx={{ mb: 2.5 }}>
                    <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.875rem' }}>
                      TV Show Registry
                    </FormLabel>
                    <RadioGroup
                      row
                      name="showSelectionType"
                      value={formik.values.showSelectionType}
                      onChange={(e) => formik.setFieldValue('showSelectionType', e.target.value)}
                    >
                      <FormControlLabel value="existing" control={<Radio size="small" />} label="Select Existing Show" />
                      <FormControlLabel value="new" control={<Radio size="small" />} label="Create New TV Show" />
                    </RadioGroup>
                  </FormControl>

                  {formik.values.showSelectionType === 'existing' ? (
                    <FormControl fullWidth sx={{ mb: 2.5 }}>
                      <InputLabel id="show-select-label">Select TV Show</InputLabel>
                      <Select
                        labelId="show-select-label"
                        id="show-select"
                        name="showId"
                        label="Select TV Show"
                        value={formik.values.showId}
                        onChange={formik.handleChange}
                        error={Boolean(formik.errors.showId)}
                      >
                        <MenuItem value="">-- Select Show --</MenuItem>
                        {showsList.map((show) => (
                          <MenuItem key={show._id} value={show._id}>
                            {show.title} ({show.launchYear})
                          </MenuItem>
                        ))}
                      </Select>
                      {formik.errors.showId && (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                          {formik.errors.showId}
                        </Typography>
                      )}
                    </FormControl>
                  ) : (
                    <Stack spacing={2.5} sx={{ mb: 2.5, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'fontWeightBold' }}>
                        New TV Show Details
                      </Typography>

                      <TextField
                        fullWidth
                        id="showTitle"
                        name="showTitle"
                        label="TV Show Title"
                        value={formik.values.showTitle}
                        onChange={formik.handleChange}
                        error={Boolean(formik.errors.showTitle)}
                        helperText={formik.errors.showTitle}
                      />

                      <TextField
                        fullWidth
                        id="showDescription"
                        name="showDescription"
                        label="TV Show Description"
                        multiline
                        rows={2}
                        value={formik.values.showDescription}
                        onChange={formik.handleChange}
                        error={Boolean(formik.errors.showDescription)}
                        helperText={formik.errors.showDescription}
                      />

                      <TextField
                        fullWidth
                        id="showLaunchYear"
                        name="showLaunchYear"
                        label="Launch Year"
                        type="number"
                        value={formik.values.showLaunchYear}
                        onChange={formik.handleChange}
                        error={Boolean(formik.errors.showLaunchYear)}
                        helperText={formik.errors.showLaunchYear}
                      />

                      {/* TV Show Images Options Selector */}
                      <FormControl fullWidth>
                        <InputLabel id="show-images-type-label">TV Show Images Options</InputLabel>
                        <Select
                          labelId="show-images-type-label"
                          id="show-images-type-select"
                          name="showImagesType"
                          label="TV Show Images Options"
                          value={formik.values.showImagesType || 'auto'}
                          onChange={(e) => {
                            formik.setFieldValue('showImagesType', e.target.value);
                            if (e.target.value === 'auto') {
                              formik.setFieldValue('showThumbnailFile', null);
                              formik.setFieldValue('showCoverFile', null);
                            }
                          }}
                        >
                          <MenuItem value="auto">Auto-generate from first episode</MenuItem>
                          <MenuItem value="upload">Upload Custom Images</MenuItem>
                        </Select>
                      </FormControl>

                      {formik.values.showImagesType === 'upload' && (
                        <>
                          {/* TV Show Thumbnail File Upload */}
                          <Stack spacing={1}>
                            <FormLabel sx={{ fontSize: '0.85rem' }}>TV Show Thumbnail (Card cover, 2:3 aspect ratio)</FormLabel>
                            <label htmlFor="showThumbnail">
                              <input
                                style={{ display: 'none' }}
                                name="showThumbnail"
                                accept="image/jpeg,image/png,image/webp"
                                id="showThumbnail"
                                type="file"
                                onChange={(e) => formik.setFieldValue('showThumbnailFile', e.currentTarget.files[0])}
                              />
                              <Button
                                variant="contained"
                                component="span"
                                size="small"
                                sx={{
                                  bgcolor: 'primary.main',
                                  color: '#fff',
                                  fontWeight: 'bold',
                                  '&:hover': { bgcolor: 'primary.dark' },
                                }}
                              >
                                Choose TV Show Thumbnail Image
                              </Button>
                            </label>
                            <TextField
                              value={formik.values.showThumbnailFile?.name || ''}
                              placeholder="No image chosen"
                              error={Boolean(formik.errors?.showThumbnailFile)}
                              helperText={formik.errors?.showThumbnailFile}
                              InputProps={{ readOnly: true }}
                              size="small"
                            />
                          </Stack>

                          {/* TV Show Cover File Upload */}
                          <Stack spacing={1}>
                            <FormLabel sx={{ fontSize: '0.85rem' }}>TV Show Cover (Hero banner backdrop, 16:9 aspect ratio)</FormLabel>
                            <label htmlFor="showCover">
                              <input
                                style={{ display: 'none' }}
                                name="showCover"
                                accept="image/jpeg,image/png,image/webp"
                                id="showCover"
                                type="file"
                                onChange={(e) => formik.setFieldValue('showCoverFile', e.currentTarget.files[0])}
                              />
                              <Button
                                variant="contained"
                                component="span"
                                size="small"
                                sx={{
                                  bgcolor: 'primary.main',
                                  color: '#fff',
                                  fontWeight: 'bold',
                                  '&:hover': { bgcolor: 'primary.dark' },
                                }}
                              >
                                Choose TV Show Cover Image
                              </Button>
                            </label>
                            <TextField
                              value={formik.values.showCoverFile?.name || ''}
                              placeholder="No image chosen"
                              error={Boolean(formik.errors?.showCoverFile)}
                              helperText={formik.errors?.showCoverFile}
                              InputProps={{ readOnly: true }}
                              size="small"
                            />
                          </Stack>
                        </>
                      )}
                    </Stack>
                  )}

                  {/* Season and Episode numbering */}
                  <Stack direction="row" spacing={2}>
                    <TextField
                      fullWidth
                      id="seasonNumber"
                      name="seasonNumber"
                      label="Season Number"
                      type="number"
                      value={formik.values.seasonNumber}
                      onChange={formik.handleChange}
                      error={Boolean(formik.errors.seasonNumber)}
                      helperText={formik.errors.seasonNumber}
                      inputProps={{ min: 1 }}
                    />

                    <TextField
                      fullWidth
                      id="episodeNumber"
                      name="episodeNumber"
                      label="Episode Number"
                      type="number"
                      value={formik.values.episodeNumber}
                      onChange={formik.handleChange}
                      error={Boolean(formik.errors.episodeNumber)}
                      helperText={formik.errors.episodeNumber}
                      inputProps={{ min: 1 }}
                    />
                  </Stack>
                </Box>
              )}

              {/* Title & Description of video */}
              <TextField
                id="title"
                name="title"
                label={isEpisode ? 'Episode Title' : 'Movie Title'}
                value={formik.values.title}
                onChange={formik.handleChange}
                error={formik.touched.title && Boolean(formik.errors.title)}
                helperText={formik.touched.title && formik.errors.title}
              />

              <TextField
                id="description"
                name="description"
                label={isEpisode ? 'Episode Description' : 'Movie Description'}
                multiline
                rows={3}
                value={formik.values.description}
                onChange={formik.handleChange}
                error={formik.touched.description && Boolean(formik.errors.description)}
                helperText={formik.touched.description && formik.errors.description}
              />

              {/* Episode/Movie Thumbnail selection */}
              <FormControl fullWidth>
                <InputLabel id="thumbnail-type-label">Thumbnail Options</InputLabel>
                <Select
                  labelId="thumbnail-type-label"
                  id="thumbnail-type-select"
                  name="thumbnailType"
                  label="Thumbnail Options"
                  value={formik.values.thumbnailType}
                  onChange={(e) => {
                    formik.setFieldValue('thumbnailType', e.target.value);
                    if (e.target.value === 'auto') {
                      formik.setFieldValue('thumbnailFile', null);
                    }
                  }}
                >
                  <MenuItem value="auto">Auto-generate Thumbnail</MenuItem>
                  <MenuItem value="upload">Upload Custom Thumbnail</MenuItem>
                </Select>
              </FormControl>

              {formik.values.thumbnailType === 'upload' && (
                <Stack spacing={1}>
                  <label htmlFor="thumbnail">
                    <input
                      style={{ display: 'none' }}
                      name="thumbnail"
                      accept="image/jpeg,image/png,image/webp"
                      id="thumbnail"
                      type="file"
                      onChange={(e) => formik.setFieldValue('thumbnailFile', e.currentTarget.files[0])}
                    />
                    <Button
                      variant="contained"
                      component="span"
                      disabled={isSubmitting}
                      sx={{
                        bgcolor: 'primary.main',
                        color: '#fff',
                        fontWeight: 'bold',
                        '&:hover': { bgcolor: 'primary.dark' },
                      }}
                    >
                      Choose Thumbnail Image
                    </Button>
                  </label>

                  <TextField
                    value={formik.values.thumbnailFile?.name || ''}
                    placeholder="No image chosen"
                    error={Boolean(formik.errors?.thumbnailFile)}
                    helperText={formik.errors?.thumbnailFile}
                    InputProps={{ readOnly: true }}
                  />
                </Stack>
              )}

              {/* Multi-language selection */}
              <FormControl fullWidth error={Boolean(formik.errors.languages)}>
                <InputLabel id="languages-label">Available Languages (Up to 12)</InputLabel>
                <Select
                  labelId="languages-label"
                  id="languages-select"
                  multiple
                  name="languages"
                  value={formik.values.languages}
                  onChange={(event) => {
                    const value = event.target.value;
                    const selected = typeof value === 'string' ? value.split(',') : value;
                    if (selected.length <= 12) {
                      formik.setFieldValue('languages', selected);
                    }
                  }}
                  input={<OutlinedInput label="Available Languages (Up to 12)" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {LANGUAGES_LIST.map((lang) => (
                    <MenuItem key={lang} value={lang}>
                      <Checkbox checked={formik.values.languages.indexOf(lang) > -1} />
                      <ListItemText primary={lang} />
                    </MenuItem>
                  ))}
                </Select>
                {formik.errors.languages && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {formik.errors.languages}
                  </Typography>
                )}
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="visibility-label">Visibility</InputLabel>
                <Select labelId="visibility-label" id="visibility-select" name="visibility"
                  label="Visibility" value={formik.values.visibility} onChange={formik.handleChange}>
                  <MenuItem value="Public">Public</MenuItem>
                  <MenuItem value="Private">Private</MenuItem>
                  <MenuItem value="Unlisted">Unlisted</MenuItem>
                </Select>
              </FormControl>

              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Publish Date"
                  value={formik.values.recordingDate}
                  inputFormat="DD/MM/YYYY"
                  onChange={(val) => formik.setFieldValue('recordingDate', val)}
                  renderInput={(params) => <TextField {...params} />}
                />
              </LocalizationProvider>

              <FormControl fullWidth>
                <InputLabel id="category-label">Category</InputLabel>
                <Select labelId="category-label" id="category-select" name="category"
                  label="Category" value={formik.values.category} onChange={formik.handleChange}>
                  <MenuItem value="Action">Action</MenuItem>
                  <MenuItem value="Comedy">Comedy</MenuItem>
                  <MenuItem value="Drama">Drama</MenuItem>
                  <MenuItem value="Romance">Romance</MenuItem>
                  <MenuItem value="Horror">Horror</MenuItem>
                  <MenuItem value="Thriller & Mystery">Thriller & Mystery</MenuItem>
                  <MenuItem value="Sci-Fi & Fantasy">Sci-Fi & Fantasy</MenuItem>
                  <MenuItem value="Documentary">Documentary</MenuItem>
                  <MenuItem value="Others">Others</MenuItem>
                </Select>
              </FormControl>

              <LoadingButton
                size="large" type="submit" variant="contained"
                disabled={formik.isSubmitting || !formik.isValid || isSubmitting}
                loading={isSubmitting}
              >
                {isSubmitting ? cfg.label : (isEpisode ? 'Upload Episode' : 'Upload Movie')}
              </LoadingButton>
            </Stack>
          </form>
        </StyledContent>
      </Container>
    </>
  );
}
