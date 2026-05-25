// Universal dispatcher สำหรับ GAS-style callServer calls
// POST /api/call { fn: string, args: any[] }
// Auth via Authorization: Bearer <token> header (same as other routes)
//
// ไม่ต้องแก้ route files เดิม — forward ผ่าน internal HTTP ไปยัง existing endpoints
const router = require('express').Router();
const http   = require('http');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
// FN_MAP: GAS function name → { method, path, body?, query? }
//   path  = string หรือ function(args) → string
//   body  = function(args) → object  (สำหรับ POST/PUT)
//   query = function(args) → object  (สำหรับ GET query string)
// ─────────────────────────────────────────────────────────────────────────────
const FN_MAP = {
  // ── Dashboard ──────────────────────────────────────────────────────────────
  getDashboardStats:              { method: 'GET',  path: '/api/dashboard' },
  getSTDMonitorData:              { method: 'GET',  path: '/api/dashboard/stdmonitor' },
  getBulkDeliveryData:            { method: 'GET',  path: '/api/dashboard/bulk' },
  getForecastData:                { method: 'GET',  path: '/api/dashboard/forecast' },

  // ── Trucks / Core operations ───────────────────────────────────────────────
  checkinTruck:                   { method: 'POST', path: '/api/trucks/checkin',
                                    body: a => a[0] || {} },
  searchTrucks:                   { method: 'GET',  path: '/api/trucks/search',
                                    query: a => ({ q: a[0] || '' }) },
  getCheckoutData:                { method: 'GET',  path: '/api/trucks' },
  recordDataStationTime:          { method: 'POST', path: '/api/trucks/datastation',
                                    body: a => ({ truckId: a[0], stationNames: a[1] }) },
  getStationsForTruck:            { method: 'GET',  path: a => '/api/trucks/stations/' + encodeURIComponent(a[0] || '') },
  recordEntryTime:                { method: 'POST', path: '/api/trucks/station-entry',
                                    body: a => ({ stationId: a[0] }) },
  recordExitTime:                 { method: 'POST', path: '/api/trucks/station-exit-by-id',
                                    body: a => ({ stationId: a[0] }) },
  addStation:                     { method: 'POST', path: '/api/trucks/station-add',
                                    body: a => ({ truckId: a[0], stationName: a[1] }) },
  checkoutTruck:                  { method: 'POST', path: '/api/trucks/checkout',
                                    body: a => ({ truckId: a[0], netWeight: a[1], checkoutTime: a[2], arcode: a[3], arname: a[4] }) },
  updateLicensePlate:             { method: 'POST', path: '/api/trucks/update-plate',
                                    body: a => ({ truckId: a[0], licensePlate: a[1] }) },
  updateNetWeight:                { method: 'POST', path: '/api/trucks/update-weight',
                                    body: a => ({ truckId: a[0], netWeight: a[1] }) },
  updateCustomer:                 { method: 'POST', path: '/api/trucks/update-customer',
                                    body: a => ({ truckId: a[0], arcode: a[1], arname: a[2] }) },
  getVehicleMonthReport:          { method: 'GET',  path: '/api/dashboard/month-report',
                                    query: a => ({ yearMonth: a[0] || '' }) },
  getCompletedTrucksByDateRange:  { method: 'GET',  path: '/api/trucks/range',
                                    query: a => ({ from: a[0] || '', to: a[1] || '' }) },
  deleteTruckRecord:              { method: 'POST', path: '/api/trucks/delete',
                                    body: a => ({ truckId: a[0] }) },

  // ── Customers ──────────────────────────────────────────────────────────────
  getAllCustomers:                 { method: 'GET',  path: '/api/customers' },
  deleteCustomerRecord:           { method: 'POST', path: '/api/customers/delete',
                                    body: a => ({ arcode: a[0] }) },

  // ── Auth / Users ───────────────────────────────────────────────────────────
  getUsers:                       { method: 'GET',  path: '/api/auth/users' },
  createUser:                     { method: 'POST', path: '/api/auth/users/create',
                                    body: a => ({ username: a[0], password: a[1], role: a[2], displayName: a[3] }) },
  adminResetPassword:             { method: 'POST', path: '/api/auth/admin-reset-password',
                                    body: a => ({ targetUsername: a[0], newPassword: a[1] }) },
  deleteUser:                     { method: 'POST', path: '/api/auth/users/delete',
                                    body: a => ({ targetUsername: a[0] }) },
  updateUser:                     { method: 'POST', path: '/api/auth/users/update',
                                    body: a => ({ targetUsername: a[0], newRole: a[1], newDisplayName: a[2], sessionHours: a[3] }) },
  addCustomRole:                  { method: 'POST', path: '/api/auth/roles/add',
                                    body: a => ({ name: a[0], parent: a[1] }) },
  editCustomRole:                 { method: 'POST', path: '/api/auth/roles/edit',
                                    body: a => ({ key: a[0], name: a[1] }) },
  deleteCustomRole:               { method: 'POST', path: '/api/auth/roles/delete',
                                    body: a => ({ key: a[0] }) },
  saveRoleAccess:                 { method: 'POST', path: '/api/utils/config/role-access',
                                    body: a => ({ roleAccess: a[0] }) },
  saveMenuMaintenance:            { method: 'POST', path: '/api/utils/config/menu-maintenance',
                                    body: a => ({ maintenanceJson: a[0] }) },

  // ── Utils ──────────────────────────────────────────────────────────────────
  getDbInfo:                      { method: 'GET',  path: '/api/utils/db-info' },
  warmData:                       { method: 'GET',  path: '/api/utils/config' },
  forceRefreshAllCaches:          { method: 'GET',  path: '/api/utils/config' },
  setLogoUrl:                     { method: 'POST', path: '/api/utils/config/logo',
                                    body: a => ({ logoUrl: a[0] || '' }) },
  saveSTDConfig:                  { method: 'POST', path: '/api/utils/config/std-minutes',
                                    body: a => ({ stdMinutes: a[0] }) },

  // ── Employees ──────────────────────────────────────────────────────────────
  getAllEmployees:                 { method: 'GET',  path: '/api/employees/list' },
  deleteEmployee:                 { method: 'POST', path: '/api/employees/delete',
                                    body: a => ({ empId: a[0] }) },
  getTripStdAll:                  { method: 'GET',  path: '/api/employees/trip-rates' },
  saveTripStdAll:                 { method: 'POST', path: '/api/employees/trip-rates/save',
                                    body: a => (a[0] || {}) },
  getDeliveredPlansForTripLog:    { method: 'GET',  path: '/api/employees/trip-logs',
                                    query: a => ({ yearMonth: a[0] || '' }) },
  deleteTripLog:                  { method: 'POST', path: '/api/employees/trip-logs/delete',
                                    body: a => ({ logId: a[0] }) },
  getTripReport:                  { method: 'GET',  path: '/api/employees/trip-report',
                                    query: a => ({ yearMonth: a[0] || '' }) },
  getTripExportData:              { method: 'GET',  path: '/api/employees/trip-report',
                                    query: a => ({ yearMonth: a[0] || '', export: '1' }) },

  // ── Items ──────────────────────────────────────────────────────────────────
  getAllItems:                     { method: 'GET',  path: '/api/items' },
  getItemByCode:                   { method: 'GET',  path: a => '/api/items/' + encodeURIComponent(a[0] || '') },
  deleteItem:                      { method: 'POST', path: '/api/items/delete',
                                     body: a => ({ itemCode: a[0] }) },

  // ── Fleet ──────────────────────────────────────────────────────────────────
  getFleet:                        { method: 'GET',  path: '/api/fleet' },
  getAvailableFleet:               { method: 'GET',  path: '/api/fleet/available' },
  addMaintenanceRecord:            { method: 'POST', path: '/api/fleet/maintenance/add',
                                     body: a => ({ fleetId: a[0], ...(a[1] || {}) }) },
  getMaintenanceRecords:           { method: 'GET',  path: a => '/api/fleet/maintenance/' + encodeURIComponent(a[0] || 'all') },
  closeMaintenanceRecord:          { method: 'POST', path: '/api/fleet/maintenance/close',
                                     body: a => ({ recordId: a[0], actualEndDate: a[1] }) },
  deleteFleetVehicle:              { method: 'POST', path: '/api/fleet/delete',
                                     body: a => ({ fleetId: a[0] }) },

  // ── Orders ─────────────────────────────────────────────────────────────────
  getOrders:                       { method: 'GET',  path: '/api/orders',
                                     query: a => (a[0] || {}) },
  getDeliveryCustomerSuggestions:  { method: 'GET',  path: '/api/orders/suggestions' },
  bulkAddOrders:                   { method: 'POST', path: '/api/orders/bulk',
                                     body: a => (a[0] || {}) },
  cancelOrder:                     { method: 'POST', path: '/api/orders/cancel',
                                     body: a => ({ orderId: a[0] }) },
  deleteOrder:                     { method: 'POST', path: '/api/orders/delete',
                                     body: a => ({ orderId: a[0] }) },

  // ── Plans ──────────────────────────────────────────────────────────────────
  getVRPSettings:                  { method: 'GET',  path: '/api/plans/vrp-settings' },
  saveVRPSettings:                 { method: 'POST', path: '/api/plans/vrp-settings',
                                     body: a => ({ settings: a[0] }) },
  getPlans:                        { method: 'GET',  path: '/api/plans',
                                     query: a => (a[0] || {}) },
  getPlanDetail:                   { method: 'GET',  path: a => '/api/plans/' + encodeURIComponent(a[0] || '') },
  updatePlan:                      { method: 'POST', path: '/api/plans/update',
                                     body: a => (a[0] || {}) },
  createManualPlan:                { method: 'POST', path: '/api/plans/add',
                                     body: a => (a[0] || {}) },
  runVRPOptimization:              { method: 'POST', path: '/api/plans/vrp',
                                     body: a => (a[0] || {}) },
  savePlan:                        { method: 'POST', path: '/api/plans/add',
                                     body: a => (a[0] || {}) },
  markPlanDelivered:               { method: 'POST', path: '/api/plans/complete',
                                     body: a => ({ planId: a[0] }) },
  cancelPlan:                      { method: 'POST', path: '/api/plans/cancel',
                                     body: a => ({ planId: a[0] }) },
  confirmPlan:                     { method: 'POST', path: '/api/plans/confirm',
                                     body: a => ({ planId: a[0] }) },
  getPlanExportData:               { method: 'GET',  path: a => '/api/plans/' + encodeURIComponent(a[0] || '') + '/export' },
  getConfirmedPlansToday:          { method: 'GET',  path: '/api/plans/confirmed-today' },
  getStationQueues:                { method: 'GET',  path: '/api/plans/station-queues' },
  getKpiReport:                    { method: 'GET',  path: '/api/plans/kpi-report',
                                     query: a => ({ month: a[0] || '' }) },
  exportKpiToSheet:                { method: 'GET',  path: '/api/plans/kpi-report',
                                     query: a => ({ month: a[0] || '', export: '1' }) },

  // ── Transport Cost ─────────────────────────────────────────────────────────
  getTransportCostSettings:        { method: 'GET',  path: '/api/transportcost/settings' },
  saveTransportCostSettings:       { method: 'POST', path: '/api/transportcost/settings/save',
                                     body: a => ({ settings: a[0] }) },
  geocodeZone:                     { method: 'POST', path: '/api/transportcost/geocode',
                                     body: a => ({ zone: a[0] }) },
  calculateTransportCost:          { method: 'POST', path: '/api/transportcost/calculate',
                                     body: a => (a[0] || {}) },

  // ── Transfer ───────────────────────────────────────────────────────────────
  getTransferMonitor:              { method: 'GET',  path: '/api/transfer/monitor',
                                     query: a => ({ date: a[0] || '' }) },
  getTransferDrivers:              { method: 'GET',  path: '/api/transfer/drivers' },
  assignTransferTask:              { method: 'POST', path: '/api/transfer/tasks/start',
                                     body: a => ({ taskId: a[0], assignedVehicle: a[1] }) },
  logTransferStationTime:          { method: 'POST', path: '/api/transfer/station-log',
                                     body: a => (a[0] || {}) },
  completeTransferTask:            { method: 'POST', path: '/api/transfer/tasks/complete',
                                     body: a => ({ taskId: a[0], actualQuantity: a[1] }) },
  cancelTransferTask:              { method: 'POST', path: '/api/transfer/tasks/cancel',
                                     body: a => ({ taskId: a[0] }) },
  createTransferTask:              { method: 'POST', path: '/api/transfer/tasks/add',
                                     body: a => (a[0] || {}) },
  getTransferTasks:                { method: 'GET',  path: '/api/transfer/tasks' },
  getTransferSettings:             { method: 'GET',  path: '/api/transfer/settings' },
  deleteTransferTask:              { method: 'POST', path: '/api/transfer/tasks/delete',
                                     body: a => ({ taskId: a[0] }) },
  getTransferVehicles:             { method: 'GET',  path: '/api/transfer/vehicles' },
  addTransferVehicle:              { method: 'POST', path: '/api/transfer/vehicles/add',
                                     body: a => (a[0] || {}) },
  saveTransferDrivers:             { method: 'POST', path: '/api/transfer/drivers/save',
                                     body: a => ({ drivers: a[0] }) },
  deleteTransferVehicle:           { method: 'POST', path: '/api/transfer/vehicles/delete',
                                     body: a => ({ vehicleId: a[0] }) },
  updateTransferVehicle:           { method: 'POST', path: '/api/transfer/vehicles/update',
                                     body: a => ({ vehicleId: a[0], ...(a[1] || {}) }) },
  setTransferVehicleStatus:        { method: 'POST', path: '/api/transfer/vehicles/status',
                                     body: a => ({ vehicleId: a[0], status: a[1] }) },
  getTransferReport:               { method: 'GET',  path: '/api/transfer/report',
                                     query: a => ({ month: a[0] || '' }) },
  saveTransferSettings:            { method: 'POST', path: '/api/transfer/settings',
                                     body: a => (a[0] || {}) },

  // ── Warehouse ──────────────────────────────────────────────────────────────
  refreshWarehouseCache:           { method: 'GET',  path: '/api/warehouse/master' },
  getAuditProgress:                { method: 'GET',  path: '/api/warehouse/audit/progress' },
  getWarehouseMasterData:          { method: 'GET',  path: '/api/warehouse/master' },
  submitAudit:                     { method: 'POST', path: '/api/warehouse/audit/add',
                                     body: a => (a[0] || {}) },
  deleteLocation:                  { method: 'POST', path: '/api/warehouse/locations/delete',
                                     body: a => ({ locationId: a[0] }) },
  deleteTypeSKU:                   { method: 'POST', path: '/api/warehouse/skus/delete',
                                     body: a => ({ skuCode: a[0] }) },
  importSystemStock:               { method: 'POST', path: '/api/warehouse/stock/import',
                                     body: a => ({ rows: a[0] }) },
  clearSystemStock:                { method: 'POST', path: '/api/warehouse/stock/clear' },
  getSystemStock:                  { method: 'GET',  path: '/api/warehouse/stock' },
  getImportDates:                  { method: 'GET',  path: '/api/warehouse/stock/import-dates' },
  addCountEntry:                   { method: 'POST', path: '/api/warehouse/count/add',
                                     body: a => (a[0] || {}) },
  getCountEntries:                 { method: 'GET',  path: '/api/warehouse/count',
                                     query: a => ({ date: a[0] || '' }) },
  deleteCountEntry:                { method: 'POST', path: '/api/warehouse/count/delete',
                                     body: a => ({ entryId: a[0] }) },
  processCount:                    { method: 'POST', path: '/api/warehouse/count/process',
                                     body: a => (a[0] || {}) },
  getCountResult:                  { method: 'GET',  path: '/api/warehouse/count/result',
                                     query: a => ({ date: a[0] || '' }) },
  updateCountResult:               { method: 'POST', path: '/api/warehouse/count/result/update',
                                     body: a => (a[0] || {}) },
  deleteCountResultRow:            { method: 'POST', path: '/api/warehouse/count/result/delete',
                                     body: a => ({ rowId: a[0] }) },
  getAdvancedAuditReport:          { method: 'GET',  path: '/api/warehouse/audit/report',
                                     query: a => ({ month: a[0] || '' }) },

  // ── Tracking / ETA ─────────────────────────────────────────────────────────
  getTrackingData:                 { method: 'GET',  path: '/api/tracking/all' },
  setVehicleWHMap:                 { method: 'POST', path: '/api/tracking/wh-map',
                                     body: a => (a[0] || {}) },
  upsertTrackingVehicle:           { method: 'POST', path: '/api/tracking/update',
                                     body: a => (a[0] || {}) },
  deleteTrackingVehicle:           { method: 'POST', path: '/api/tracking/vehicle-delete',
                                     body: a => ({ licensePlate: a[0] }) },
  saveWarehouses:                  { method: 'POST', path: '/api/tracking/warehouses-save',
                                     body: a => ({ warehouses: a[0] }) },

  // ── AI Chat ────────────────────────────────────────────────────────────────
  askAIChat:                       { method: 'POST', path: '/api/utils/ai-chat',
                                     body: a => ({ message: a[0] }) },
};

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { fn, args = [] } = req.body;
  if (!fn) return res.json({ success: false, message: 'fn is required', code: 'BAD_REQUEST' });

  const map = FN_MAP[fn];
  if (!map) {
    return res.json({ success: false, message: `ยังไม่ implement: ${fn}`, code: 'NOT_IMPLEMENTED' });
  }

  const port       = parseInt(process.env.PORT || '3001', 10);
  const pathStr    = typeof map.path === 'function' ? map.path(args) : map.path;
  let   queryStr   = '';

  if (map.query) {
    const params = map.query(args);
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
    ).toString();
    if (qs) queryStr = '?' + qs;
  }

  const fullPath   = pathStr + queryStr;
  const bodyObj    = map.body ? map.body(args) : null;
  const bodyStr    = bodyObj !== null ? JSON.stringify(bodyObj) : null;
  const authHeader = req.headers.authorization || '';

  try {
    const result = await _internalCall(port, map.method, fullPath, bodyStr, authHeader);
    return res.json(result);
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal HTTP helper — เรียก endpoint ของ server เอง
// ─────────────────────────────────────────────────────────────────────────────
function _internalCall(port, method, path, bodyStr, authHeader) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json', 'Authorization': authHeader };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const opts = { hostname: '127.0.0.1', port, path, method, headers };

    const req = http.request(opts, r => {
      let data = '';
      r.on('data', chunk => { data += chunk; });
      r.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ success: false, message: 'Invalid server response' }); }
      });
    });

    req.setTimeout(25000, () => { req.destroy(); reject(new Error('Internal request timeout')); });
    req.on('error', e => reject(e));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = router;
