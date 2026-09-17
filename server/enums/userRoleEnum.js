const UserRole = Object.freeze({
	SUPER_ADMIN: 'super_admin',
	ADMIN: 'admin',
	PROJECT_MANAGER: 'project_manager',
	EMPLOYEE: 'employee'
});

const USER_ROLE_VALUES = Object.freeze([
	UserRole.SUPER_ADMIN,
	UserRole.ADMIN,
	UserRole.PROJECT_MANAGER,
	UserRole.EMPLOYEE
]);

function normalizeUserRole(value) {
	if (typeof value !== 'string') {
		return UserRole.EMPLOYEE;
	}

	const normalized = value.trim().toLowerCase();
	return USER_ROLE_VALUES.includes(normalized) ? normalized : UserRole.EMPLOYEE;
}

module.exports = { UserRole, USER_ROLE_VALUES, normalizeUserRole };
