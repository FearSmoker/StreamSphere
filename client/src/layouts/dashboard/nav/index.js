import PropTypes from 'prop-types';
import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
// @mui
import { styled, alpha } from '@mui/material/styles';
import { Box, Link, Drawer, Typography, Avatar, IconButton } from '@mui/material';
// hooks
import useResponsive from '../../../hooks/useResponsive';
// components
import Logo from '../../../components/logo';
import Scrollbar from '../../../components/scrollbar';
import NavSection from '../../../components/nav-section';
import Iconify from '../../../components/iconify';
// contexts
import { useAuth } from '../../../contexts/AuthContext';
//
import navConfig from './config';

// ----------------------------------------------------------------------

const NAV_WIDTH = 280;

const StyledAccount = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(2, 2.5),
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  backgroundColor: alpha(theme.palette.grey[500], 0.12),
}));

// ----------------------------------------------------------------------

Nav.propTypes = {
  openNav: PropTypes.bool,
  onCloseNav: PropTypes.func,
  desktopSidebarOpen: PropTypes.bool,
  onCloseDesktopNav: PropTypes.func,
};

export default function Nav({ openNav, onCloseNav, desktopSidebarOpen, onCloseDesktopNav }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isDesktop = useResponsive('up', 'lg');

  useEffect(() => {
    if (openNav) {
      onCloseNav();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const filteredNavConfig = useMemo(() => {
    const isAdmin = user?.role === 'admin';
    return navConfig.filter((item) => {
      if (item.adminOnly && !isAdmin) {
        return false;
      }
      return true;
    });
  }, [user]);

  const displayName = user?.username || 'StreamSphere Guest';
  const role = user?.role || 'user';
  const photoURL = user?.avatar?.trim() ? user.avatar : 'https://res.cloudinary.com/desk6uyon/image/upload/v1780977340/streamsphere/avatars/avatar_1.jpg';

  const renderContent = (
    <Scrollbar
      sx={{
        height: 1,
        '& .simplebar-content': { height: 1, display: 'flex', flexDirection: 'column' },
      }}
    >
      <Box sx={{ px: 2.5, py: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo />
        {isDesktop && (
          <IconButton
            onClick={onCloseDesktopNav}
            sx={{
              color: 'text.primary',
              '&:hover': { bgcolor: alpha('#fff', 0.08) },
            }}
          >
            <Iconify icon="eva:menu-2-fill" />
          </IconButton>
        )}
      </Box>

      <Box sx={{ mb: 5, mx: 2.5 }}>
        <Link href="/profile" underline="none">
          <StyledAccount>
            <Avatar src={photoURL} alt={displayName} />

            <Box sx={{ ml: 2 }}>
              <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>
                {displayName}
              </Typography>

              <Typography variant="body2" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                {role}
              </Typography>
            </Box>
          </StyledAccount>
        </Link>
      </Box>

      <NavSection data={filteredNavConfig} />

      <Box sx={{ flexGrow: 1 }} />
    </Scrollbar>
  );

  return (
    <Box
      component="nav"
      sx={{
        flexShrink: { lg: 0 },
        width: { lg: desktopSidebarOpen ? NAV_WIDTH : 0 },
        display: { lg: desktopSidebarOpen ? 'block' : 'none' },
        transition: (theme) =>
          theme.transitions.create(['width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
      }}
    >
      {isDesktop ? (
        <Drawer
          open={desktopSidebarOpen}
          variant="persistent"
          PaperProps={{
            sx: {
              width: NAV_WIDTH,
              bgcolor: 'background.default',
              borderRightStyle: 'dashed',
            },
          }}
        >
          {renderContent}
        </Drawer>
      ) : (
        <Drawer
          open={openNav}
          onClose={onCloseNav}
          ModalProps={{
            keepMounted: true,
          }}
          PaperProps={{
            sx: { width: NAV_WIDTH },
          }}
        >
          {renderContent}
        </Drawer>
      )}
    </Box>
  );
}
