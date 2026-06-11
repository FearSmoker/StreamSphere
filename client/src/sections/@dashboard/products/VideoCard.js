import PropTypes from 'prop-types';
// @mui
import { Box, Card, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { Link } from "react-router-dom";
import Moment from 'react-moment';

// contexts
import { useAuth } from '../../../contexts/AuthContext';

// utils
// components
import Label from '../../../components/label';

// ----------------------------------------------------------------------

const StyledProductImg = styled('img')({
  top: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  position: 'absolute',
});

// ----------------------------------------------------------------------

VideoCard.propTypes = {
  video: PropTypes.object,
};

export default function VideoCard({ video }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const {
    title: name,
    thumbnailUrl: cover,
    viewCount,
    status,
    recordingDate,
    _id: id,
    isTVShow,
    seasons,
    launchYear,
  } = video;

  const totalEpisodes = seasons
    ? seasons.reduce((acc, s) => acc + (s.episodes?.length || 0), 0)
    : 0;

  return (
    <Card>
      <Box sx={{ pt: '150%', position: 'relative' }}>
        {status && isAdmin && (
          <Label
            variant='filled'
            color={(status === 'sale' && 'error') || 'info'}
            sx={{
              zIndex: 9,
              top: 16,
              right: 16,
              position: 'absolute',
              textTransform: 'uppercase',
            }}
          >
            {status}
          </Label>
        )}
        {cover ? (
          <StyledProductImg alt={name} src={cover} />
        ) : (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#111827',
              color: '#fff',
              px: 2,
              textAlign: 'center',
            }}
          >
            <Typography variant='subtitle2'>{name}</Typography>
          </Box>
        )}
      </Box>

      <Stack spacing={2} sx={{ p: 3 }}>
        <Stack direction='row' alignItems='center' justifyContent='space-between'>
            <Link to={isTVShow ? `/shows/${id}` : `/videos/${id}`} color='inherit' style={{ textDecoration: 'none', color: 'inherit' }}>
              <Typography variant='subtitle2' noWrap>
                {name}
              </Typography>
            </Link>
            <Typography variant='subtitle1'>
              {isTVShow ? launchYear : <Moment format='DD/MM/yyyy'>{recordingDate}</Moment>}
            </Typography>
          </Stack>
          
          <Stack direction='row' alignItems='center' justifyContent='space-between'>
            <Typography variant='subtitle1'>
              {isTVShow ? `${totalEpisodes} Episodes` : `${viewCount} views`}
            </Typography>
            {isTVShow && (
              <Typography variant='subtitle1'>
                {`${seasons?.length || 0} Seasons`}
              </Typography>
            )}
          </Stack>
      </Stack>
    </Card>
  );
}
