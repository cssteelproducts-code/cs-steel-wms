import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  res => {
    if (res.data?.code === 'AUTH_EXPIRED') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return res;
  },
  err => Promise.reject(err)
);

// ==================== Auth ====================
export const authApi = {
  login:           (username, password) => api.post('/auth/login', { username, password }).then(r => r.data),
  logout:          ()                   => api.post('/auth/logout').then(r => r.data),
  getUsers:        ()                   => api.get('/auth/users').then(r => r.data),
  createUser:      (data)               => api.post('/auth/users/create', data).then(r => r.data),
  updateUser:      (data)               => api.post('/auth/users/update', data).then(r => r.data),
  deleteUser:      (targetUsername)     => api.post('/auth/users/delete', { targetUsername }).then(r => r.data),
  changePassword:  (data)               => api.post('/auth/change-password', data).then(r => r.data),
  resetPassword:   (data)               => api.post('/auth/reset-password', data).then(r => r.data),
};

// ==================== Trucks ====================
export const trucksApi = {
  getAll:          ()          => api.get('/trucks').then(r => r.data),
  getById:         (id)        => api.get(`/trucks/${id}`).then(r => r.data),
  search:          (q)         => api.get('/trucks/search', { params: { q } }).then(r => r.data),
  checkin:         (payload)   => api.post('/trucks/checkin', payload).then(r => r.data),
  datastation:     (data)      => api.post('/trucks/datastation', data).then(r => r.data),
  checkout:        (data)      => api.post('/trucks/checkout', data).then(r => r.data),
  stationExit:     (data)      => api.post('/trucks/station-exit', data).then(r => r.data),
  getStations:     (truckId)   => api.get(`/trucks/stations/${truckId}`).then(r => r.data),
  addStation:      (data)      => api.post('/trucks/station-add', data).then(r => r.data),
  recordEntry:     (stationId) => api.post('/trucks/station-entry', { stationId }).then(r => r.data),
  recordExitById:  (stationId) => api.post('/trucks/station-exit-by-id', { stationId }).then(r => r.data),
  getCompleted:    (from, to)  => api.get('/trucks', { params: { from, to } }).then(r => r.data),
};

// ==================== Dashboard ====================
export const dashboardApi = {
  getStats:      ()     => api.get('/dashboard').then(r => r.data),
  getSTDMonitor: ()     => api.get('/dashboard/stdmonitor').then(r => r.data),
};

// ==================== Tracking ====================
export const trackingApi = {
  getWarehouses: ()     => api.get('/tracking/warehouses').then(r => r.data),
  getVehicles:   ()     => api.get('/tracking/vehicles').then(r => r.data),
  updateVehicle: (data) => api.post('/tracking/update', data).then(r => r.data),
  getGps:        ()     => api.get('/tracking/gps').then(r => r.data),
  getGpsEta:     ()     => api.get('/tracking/gps-eta').then(r => r.data),
  saveWhMap:     (map)  => api.post('/tracking/wh-map', map).then(r => r.data),
};

// ==================== Utils/Config ====================
export const utilsApi = {
  getConfig:           ()     => api.get('/utils/config').then(r => r.data),
  saveRoleAccess:      (data) => api.post('/utils/config/role-access', { roleAccess: data }).then(r => r.data),
  saveStdMinutes:      (data) => api.post('/utils/config/std-minutes', { stdMinutes: data }).then(r => r.data),
  setLogoUrl:          (url)  => api.post('/utils/config/logo', { logoUrl: url }).then(r => r.data),
  saveMenuMaintenance: (data) => api.post('/utils/config/menu-maintenance', { maintenanceJson: data }).then(r => r.data),
  getDbInfo:           ()     => api.get('/utils/db-info').then(r => r.data),
};

// ==================== Fleet ====================
export const fleetApi = {
  getAll:            ()        => api.get('/fleet').then(r => r.data),
  getAvailable:      ()        => api.get('/fleet/available').then(r => r.data),
  add:               (data)    => api.post('/fleet/add', data).then(r => r.data),
  update:            (data)    => api.post('/fleet/update', data).then(r => r.data),
  setStatus:         (data)    => api.post('/fleet/status', data).then(r => r.data),
  delete:            (fleetId) => api.post('/fleet/delete', { fleetId }).then(r => r.data),
  getMaintenance:    (fleetId) => api.get(`/fleet/maintenance/${fleetId}`).then(r => r.data),
  addMaintenance:    (data)    => api.post('/fleet/maintenance/add', data).then(r => r.data),
  closeMaintenance:  (data)    => api.post('/fleet/maintenance/close', data).then(r => r.data),
};

// ==================== Orders ====================
export const ordersApi = {
  getAll:      (params) => api.get('/orders', { params }).then(r => r.data),
  getUnassigned: ()     => api.get('/orders/unassigned').then(r => r.data),
  getSuggestions: ()    => api.get('/orders/suggestions').then(r => r.data),
  add:         (data)   => api.post('/orders/add', data).then(r => r.data),
  update:      (data)   => api.post('/orders/update', data).then(r => r.data),
  cancel:      (orderId)=> api.post('/orders/cancel', { orderId }).then(r => r.data),
  delete:      (orderId)=> api.post('/orders/delete', { orderId }).then(r => r.data),
  bulk:        (orders) => api.post('/orders/bulk', { orders }).then(r => r.data),
};

