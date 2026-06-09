import PropTypes from 'prop-types';
// @mui
import {
  Card,
  CardHeader,
  Box,
  Stack,
  Typography,
  Avatar,
  Divider,
  LinearProgress,
} from '@mui/material';
import { PlayCircleOutline } from '@mui/icons-material';
import { getThumbnailUrl } from '../../../utils/resolveAsset';


AppMostWatched.propTypes = {
  title:    PropTypes.string,
  subheader: PropTypes.string,
  list:     PropTypes.array.isRequired,
};

export default function AppMostWatched({ title, subheader, list, ...other }) {
  const maxViews = list.length > 0 ? Math.max(...list.map((v) => v.viewCount || 0)) : 1;

  return (
    <Card {...other}>
      <CardHeader title={title} subheader={subheader} />
      <Box sx={{ px: 3, pb: 3, pt: 2 }}>
        {list.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            No watch data yet.
          </Typography>
        )}
        <Stack spacing={2}>
          {list.map((video, index) => (
            <Box key={video._id || index}>
              <Stack direction="row" alignItems="center" spacing={2}>
                {/* Rank badge */}
                <Box
                  sx={{
                    minWidth: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: index === 0 ? 'info.main' : index === 1 ? 'success.main' : index === 2 ? 'warning.main' : 'error.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '0.75rem',
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </Box>

                {/* Thumbnail */}
                <Avatar
                  src={getThumbnailUrl(video.thumbnailUrl, '/assets/images/covers/cover_1.jpg')}
                  variant="rounded"
                  sx={{ width: 48, height: 34, borderRadius: 1, flexShrink: 0 }}
                >
                  <PlayCircleOutline />
                </Avatar>

                {/* Title + progress bar */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap sx={{ mb: 0.5 }}>
                    {video.title}
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <LinearProgress
                      variant="determinate"
                      value={maxViews > 0 ? ((video.viewCount || 0) / maxViews) * 100 : 0}
                      sx={{
                        flex: 1,
                        height: 6,
                        borderRadius: 3,
                        bgcolor: 'action.disabledBackground',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          bgcolor: index === 0 ? 'info.main' : index === 1 ? 'success.main' : index === 2 ? 'warning.main' : 'error.main',
                        },
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', minWidth: 56, textAlign: 'right' }}>
                      {(video.viewCount || 0).toLocaleString()} views
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
              {index < list.length - 1 && <Divider sx={{ mt: 2, opacity: 0.4 }} />}
            </Box>
          ))}
        </Stack>
      </Box>
    </Card>
  );
}
