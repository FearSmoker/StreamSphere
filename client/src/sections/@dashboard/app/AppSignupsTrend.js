import { useState } from 'react';
import PropTypes from 'prop-types';
import ReactApexChart from 'react-apexcharts';
// @mui
import { Card, CardHeader, Box, ToggleButtonGroup, ToggleButton } from '@mui/material';
// hooks
import { useChart } from '../../../components/chart';

// Helper functions
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildDailySignups(rawData) {
  const today = new Date();
  const labels = [];
  const counts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    labels.push(`${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`);
    const match = rawData.find(
      (r) =>
        r._id.year === d.getFullYear() &&
        r._id.month === d.getMonth() + 1 &&
        r._id.day === d.getDate()
    );
    counts.push(match ? match.count : 0);
  }
  return { labels, counts };
}

function buildMonthlySignups(rawData) {
  const today = new Date();
  const labels = [];
  const counts = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    labels.push(`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`);
    const match = rawData.find(
      (r) => r._id.year === d.getFullYear() && r._id.month === d.getMonth() + 1
    );
    counts.push(match ? match.count : 0);
  }
  return { labels, counts };
}


AppSignupsTrend.propTypes = {
  title:         PropTypes.string,
  subheader:     PropTypes.string,
  perDay:        PropTypes.array.isRequired,
  perMonth:      PropTypes.array.isRequired,
};

export default function AppSignupsTrend({ title, subheader, perDay, perMonth }) {
  const [view, setView] = useState('day');

  const daily   = buildDailySignups(perDay);
  const monthly = buildMonthlySignups(perMonth);

  const current = view === 'day' ? daily : monthly;
  const maxVal = Math.max(...current.counts, 1);

  const chartOptions = useChart({
    xaxis: {
      categories: current.labels,
      labels: { style: { fontSize: '11px' }, rotate: -30 },
    },
    yaxis: {
      tickAmount: maxVal < 6 ? maxVal : undefined,
      labels: {
        formatter: (val) => val.toFixed(0),
      },
    },
    tooltip: { x: { show: true } },
    plotOptions: {
      bar: { borderRadius: 6, columnWidth: '55%' },
    },
    colors: ['#10b981'],
  });

  return (
    <Card>
      <CardHeader
        title={title}
        subheader={subheader}
        action={
          <ToggleButtonGroup
            value={view}
            exclusive
            onChange={(_, v) => { if (v) setView(v); }}
            size="small"
            sx={{ mr: 1 }}
          >
            <ToggleButton value="day" id="signup-toggle-day">7 days</ToggleButton>
            <ToggleButton value="month" id="signup-toggle-month">12 months</ToggleButton>
          </ToggleButtonGroup>
        }
      />
      <Box sx={{ p: 3, pb: 1 }}>
        <ReactApexChart
          type="bar"
          series={[{ name: 'New Signups', data: current.counts }]}
          options={chartOptions}
          height={240}
        />
      </Box>
    </Card>
  );
}
