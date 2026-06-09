import PropTypes from 'prop-types';
import ReactApexChart from 'react-apexcharts';
// @mui
import { Card, CardHeader, Box } from '@mui/material';
// hooks
import { useChart } from '../../../components/chart';

// Helper functions
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Generate active user counts and labels for the last 7 days
function buildDauSeries(rawData) {
  const today = new Date();
  const labels = [];
  const counts = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    labels.push(`${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`);

    // Find matching record
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


AppDailyActiveUsers.propTypes = {
  title:    PropTypes.string,
  subheader: PropTypes.string,
  data:     PropTypes.array.isRequired,
};

export default function AppDailyActiveUsers({ title, subheader, data }) {
  const { labels, counts } = buildDauSeries(data);
  const maxVal = Math.max(...counts, 1);

  const chartOptions = useChart({
    xaxis: {
      categories: labels,
      labels: { style: { fontSize: '12px' } },
    },
    yaxis: {
      tickAmount: maxVal < 6 ? maxVal : undefined,
      labels: {
        formatter: (val) => val.toFixed(0),
      },
    },
    tooltip: {
      x: { show: true },
      marker: { show: true },
    },
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 100],
      },
    },
    colors: ['#6366f1'],
  });

  return (
    <Card>
      <CardHeader title={title} subheader={subheader} />
      <Box sx={{ p: 3, pb: 1 }}>
        <ReactApexChart
          type="area"
          series={[{ name: 'Active Users', data: counts }]}
          options={chartOptions}
          height={240}
        />
      </Box>
    </Card>
  );
}
