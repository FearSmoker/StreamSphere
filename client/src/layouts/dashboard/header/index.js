import PropTypes from 'prop-types';
// @mui
import { styled } from '@mui/material/styles';
import { Box, Stack, AppBar, Toolbar, IconButton } from '@mui/material';
// contexts
import { useThemeMode } from '../../../contexts/ThemeContext';
// utils
import { bgBlur } from '../../../utils/cssStyles';
// components
import Iconify from '../../../components/iconify';
//

import AccountPopover from './AccountPopover';
import LanguagePopover from './LanguagePopover';
import NotificationsPopover from './NotificationsPopover';

// ----------------------------------------------------------------------

const NAV_WIDTH = 280;

const HEADER_MOBILE = 64;

const HEADER_DESKTOP = 92;

const StyledRoot = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== 'desktopSidebarOpen',
})(({ theme, desktopSidebarOpen }) => ({
  ...bgBlur({ color: theme.palette.background.default }),
  boxShadow: 'none',
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  [theme.breakpoints.up('lg')]: {
    width: desktopSidebarOpen ? `calc(100% - ${NAV_WIDTH + 1}px)` : '100%',
  },
}));

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  minHeight: HEADER_MOBILE,
  [theme.breakpoints.up('lg')]: {
    minHeight: HEADER_DESKTOP,
    padding: theme.spacing(0, 5),
  },
}));

// ----------------------------------------------------------------------

Header.propTypes = {
  onOpenNav: PropTypes.func,
  desktopSidebarOpen: PropTypes.bool,
  onOpenDesktopNav: PropTypes.func,
};

export default function Header({ onOpenNav, desktopSidebarOpen, onOpenDesktopNav }) {
  const { themeMode, toggleThemeMode } = useThemeMode();

  return (
    <StyledRoot desktopSidebarOpen={desktopSidebarOpen}>
      <StyledToolbar>
        <IconButton
          onClick={onOpenNav}
          sx={{
            mr: 1,
            color: 'text.primary',
            display: { lg: 'none' },
          }}
        >
          <Iconify icon="eva:menu-2-fill" />
        </IconButton>

        {!desktopSidebarOpen && (
          <IconButton
            onClick={onOpenDesktopNav}
            sx={{
              mr: 1,
              color: 'text.primary',
              display: { xs: 'none', lg: 'inline-flex' },
            }}
          >
            <Iconify icon="eva:menu-2-fill" />
          </IconButton>
        )}

        <Box sx={{ flexGrow: 1 }} />

        <Stack
          direction="row"
          alignItems="center"
          spacing={{
            xs: 0.5,
            sm: 1,
          }}
        >
          <IconButton
            onClick={toggleThemeMode}
            sx={{
              width: 40,
              height: 40,
              color: 'text.primary',
            }}
          >
            <Iconify icon={themeMode === 'dark' ? 'eva:sun-fill' : 'eva:moon-fill'} />
          </IconButton>
          <LanguagePopover />
          <NotificationsPopover />
          <AccountPopover />
        </Stack>
      </StyledToolbar>
    </StyledRoot>
  );
}
