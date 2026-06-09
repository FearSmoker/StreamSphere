// @mui
import { alpha, styled } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Replaced simplebar-react (incompatible with React 18) with a native
// scroll container that has styled webkit scrollbar tracks.

export const StyledRootScrollbar = styled('div')(() => ({
  flexGrow: 1,
  height: '100%',
  overflow: 'hidden',
}));

export const StyledScrollbar = styled('div')(({ theme }) => ({
  maxHeight: '100%',
  overflow: 'auto',
  // Custom webkit scrollbar styling to match simplebar appearance
  '&::-webkit-scrollbar': {
    width: 10,
    height: 6,
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: alpha(theme.palette.grey[600], 0.48),
    borderRadius: 8,
    border: '2px solid transparent',
    backgroundClip: 'content-box',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    backgroundColor: alpha(theme.palette.grey[600], 0.72),
  },
}));
