const UserStatus = Object.freeze({
	ACTIVE: "active",
	INACTIVE: "inactive"
});

const USER_STATUS_VALUES = Object.freeze([UserStatus.ACTIVE, UserStatus.INACTIVE]);

function normalizeUserStatus(value) {
	if (typeof value !== "string") {
		return UserStatus.INACTIVE;
	}

	const normalized = value.trim().toLowerCase();
	return USER_STATUS_VALUES.includes(normalized) ? normalized : UserStatus.INACTIVE;
}

module.exports = {
	UserStatus,
	USER_STATUS_VALUES,
	normalizeUserStatus
};
