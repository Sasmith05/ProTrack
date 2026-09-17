const TaskPriority = Object.freeze({
	LOW: 'low',
	MEDIUM: 'medium',
	HIGH: 'high',
	CRITICAL: 'critical'
});

const TASK_PRIORITY_VALUES = Object.freeze([
	TaskPriority.LOW,
	TaskPriority.MEDIUM,
	TaskPriority.HIGH,
	TaskPriority.CRITICAL
]);

function normalizeTaskPriority(value) {
	if (typeof value !== 'string') return TaskPriority.MEDIUM;
	const normalized = value.trim().toLowerCase();
	return TASK_PRIORITY_VALUES.includes(normalized) ? normalized : TaskPriority.MEDIUM;
}

module.exports = { TaskPriority, TASK_PRIORITY_VALUES, normalizeTaskPriority };
