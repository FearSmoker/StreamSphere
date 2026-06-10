import { Helmet } from 'react-helmet-async';
import { useState, useEffect } from 'react';
// @mui
import { useTheme } from '@mui/material/styles';
import { Grid, Container, Typography, CircularProgress, Box } from '@mui/material';
// sections
import {
  AppCurrentVisits,
  AppWebsiteVisits,
  AppWidgetSummary,
  AppNewsUpdate,
  AppDailyActiveUsers,
  AppMostWatched,
  AppSignupsTrend,
} from '../sections/@dashboard/app';
import { api } from '../contexts/AuthContext';
import { getThumbnailUrl } from '../utils/resolveAsset';

// ----------------------------------------------------------------------

export default function DashboardAppPage() {
  const theme = useTheme();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await api.get('/api/admin/analytics');
        if (response.data && response.data.status === 'success') {
          setAnalytics(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  const getActiveTranscodingCount = () => {
    if (!analytics || !analytics.queueStats) return 0;
    let total = 0;
    Object.values(analytics.queueStats).forEach((queue) => {
      total += (queue.active || 0) + (queue.waiting || 0);
    });
    return total;
  };

  const getQueueChartData = () => {
    if (!analytics || !analytics.queueStats) return [];
    const qNames = ['video.uploaded', 'video.hls-converting', 'video.hls.converted'];
    const activeData = [];
    const waitingData = [];
    const completedData = [];
    const failedData = [];

    qNames.forEach((name) => {
      const stats = analytics.queueStats[name] || { active: 0, waiting: 0, completed: 0, failed: 0 };
      activeData.push(stats.active || 0);
      waitingData.push(stats.waiting || 0);
      completedData.push(stats.completed || 0);
      failedData.push(stats.failed || 0);
    });

    return [
      { name: 'Active', type: 'column', fill: 'solid', data: activeData },
      { name: 'Waiting', type: 'column', fill: 'solid', data: waitingData },
      { name: 'Completed', type: 'column', fill: 'solid', data: completedData },
      { name: 'Failed', type: 'column', fill: 'solid', data: failedData },
    ];
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const categoryChartData = (analytics?.categoryStats || []).map((item) => ({
    label: item._id || 'Others',
    value: item.count || 0,
  }));

  // Trending categories by total views (for bar chart section)
  const trendingCategoriesData = (analytics?.trendingCategories || []).map((item) => ({
    label: item._id || 'Unknown',
    views: item.totalViews || 0,
    count: item.count || 0,
  }));

  const trendingCategoriesChartData = [{
    name: 'Total Views',
    data: trendingCategoriesData.map((c) => c.views),
  }];

  const categoryColorMap = {
    Action: theme.palette.error.main,
    Comedy: theme.palette.warning.main,
    Drama: theme.palette.primary.main,
    Romance: '#ff4081',
    Horror: '#9c27b0',
    'Thriller & Mystery': '#795548',
    'Sci-Fi & Fantasy': '#00bcd4',
    Documentary: theme.palette.success.main,
    Others: theme.palette.grey[500],
    Unknown: theme.palette.grey[500],
  };

  const categoryChartColors = categoryChartData.length
    ? categoryChartData.map((item) => categoryColorMap[item.label] || theme.palette.grey[500])
    : [theme.palette.grey[500]];

  const trendingCategoriesChartColors = trendingCategoriesData.map(
    (c) => categoryColorMap[c.label] || theme.palette.grey[500]
  );

  const chartData = getQueueChartData();

  return (
    <>
      <Helmet>
        <title> Admin Dashboard | StreamSphere </title>
      </Helmet>

      <Container maxWidth="xl">
        <Typography variant="h4" sx={{ mb: 5 }}>
          Hi, Welcome back
        </Typography>

        <Grid container spacing={3}>
          {/* ── Row 1: Top Stat Cards ── */}
          <Grid item xs={12} sm={6} md={3}>
            <AppWidgetSummary
              title="Platform Video Views"
              total={analytics?.totalViews || 0}
              icon={'eva:eye-fill'}
              sx={{ height: '100%' }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <AppWidgetSummary
              title="Total Users"
              total={analytics?.totalUsers || 0}
              color="info"
              icon={'eva:people-fill'}
              sx={{ height: '100%' }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <AppWidgetSummary
              title="Total Videos"
              total={analytics?.totalVideos || 0}
              color="warning"
              icon={'eva:video-fill'}
              sx={{ height: '100%' }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <AppWidgetSummary
              title="Active Queue Jobs"
              total={getActiveTranscodingCount()}
              color="error"
              icon={'eva:activity-fill'}
              sx={{ height: '100%' }}
            />
          </Grid>

          {/* ── Row 2: BullMQ Chart + Category Pie ── */}
          <Grid item xs={12} md={6} lg={8}>
            <AppWebsiteVisits
              title="BullMQ Queue Statuses"
              subheader="Live tracking of background job pipelines"
              chartLabels={['Video Uploaded', 'HLS Converting', 'HLS Converted']}
              chartData={chartData.length ? chartData : [
                { name: 'Active', type: 'column', fill: 'solid', data: [0, 0, 0] },
                { name: 'Waiting', type: 'column', fill: 'solid', data: [0, 0, 0] },
                { name: 'Completed', type: 'column', fill: 'solid', data: [0, 0, 0] },
                { name: 'Failed', type: 'column', fill: 'solid', data: [0, 0, 0] },
              ]}
              sx={{ height: '100%' }}
            />
          </Grid>

          <Grid item xs={12} md={6} lg={4}>
            <AppCurrentVisits
              title="Videos by Category"
              chartData={categoryChartData.length ? categoryChartData : [{ label: 'None', value: 0 }]}
              chartColors={categoryChartColors}
              sx={{ height: '100%' }}
            />
          </Grid>

          {/* ── Row 3: DAU + Signups Trend ── */}
          <Grid item xs={12} md={6}>
            <AppDailyActiveUsers
              title="Daily Active Users"
              subheader="Unique viewers per day — last 7 days"
              data={analytics?.dailyActiveUsers || []}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <AppSignupsTrend
              title="New Signups"
              subheader="Toggle between daily and monthly view"
              perDay={analytics?.signupsPerDay || []}
              perMonth={analytics?.signupsPerMonth || []}
            />
          </Grid>

          {/* ── Row 4: Most Watched + Trending Categories ── */}
          <Grid item xs={12} md={6} lg={5}>
            <AppMostWatched
              title="Most Watched Content"
              subheader="Top 5 videos by total view count"
              list={analytics?.mostWatchedVideos || []}
              sx={{ height: '100%' }}
            />
          </Grid>

          <Grid item xs={12} md={6} lg={7}>
            <AppWebsiteVisits
              title="Trending Categories"
              subheader="Top categories ranked by total views"
              chartLabels={trendingCategoriesData.map((c) => c.label)}
              chartData={trendingCategoriesChartData.length && trendingCategoriesData.length
                ? trendingCategoriesChartData
                : [{ name: 'Total Views', data: [0] }]}
              chartColors={trendingCategoriesChartColors}
              chartType="bar"
              sx={{ height: '100%' }}
            />
          </Grid>

          {/* ── Row 5: Recent Uploads ── */}
          <Grid item xs={12} md={12} lg={12}>
            <AppNewsUpdate
              title="Recent Uploads"
              list={(analytics?.latestVideos || []).map((video) => ({
                id: video._id,
                title: video.title,
                description: `Category: ${video.category} | Status: ${video.status} | Views: ${video.viewCount || 0}`,
                image: getThumbnailUrl(video.thumbnailUrl, '/assets/images/covers/cover_1.jpg'),
                postedAt: video.createdAt ? new Date(video.createdAt) : new Date(),
              }))}
            />
          </Grid>
        </Grid>
      </Container>
    </>
  );
}


