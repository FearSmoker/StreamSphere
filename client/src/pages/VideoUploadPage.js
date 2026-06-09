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
} from '@mui/material';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { LoadingButton } from '@mui/lab';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { useFormik } from 'formik';
import * as yup from 'yup';

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
  padding: theme.spacing(12, 0),
}));

// Video pipeline stages and their configs
const STATUS_CONFIG = {
  idle:       { label: 'Waiting',       color: 'inherit',  barColor: '#90caf9', progress: 0,   indeterminate: false },
  uploading:  { label: 'Uploading…',    color: 'info',     barColor: '#42a5f5', progress: 30,  indeterminate: true  },
  uploaded:   { label: 'Queued',        color: 'info',     barColor: '#42a5f5', progress: 35,  indeterminate: false },
  processing: { label: 'Processing…',   color: 'warning',  barColor: '#ffa726', progress: 0,   indeterminate: false }, // progress is live %
  ready:      { label: 'Done ✓',        color: 'success',  barColor: '#66bb6a', progress: 100, indeterminate: false },
  failed:     { label: 'Failed ✗',      color: 'error',    barColor: '#f44336', progress: 100, indeterminate: false },
};

const validationSchema = yup.object({
  title:       yup.string().required('Title is required'),
  description: yup.string().required('Description is required'),
  visibility:  yup.string().required('Visibility is required'),
  language:    yup.string().required('Language is required'),
  recordingDate: yup.date().required('Recording date is required'),
  category:    yup.string().required('Category is required'),
});



