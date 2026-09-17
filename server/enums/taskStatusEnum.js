const TaskStatus = Object.freeze({
	TODO: 'todo',
	IN_PROGRESS: 'in_progress',
	REVIEW: 'review',
	COMPLETED: 'completed'
});

const TASK_STATUS_VALUES = Object.freeze([
	TaskStatus.TODO,
	TaskStatus.IN_PROGRESS,
	TaskStatus.REVIEW,
	TaskStatus.COMPLETED
]);

function normalizeTaskStatus(value) {
	if (typeof value !== 'string') return TaskStatus.TODO;
	const normalized = value.trim().toLowerCase();
	return TASK_STATUS_VALUES.includes(normalized) ? normalized : TaskStatus.TODO;
}

module.exports = { TaskStatus, TASK_STATUS_VALUES, normalizeTaskStatus };
