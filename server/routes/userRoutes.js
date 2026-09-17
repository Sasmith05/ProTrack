const express = require('express');
const router = express.Router();

const userController = require('../controller/userController');
const dashboardController = require('../controller/dashboardController');
const profileController = require('../controller/profileController');
const taskController = require('../controller/taskController');
const notificationController = require('../controller/notificationController');
const searchController = require('../controller/searchController');
const activityController = require('../controller/activityController');
const reportController = require('../controller/reportController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// ─── Auth (public) ────────────────────────────────────────────────────────────
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.post('/logout', userController.logoutUser);

// ─── Dashboard (all authenticated roles) ─────────────────────────────────────
router.get('/api/dashboard/stats', authenticate, dashboardController.getStats);

// ─── Profile (all authenticated roles — own profile) ─────────────────────────
router.get('/profile', authenticate, profileController.getProfile);
router.get('/profile/edit', authenticate, profileController.getProfileEdit);
router.post('/profile/edit', authenticate, profileController.uploadAvatar, profileController.updateProfile);

// ─── Users CRUD (super_admin, admin only) ────────────────────────────────────
router.get('/users', authenticate, authorize('super_admin', 'admin'), userController.getUsers);
router.post('/users', authenticate, authorize('super_admin', 'admin'), userController.addUser);
router.put('/users/:id', authenticate, authorize('super_admin', 'admin'), userController.updateUser);
router.delete('/users/:id', authenticate, authorize('super_admin', 'admin'), userController.deleteUser);

// ─── Projects CRUD ────────────────────────────────────────────────────────────
router.get('/projects', authenticate, userController.getProjects);
router.post('/projects', authenticate, authorize('super_admin', 'admin', 'project_manager'), userController.addProject);
router.put('/projects/:id', authenticate, authorize('super_admin', 'admin', 'project_manager'), userController.updateProject);
router.delete('/projects/:id', authenticate, authorize('super_admin', 'admin', 'project_manager'), userController.deleteProject);

// ─── Tasks CRUD ───────────────────────────────────────────────────────────────
router.get('/tasks', authenticate, taskController.getTasks);
router.get('/tasks/calendar', authenticate, taskController.getTasksForCalendar);
router.get('/tasks/:id', authenticate, taskController.getTask);
router.post('/tasks', authenticate, authorize('super_admin', 'admin', 'project_manager'), taskController.addTask);
router.put('/tasks/:id', authenticate, authorize('super_admin', 'admin', 'project_manager'), taskController.updateTask);
router.delete('/tasks/:id', authenticate, authorize('super_admin', 'admin', 'project_manager'), taskController.deleteTask);
router.patch('/tasks/:id/status', authenticate, taskController.updateTaskStatus);

// ─── Task Attachments ─────────────────────────────────────────────────────────
// Wrap multer so upload errors (file type, size) are forwarded to the global error handler
const uploadWithErrorHandling = (req, res, next) => {
	taskController.uploadAttachmentMiddleware(req, res, (err) => {
		if (err) return next(err); // passes to global error handler in app.js
		next();
	});
};
router.post('/tasks/:id/attachments', authenticate, uploadWithErrorHandling, taskController.uploadAttachment);
router.delete('/tasks/:id/attachments/:aid', authenticate, taskController.deleteAttachment);

// ─── Task Comments ────────────────────────────────────────────────────────────
router.get('/tasks/:id/comments', authenticate, taskController.getComments);
router.post('/tasks/:id/comments', authenticate, taskController.addComment);
router.put('/tasks/:id/comments/:cid', authenticate, taskController.updateComment);
router.delete('/tasks/:id/comments/:cid', authenticate, taskController.deleteComment);

// ─── Notifications ────────────────────────────────────────────────────────────
router.get('/api/notifications', authenticate, notificationController.getNotifications);
// IMPORTANT: static 'read-all' must come BEFORE the dynamic ':id/read' route
router.patch('/api/notifications/read-all', authenticate, notificationController.markAllRead);
router.patch('/api/notifications/:id/read', authenticate, notificationController.markRead);

// ─── Global Search ────────────────────────────────────────────────────────────
router.get('/api/search', authenticate, searchController.globalSearch);

// ─── Activity Logs (admin only) ───────────────────────────────────────────────
router.get('/api/activity-logs', authenticate, authorize('super_admin', 'admin'), activityController.getLogs);

// ─── Reports (admin and above) ────────────────────────────────────────────────
router.get('/reports/projects/csv', authenticate, authorize('super_admin', 'admin', 'project_manager'), reportController.exportProjectsCsv);
router.get('/reports/projects/pdf', authenticate, authorize('super_admin', 'admin', 'project_manager'), reportController.exportProjectsPdf);
router.get('/reports/tasks/csv', authenticate, authorize('super_admin', 'admin', 'project_manager'), reportController.exportTasksCsv);
router.get('/reports/tasks/pdf', authenticate, authorize('super_admin', 'admin', 'project_manager'), reportController.exportTasksPdf);
router.get('/reports/users/csv', authenticate, authorize('super_admin', 'admin'), reportController.exportUsersCsv);
router.get('/reports/users/pdf', authenticate, authorize('super_admin', 'admin'), reportController.exportUsersPdf);

module.exports = router;