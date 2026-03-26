const express = require('express');
const userController = require('../controller/userController');
const router = express.Router();

// Auth
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);

// Dashboard users
router.get('/users', userController.getUsers);
router.post('/users', userController.addUser);
router.put('/users/:id', userController.updateUser);

// Dashboard projects
router.get('/projects', userController.getProjects);
router.post('/projects', userController.addProject);
router.put('/projects/:id', userController.updateProject);
router.delete('/projects/:id', userController.deleteProject);

module.exports = router;