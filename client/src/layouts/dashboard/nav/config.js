// component
import SvgColor from "../../../components/svg-color";

// ----------------------------------------------------------------------

const icon = (name) => (
    <SvgColor
        src={`/assets/icons/navbar/${name}.svg`}
        sx={{ width: 1, height: 1 }}
    />
);

const navConfig = [
  {
    title: 'Home',
    path: '/videos',
    icon: icon('ic_home'),
  },
  {
    title: 'Dashboard',
    path: '/dashboard',
    icon: icon('ic_analytics'),
    adminOnly: true,
  },
  {
    title: 'Users',
    path: '/user',
    icon: icon('ic_user'),
    adminOnly: true,
  },
  {
    title: 'Upload Video',
    path: '/video-upload',
    icon: icon('ic_blog'),
    adminOnly: true,
  },
  {
    title: 'Video Library',
    path: '/video-list',
    icon: icon('ic_videos'),
    adminOnly: true,
  },
];

export default navConfig;
