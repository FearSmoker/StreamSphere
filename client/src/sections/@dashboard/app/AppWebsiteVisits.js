import PropTypes from 'prop-types';
import ReactApexChart from 'react-apexcharts';
// @mui
import { Card, CardHeader, Box } from '@mui/material';
// components
import { useChart } from '../../../components/chart';

// ----------------------------------------------------------------------

AppWebsiteVisits.propTypes = {
  title: PropTypes.string,
  subheader: PropTypes.string,
  chartData: PropTypes.array.isRequired,
  chartLabels: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default function AppWebsiteVisits({ title, subheader, chartLabels, chartData, chartColors, chartType = 'line', ...other }) {
  const chartOptions = useChart({
    ...(chartColors && { colors: chartColors }),
    plotOptions: {
      bar: {
        columnWidth: '16%',
        ...(chartColors && { distributed: true }),
      },
    },
    fill: {
      type: chartType === 'bar' ? 'solid' : chartData.map((i) => i.fill || 'solid'),
      gradient: {
        type: 'vertical',
        shadeIntensity: 0,
        opacityFrom: chartType === 'bar' || chartColors ? 1 : 0.4,
        opacityTo: chartType === 'bar' || chartColors ? 1 : 0,
        stops: [0, 100],
      },
    },
    xaxis: { type: 'category', categories: chartLabels },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (y) => {
          if (typeof y !== 'undefined') {
            return `${y.toFixed(0)}`;
          }
          return y;
        },
      },
    },
  });

  return (
    <Card {...other} sx={{ display: 'flex', flexDirection: 'column', ...other.sx }}>
      <CardHeader title={title} subheader={subheader} />

      <Box sx={{ p: 3, pb: 1, flexGrow: 1 }} dir="ltr">
        <ReactApexChart type={chartType} series={chartData} options={chartOptions} height={364} />
      </Box>
    </Card>
  );
}
