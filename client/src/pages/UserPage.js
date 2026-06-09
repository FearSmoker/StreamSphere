import { Helmet } from 'react-helmet-async';
import { sentenceCase } from 'change-case';
import { useState, useEffect } from 'react';
// @mui
import {
  Card,
  Table,
  Stack,
  Paper,
  Avatar,
  Popover,
  TableRow,
  MenuItem,
  TableBody,
  TableCell,
  Container,
  Typography,
  IconButton,
  TableContainer,
  TablePagination,
  CircularProgress,
  Box,
} from '@mui/material';
// components
import Label from '../components/label';
import Iconify from '../components/iconify';
import Scrollbar from '../components/scrollbar';
// sections
import { UserListHead, UserListToolbar } from '../sections/@dashboard/user';
// utils
import Moment from 'react-moment';
import { api } from '../contexts/AuthContext';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'username', label: 'Username', alignRight: false },
  { id: 'email', label: 'Email', alignRight: false },
  { id: 'role', label: 'Role', alignRight: false },
  { id: 'createdAt', label: 'Joined Date', alignRight: false },
  { id: '' },
];

// ----------------------------------------------------------------------

export default function UserPage() {
  const [open, setOpen] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState('desc');
  const [orderBy, setOrderBy] = useState('createdAt');
  const [filterName, setFilterName] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const response = await api.get('/api/admin/users', {
          params: {
            page: page + 1,
            limit: rowsPerPage,
            search: filterName,
            sortField: orderBy,
            sortOrder: order === 'desc' ? -1 : 1,
          },
        });
        if (response.data && response.data.status === 'success') {
          setUsers(response.data.data.users || []);
          setTotalUsers(response.data.data.total || 0);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [page, rowsPerPage, filterName, order, orderBy, refreshKey]);

  const handleOpenMenu = (event, row) => {
    setOpen(event.currentTarget);
    setSelectedUser(row);
  };

  const handleCloseMenu = () => {
    setOpen(null);
    setSelectedUser(null);
  };

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setPage(0);
    setRowsPerPage(parseInt(event.target.value, 10));
  };

  const handleFilterByName = (event) => {
    setPage(0);
    setFilterName(event.target.value);
  };

  const handleToggleRole = async () => {
    if (!selectedUser) return;
    const newRole = selectedUser.role === 'admin' ? 'user' : 'admin';
    try {
      await api.put(`/api/admin/users/${selectedUser._id}/role`, { role: newRole });
      setRefreshKey((prev) => prev + 1);
      handleCloseMenu();
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('Failed to update user role');
    }
  };

  const isNotFound = !users.length && !!filterName;

  return (
    <>
      <Helmet>
        <title> User Management | StreamSphere </title>
      </Helmet>

      <Container>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={5}>
          <Typography variant="h4" gutterBottom>
            User Management
          </Typography>
        </Stack>

        <Card>
          <UserListToolbar numSelected={0} filterName={filterName} onFilterName={handleFilterByName} />

          <Scrollbar>
            <TableContainer sx={{ minWidth: 800 }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Table>
                  <UserListHead
                    order={order}
                    orderBy={orderBy}
                    headLabel={TABLE_HEAD}
                    rowCount={totalUsers}
                    numSelected={0}
                    onRequestSort={handleRequestSort}
                  />
                  <TableBody>
                    {users.map((row) => {
                      const { _id, username, email, role, createdAt, avatar } = row;

                      return (
                        <TableRow hover key={_id} tabIndex={-1}>
                          <TableCell padding="checkbox" />

                          <TableCell component="th" scope="row" padding="none">
                            <Stack direction="row" alignItems="center" spacing={2}>
                              <Avatar alt={username} src={avatar?.trim() ? avatar : 'https://res.cloudinary.com/desk6uyon/image/upload/v1780977340/streamsphere/avatars/avatar_1.jpg'} />
                              <Typography variant="subtitle2" noWrap>
                                {username}
                              </Typography>
                            </Stack>
                          </TableCell>

                          <TableCell align="left">{email}</TableCell>

                          <TableCell align="left">
                            <Label color={(role === 'admin' && 'error') || 'success'}>{sentenceCase(role)}</Label>
                          </TableCell>

                          <TableCell align="left">
                            <Moment format="DD/MM/YYYY hh:mm A">{createdAt}</Moment>
                          </TableCell>

                          <TableCell align="right">
                            <IconButton size="large" color="inherit" onClick={(event) => handleOpenMenu(event, row)}>
                              <Iconify icon={'eva:more-vertical-fill'} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>

                  {isNotFound && (
                    <TableBody>
                      <TableRow>
                        <TableCell align="center" colSpan={6} sx={{ py: 3 }}>
                          <Paper sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" paragraph>
                              Not found
                            </Typography>
                            <Typography variant="body2">
                              No results found for &nbsp;
                              <strong>&quot;{filterName}&quot;</strong>.
                              <br /> Try checking for typos or using complete words.
                            </Typography>
                          </Paper>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  )}
                </Table>
              )}
            </TableContainer>
          </Scrollbar>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalUsers}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Card>
      </Container>

      <Popover
        open={Boolean(open)}
        anchorEl={open}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            p: 1,
            width: 180,
            '& .MuiMenuItem-root': {
              px: 1,
              typography: 'body2',
              borderRadius: 0.75,
            },
          },
        }}
      >
        <MenuItem onClick={handleToggleRole}>
          <Iconify icon={'eva:shield-outline'} sx={{ mr: 2 }} />
          {selectedUser?.role === 'admin' ? 'Revoke Admin' : 'Grant Admin'}
        </MenuItem>
      </Popover>
    </>
  );
}
