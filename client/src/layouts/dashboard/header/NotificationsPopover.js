import PropTypes from 'prop-types';
import { useState } from 'react';
import {
  Box,
  List,
  Badge,
  Button,
  Avatar,
  Tooltip,
  Divider,
  Popover,
  Typography,
  IconButton,
  ListItemText,
  ListSubheader,
  ListItemAvatar,
  ListItemButton,
} from '@mui/material';
import { fToNow } from '../../../utils/formatTime';
import Iconify from '../../../components/iconify';
import Scrollbar from '../../../components/scrollbar';
import { useSocket } from '../../../contexts/SocketContext';
import { useAuth, api } from '../../../contexts/AuthContext';
import { useEffect } from 'react';

// Real-time notifications handled via Socket.io

export default function NotificationsPopover() {
  const socket = useSocket();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(null);

  // Fetch notifications from server on mount
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/api/notifications');
        const loaded = response.data.map((n) => ({
          ...n,
          id: n._id,
          createdAt: new Date(n.createdAt),
          dismissedFromScreen: false,
        }));
        setNotifications(loaded);
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  // Listen for notifications
  useEffect(() => {
    const addNotification = (type, iconKey, title, description) => {
      setNotifications((prev) => [
        {
          id: `${type}-${Date.now()}`,
          title,
          description,
          type,
          iconKey,
          createdAt: new Date(),
          isUnRead: true,
          dismissedFromScreen: false,
        },
        ...prev,
      ]);
    };

    if (isAdmin) {
      socket.on('video:uploaded', (data) => {
        addNotification('video_uploaded', 'upload', `"${data.title || 'Video'}" uploaded`, 'Processing will begin shortly…');
      });

      socket.on('video:processing', (data) => {
        addNotification('video_processing', 'processing', `"${data.title || 'Video'}" is transcoding`, 'Converting to HLS format…');
      });

      socket.on('video:ready', (data) => {
        addNotification('video_ready', 'ready', `"${data.title || 'Video'}" is ready!`, 'Your video is now live and streamable');
      });

      socket.on('video:failed', (data) => {
        addNotification('video_failed', 'failed', `Processing failed`, data.error || `"${data.title || 'Video'}" could not be processed`);
      });
    }

    const handleWatchlistAdded = (event) => {
      const { videoTitle } = event.detail;
      addNotification('watchlist_added', 'watchlist', `"${videoTitle}" added`, 'successfully added to your watchlist');
    };

    const handleWatchlistRemoved = (event) => {
      const { videoTitle } = event.detail;
      addNotification('watchlist_removed', 'watchlist', `"${videoTitle}" removed`, 'successfully removed from your watchlist');
    };

    window.addEventListener('watchlist:added', handleWatchlistAdded);
    window.addEventListener('watchlist:removed', handleWatchlistRemoved);

    return () => {
      if (isAdmin) {
        socket.off('video:uploaded');
        socket.off('video:processing');
        socket.off('video:ready');
        socket.off('video:failed');
      }
      window.removeEventListener('watchlist:added', handleWatchlistAdded);
      window.removeEventListener('watchlist:removed', handleWatchlistRemoved);
    };
  }, [socket, isAdmin]);

  const totalUnRead = notifications.filter((n) => n.isUnRead).length;

  const handleOpen = (event) => setOpen(event.currentTarget);
  const handleClose = () => setOpen(null);

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isUnRead: false })));
    try {
      await api.put('/api/notifications/mark-read');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleClearAll = async () => {
    setNotifications([]);
    try {
      await api.delete('/api/notifications/clear');
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  };

  const recentNotifications = notifications.slice(0, 3);
  const olderNotifications = notifications.slice(3, 8);

  return (
    <>
      <IconButton color={open ? 'primary' : 'default'} onClick={handleOpen} sx={{ width: 40, height: 40 }}>
        <Badge badgeContent={totalUnRead} color="error">
          <Iconify icon="eva:bell-fill" />
        </Badge>
      </IconButton>

      <Popover
        open={Boolean(open)}
        anchorEl={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: { mt: 1.5, ml: 0.75, width: 360 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', py: 2, px: 2.5 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1">Notifications</Typography>
            {(totalUnRead > 0 || isAdmin) && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {totalUnRead > 0
                  ? `You have ${totalUnRead} unread message${totalUnRead > 1 ? 's' : ''}`
                  : 'All caught up! Notifications appear here when your videos are processed.'}
              </Typography>
            )}
          </Box>

          {totalUnRead > 0 && (
            <Tooltip title="Mark all as read">
              <IconButton color="primary" onClick={handleMarkAllAsRead}>
                <Iconify icon="eva:done-all-fill" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Divider sx={{ borderStyle: 'dashed' }} />

        <Scrollbar sx={{ height: { xs: 340, sm: 'auto' }, maxHeight: 400 }}>
          {notifications.length === 0 ? (
            <Box
              sx={{
                py: 5,
                px: 2.5,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
              }}
            >
              <Iconify icon="eva:bell-outline" sx={{ width: 48, height: 48, color: 'text.disabled' }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No notifications yet.
              </Typography>
              {isAdmin && (
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  Upload a video to see real-time processing updates here.
                </Typography>
              )}
            </Box>
          ) : (
            <>
              {recentNotifications.length > 0 && (
                <List
                  disablePadding
                  subheader={
                    <ListSubheader disableSticky sx={{ py: 1, px: 2.5, typography: 'overline' }}>
                      New
                    </ListSubheader>
                  }
                >
                  {recentNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </List>
              )}

              {olderNotifications.length > 0 && (
                <List
                  disablePadding
                  subheader={
                    <ListSubheader disableSticky sx={{ py: 1, px: 2.5, typography: 'overline' }}>
                      Earlier
                    </ListSubheader>
                  }
                >
                  {olderNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </List>
              )}
            </>
          )}
        </Scrollbar>

        {totalUnRead > 0 && (
          <>
            <Divider sx={{ borderStyle: 'dashed' }} />
            <Box sx={{ p: 1 }}>
              <Button fullWidth disableRipple onClick={handleClearAll} sx={{ color: 'error.main', fontWeight: 'bold' }}>
                Clear All Notifications
              </Button>
            </Box>
          </>
        )}
      </Popover>

      {/* Floating notification stack */}
      <Box
        sx={{
          position: 'fixed',
          top: 80,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          pointerEvents: 'none',
        }}
      >
        {notifications
          .filter((n) => !n.dismissedFromScreen && n.isUnRead)
          .slice(0, 3)
          .map((notification) => (
            <Box key={notification.id} sx={{ pointerEvents: 'auto' }}>
              <SwipeableNotification
                notification={notification}
                onDismiss={() => {
                  setNotifications((prev) =>
                    prev.map((n) =>
                      n.id === notification.id ? { ...n, dismissedFromScreen: true } : n
                    )
                  );
                }}
              />
            </Box>
          ))}
      </Box>
    </>
  );
}



NotificationItem.propTypes = {
  notification: PropTypes.shape({
    createdAt: PropTypes.instanceOf(Date),
    id: PropTypes.string,
    isUnRead: PropTypes.bool,
    title: PropTypes.string,
    description: PropTypes.string,
    type: PropTypes.string,
    iconKey: PropTypes.string,
  }),
};

function NotificationItem({ notification }) {
  const { avatar, title } = renderContent(notification);

  return (
    <ListItemButton
      sx={{
        py: 1.5,
        px: 2.5,
        mt: '1px',
        ...(notification.isUnRead && {
          bgcolor: 'action.selected',
        }),
      }}
    >
      <ListItemAvatar>
        <Avatar sx={{ bgcolor: 'background.neutral' }}>{avatar}</Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={title}
        secondary={
          <Typography
            variant="caption"
            sx={{
              mt: 0.5,
              display: 'flex',
              alignItems: 'center',
              color: 'text.disabled',
            }}
          >
            <Iconify icon="eva:clock-outline" sx={{ mr: 0.5, width: 16, height: 16 }} />
            {fToNow(notification.createdAt)}
          </Typography>
        }
      />
    </ListItemButton>
  );
}



function renderContent(notification) {
  const title = (
    <Typography variant="subtitle2">
      {notification.title}
      <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
        &nbsp; {notification.description}
      </Typography>
    </Typography>
  );

  const iconMap = {
    video_uploaded:   { icon: 'eva:cloud-upload-fill',  color: '#1890FF' },
    video_processing: { icon: 'eva:loader-outline',      color: '#FFC107' },
    video_ready:      { icon: 'eva:play-circle-fill',    color: '#54D62C' },
    video_failed:     { icon: 'eva:alert-triangle-fill', color: '#FF4842' },
    watchlist_added:  { icon: 'eva:bookmark-fill',       color: '#DF3E30' },
    watchlist_removed: { icon: 'eva:bookmark-outline',    color: '#637381' },
  };

  const iconConfig = iconMap[notification.type] || { icon: 'eva:bell-fill', color: '#637381' };

  return {
    avatar: (
      <Iconify
        icon={iconConfig.icon}
        sx={{ width: 24, height: 24, color: iconConfig.color }}
      />
    ),
    title,
  };
}



function SwipeableNotification({ notification, onDismiss }) {
  const [startX, setStartX] = useState(null);
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const { avatar, title } = renderContent(notification);

  const handlePointerDown = (e) => {
    setStartX(e.clientX);
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging || startX === null) return;
    const currentX = e.clientX;
    const diffX = currentX - startX;
    if (diffX > 0) {
      setOffsetX(diffX);
    }
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (offsetX > 100) {
      setOffsetX(400); // Slide out animation
      setTimeout(() => onDismiss(), 150);
    } else {
      setOffsetX(0);
    }
    setStartX(null);
  };

  return (
    <Box
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      sx={{
        width: 320,
        transform: `translateX(${offsetX}px)`,
        opacity: Math.max(0.1, 1 - offsetX / 300),
        transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
        touchAction: 'none',
        userSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        display: 'flex',
        alignItems: 'start',
        p: 2,
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        boxShadow: (theme) => theme.customShadows?.z24 || 24,
        border: '1px solid',
        borderColor: 'divider',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ mr: 1.5, mt: 0.5 }}>{avatar}</Box>
      <Box sx={{ flexGrow: 1 }}>
        {title}
        <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5, display: 'block' }}>
          Swipe right to dismiss
        </Typography>
      </Box>
    </Box>
  );
}
