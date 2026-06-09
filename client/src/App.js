import React, { useState, useEffect, useCallback } from "react";

import {
  Stack,
  Alert,
  Snackbar,
} from "@mui/material";

import Router from "./routes";
import ThemeProvider from "./theme";
import ScrollToTop from "./components/scroll-to-top";
import { StyledChart } from "./components/chart";

import { useSocket } from "./contexts/SocketContext";
import { useAuth } from "./contexts/AuthContext";

// Socket notifications
const SOCKET_NOTIFICATIONS = {
  "video:uploaded":   { severity: "info",    template: (d) => `"${d.title}" uploaded. Processing will begin shortly…` },
  "video:processing": { severity: "info",    template: (d) => `"${d.title}" is being transcoded to HLS…` },
  "video:ready":      { severity: "success", template: (d) => `"${d.title}" is ready to stream! 🎬` },
  "video:failed":     { severity: "error",   template: (d) => `Processing failed for "${d.title}": ${d.error || "unknown error"}` },
};

export default function App() {
  const socket = useSocket();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [notification, setNotification] = useState(null); // { message, severity }

  const showNotification = useCallback((severity, message) => {
    setNotification({ severity, message });
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    Object.entries(SOCKET_NOTIFICATIONS).forEach(([event, { severity, template }]) => {
      socket.on(event, (data) => {
        showNotification(severity, template(data));
      });
    });

    return () => {
      Object.keys(SOCKET_NOTIFICATIONS).forEach((event) => socket.off(event));
    };
  }, [socket, showNotification, isAdmin]);

  return (
    <ThemeProvider>
      <ScrollToTop />
      <StyledChart />
      <Router />
      <Stack>
        <Snackbar
          open={Boolean(notification)}
          autoHideDuration={6000}
          onClose={() => setNotification(null)}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert
            onClose={() => setNotification(null)}
            severity={notification?.severity || "info"}
            sx={{ width: "100%" }}
          >
            {notification?.message}
          </Alert>
        </Snackbar>
      </Stack>
    </ThemeProvider>
  );
}