// ==================== Employees ====================
export const employeesApi = {
  getAll:           ()       => api.get('/employees/list').then(r => r.data),
  add:              (data)   => api.post('/employees/add', data).then(r => r.data),
  update:           (data)   => api.post('/employees/update', data).then(r => r.data),
  delete:           (empId)  => api.post('/employees/delete', { empId }).then(r => r.data),
  getTripRates:     ()       => api.get('/employees/trip-rates').then(r => r.data),
  saveTripRates:    (rates)  => api.post('/employees/trip-rates/save', { rates }).then(r => r.data),
  getTripLogs:      (params) => api.get('/employees/trip-logs', { params }).then(r => r.data),
  saveTripLog:      (data)   => api.post('/employees/trip-logs/save', data).then(r => r.data),
  updateTripLog:    (data)   => api.post('/employees/trip-logs/update', data).then(r => r.data),
  deleteTripLog:    (logId)  => api.post('/employees/trip-logs/delete', { logId }).then(r => r.data),
  getTripReport:    (yearMonth) => api.get('/employees/trip-report', { params: { yearMonth } }).then(r => r.data),
};

// ==================== Items ====================
export const itemsApi = {
  getAll:   ()       => api.get('/items').then(r => r.data),
  getByCode:(code)   => api.get(`/items/${code}`).then(r => r.data),
  add:      (data)   => api.post('/items/add', data).then(r => r.data),
  update:   (data)   => api.post('/items/update', data).then(r => r.data),
  delete:   (itemCode) => api.post('/items/delete', { itemCode }).then(r => r.data),
};

// ==================== Customers ====================
export const customersApi = {
  getAll:     ()       => api.get('/customers').then(r => r.data),
  getByCode:  (arcode) => api.get(`/customers/${arcode}`).then(r => r.data),
  add:        (data)   => api.post('/customers/add', data).then(r => r.data),
  update:     (data)   => api.post('/customers/update', data).then(r => r.data),
  delete:     (arcode) => api.post('/customers/delete', { arcode }).then(r => r.data),
};

// ==================== Warehouse ====================
export const warehouseApi = {
  getLocations:    ()        => api.get('/warehouse/locations').then(r => r.data),
  addLocation:     (data)    => api.post('/warehouse/locations/add', data).then(r => r.data),
  updateLocation:  (data)    => api.post('/warehouse/locations/update', data).then(r => r.data),
  deleteLocation:  (locationId) => api.post('/warehouse/locations/delete', { locationId }).then(r => r.data),
  getSkus:         ()        => api.get('/warehouse/skus').then(r => r.data),
  addSku:          (data)    => api.post('/warehouse/skus/add', data).then(r => r.data),
  updateSku:       (data)    => api.post('/warehouse/skus/update', data).then(r => r.data),
  deleteSku:       (skuCode) => api.post('/warehouse/skus/delete', { skuCode }).then(r => r.data),
  getInventory:    (params)  => api.get('/warehouse/inventory', { params }).then(r => r.data),
  updateInventory: (data)    => api.post('/warehouse/inventory/update', data).then(r => r.data),
  getAudit:        (params)  => api.get('/warehouse/audit', { params }).then(r => r.data),
  addAudit:        (data)    => api.post('/warehouse/audit/add', data).then(r => r.data),
  getStockCount:   ()        => api.get('/warehouse/stock-count').then(r => r.data),
};

// ==================== Transfer ====================
export const transferApi = {
  getTasks:       (params)   => api.get('/transfer/tasks', { params }).then(r => r.data),
  getTask:        (taskId)   => api.get(`/transfer/tasks/${taskId}`).then(r => r.data),
  addTask:        (data)     => api.post('/transfer/tasks/add', data).then(r => r.data),
  updateTask:     (data)     => api.post('/transfer/tasks/update', data).then(r => r.data),
  startTask:      (data)     => api.post('/transfer/tasks/start', data).then(r => r.data),
  completeTask:   (data)     => api.post('/transfer/tasks/complete', data).then(r => r.data),
  cancelTask:     (taskId)   => api.post('/transfer/tasks/cancel', { taskId }).then(r => r.data),
  deleteTask:     (taskId)   => api.post('/transfer/tasks/delete', { taskId }).then(r => r.data),
  getVehicles:    ()         => api.get('/transfer/vehicles').then(r => r.data),
  addVehicle:     (data)     => api.post('/transfer/vehicles/add', data).then(r => r.data),
  updateVehicle:  (data)     => api.post('/transfer/vehicles/update', data).then(r => r.data),
  deleteVehicle:  (vehicleId)=> api.post('/transfer/vehicles/delete', { vehicleId }).then(r => r.data),
};

// ==================== Plans ====================
export const plansApi = {
  getAll:        (params)  => api.get('/plans', { params }).then(r => r.data),
  getById:       (planId)  => api.get(`/plans/${planId}`).then(r => r.data),
  add:           (data)    => api.post('/plans/add', data).then(r => r.data),
  update:        (data)    => api.post('/plans/update', data).then(r => r.data),
  confirm:       (planId)  => api.post('/plans/confirm', { planId }).then(r => r.data),
  startDelivery: (planId)  => api.post('/plans/start-delivery', { planId }).then(r => r.data),
  complete:      (planId)  => api.post('/plans/complete', { planId }).then(r => r.data),
  cancel:        (planId)  => api.post('/plans/cancel', { planId }).then(r => r.data),
  delete:        (planId)  => api.post('/plans/delete', { planId }).then(r => r.data),
  vrp:           (data)    => api.post('/plans/vrp', data).then(r => r.data),
  assignOrder:   (data)    => api.post('/plans/assign-order', data).then(r => r.data),
  removeOrder:   (data)    => api.post('/plans/remove-order', data).then(r => r.data),
};

// ==================== Transport Cost ====================
export const transportCostApi = {
  getSettings:    ()       => api.get('/transportcost/settings').then(r => r.data),
  saveSettings:   (settings) => api.post('/transportcost/settings/save', { settings }).then(r => r.data),
  calculate:      (data)   => api.post('/transportcost/calculate', data).then(r => r.data),
};

export default api;