export default function VideoUploadPage() {
  const navigate       = useNavigate();
  const socket         = useSocket();
  const [uploadedId, setUploadedId]         = useState(null);
  const [pipelineStatus, setPipelineStatus] = useState('idle');
  const [hlsPercent, setHlsPercent]         = useState(0);   // transcode percent
  const [errorDetail, setErrorDetail]       = useState('');
  const navigatedRef = useRef(false);
  const uploadedIdRef = useRef(null); // ref for socket callbacks

  // Sync ref with state
  useEffect(() => { uploadedIdRef.current = uploadedId; }, [uploadedId]);

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

  // Form and upload logic
  const postToServer = async (values) => {
    const { title, category, description, recordingDate, visibility, language } = values;
    const publishDate = recordingDate?.toDate ? recordingDate.toDate() : recordingDate;

    const formData = new FormData();
    formData.append('title', title);
    formData.append('visibility', visibility);
    formData.append('category', category);
    formData.append('description', description);
    formData.append('language', language);
    formData.append('recordingDate', new Date(publishDate).toISOString());
    formData.append('video', values.videoFile);
    if (values.thumbnailType === 'upload' && values.thumbnailFile) {
      formData.append('thumbnail', values.thumbnailFile);
    }

    setPipelineStatus('uploading');

    try {
      const response = await api.post(`/api/videos/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', Accept: '*/*' },
      });
      const videoId = response.data?.id || null;
      setUploadedId(videoId);
      uploadedIdRef.current = videoId;
      setPipelineStatus('uploaded');
    } catch (error) {
      setPipelineStatus('failed');
      const msg = error.response?.data?.error?.message || error.message || 'Upload failed';
      setErrorDetail(msg);
    }
  };

  const formik = useFormik({
    initialErrors: { videoFile: 'Video file is required' },
    initialValues: {
      title: '',
      description: '',
      visibility: 'Public',
      language: 'English',
      recordingDate: new Date(),
      category: 'Education',
      videoFile: null,
      thumbnailType: 'auto',
      thumbnailFile: null,
    },
    validationSchema,
    onSubmit: async (values) => { await postToServer(values); },
    validate: (values) => {
      const errors = {};
      if (!values.videoFile) errors.videoFile = 'Video file is required';
      else if (values.videoFile.size > 500000000) errors.videoFile = 'File must be < 500 MB';
      else if (!['video/mp4', 'video/webm'].includes(values.videoFile.type))
        errors.videoFile = 'Only .mp4 or .webm files are supported';

      if (values.thumbnailType === 'upload') {
        if (!values.thumbnailFile) {
          errors.thumbnailFile = 'Thumbnail file is required';
        } else if (values.thumbnailFile.size > 5000000) {
          errors.thumbnailFile = 'Thumbnail file must be < 5 MB';
        } else if (!['image/jpeg', 'image/png', 'image/webp'].includes(values.thumbnailFile.type)) {
          errors.thumbnailFile = 'Only .jpg, .png, or .webp images are supported';
        }
      }
      return errors;
    },
  });

  // Derived UI state
  const cfg = STATUS_CONFIG[pipelineStatus] || STATUS_CONFIG.idle;
  const isSubmitting = ['uploading', 'uploaded', 'processing'].includes(pipelineStatus);

  const barValue    = pipelineStatus === 'processing' ? hlsPercent : cfg.progress;
  const barVariant  = cfg.indeterminate ? 'indeterminate' : 'determinate';

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
        <title>StreamSphere | Upload Video</title>
      </Helmet>

      <Container>
        <StyledContent>
          <Typography variant="h4" sx={{ mb: 2 }}>
            Upload Video
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
              <label htmlFor="video">
                <input
                  style={{ display: 'none' }}
                  name="video"
                  accept="video/mp4,video/webm"
                  id="video"
                  type="file"
                  onChange={(e) => formik.setFieldValue('videoFile', e.currentTarget.files[0])}
                />
                <Button color="secondary" variant="contained" component="span" disabled={isSubmitting}>
                  Choose Video File
                </Button>
              </label>

              <TextField
                value={formik.values.videoFile?.name || ''}
                placeholder="No file chosen"
                error={Boolean(formik.errors?.videoFile)}
                helperText={formik.errors?.videoFile}
                InputProps={{ readOnly: true }}
              />

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
                    <Button color="secondary" variant="contained" component="span" disabled={isSubmitting}>
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

              <TextField
                id="title" name="title" label="Video Title"
                value={formik.values.title} onChange={formik.handleChange}
                error={formik.touched.title && Boolean(formik.errors.title)}
                helperText={formik.touched.title && formik.errors.title}
              />

              <TextField
                id="description" name="description" label="Description" multiline rows={3}
                value={formik.values.description} onChange={formik.handleChange}
                error={formik.touched.description && Boolean(formik.errors.description)}
                helperText={formik.touched.description && formik.errors.description}
              />

              <FormControl fullWidth>
                <InputLabel id="visibility-label">Visibility</InputLabel>
                <Select labelId="visibility-label" id="visibility-select" name="visibility"
                  label="Visibility" value={formik.values.visibility} onChange={formik.handleChange}>
                  <MenuItem value="Public">Public</MenuItem>
                  <MenuItem value="Private">Private</MenuItem>
                  <MenuItem value="Unlisted">Unlisted</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="language-label">Language</InputLabel>
                <Select labelId="language-label" id="language-select" name="language"
                  label="Language" value={formik.values.language} onChange={formik.handleChange}>
                  <MenuItem value="English">English</MenuItem>
                  <MenuItem value="Hindi">Hindi</MenuItem>
                  <MenuItem value="Spanish">Spanish</MenuItem>
                  <MenuItem value="French">French</MenuItem>
                  <MenuItem value="Bangla">Bangla</MenuItem>
                  <MenuItem value="Urdu">Urdu</MenuItem>
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
                  <MenuItem value="Education">Education</MenuItem>
                  <MenuItem value="Technology">Technology</MenuItem>
                  <MenuItem value="Travel">Travel</MenuItem>
                  <MenuItem value="Entertainment">Entertainment</MenuItem>
                  <MenuItem value="Sports">Sports</MenuItem>
                  <MenuItem value="Others">Others</MenuItem>
                </Select>
              </FormControl>

              <LoadingButton
                size="large" type="submit" variant="contained"
                disabled={formik.isSubmitting || !formik.isValid || isSubmitting}
                loading={isSubmitting}
              >
                {isSubmitting ? cfg.label : 'Upload Video'}
              </LoadingButton>
            </Stack>
          </form>
        </StyledContent>
      </Container>


    </>
  );
}
