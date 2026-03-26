function showLoginError(text) {
	const message = document.getElementById('message');
	message.innerText = text || 'Login failed';
	message.className = 'message error';
}

function togglePasswordVisibility(targetId, toggleButton) {
	const input = document.getElementById(targetId);

	if (!input) {
		return;
	}

	if (input.type === 'password') {
		input.type = 'text';
		toggleButton.classList.add('active');
	} else {
		input.type = 'password';
		toggleButton.classList.remove('active');
	}
}

async function parseResponse(response) {
	const text = await response.text();

	if (!text) {
		return {};
	}

	try {
		return JSON.parse(text);
	} catch (_err) {
		return { error: 'Server returned an invalid response' };
	}
}

async function loginUser(event) {
	event.preventDefault();

	const email = document.getElementById('email').value.trim();
	const password = document.getElementById('password').value;

	if (!email || !password) {
		showLoginError('Email and password are required');
		return;
	}

	try {
		const response = await fetch('/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password })
		});

		const data = await parseResponse(response);

		if (!response.ok || !data.success) {
			showLoginError(data.error || 'Invalid email or password');
			return;
		}

		const redirectTo = data.redirectTo || '/users-page';
		const name = encodeURIComponent(data.name || 'User');
		window.location.href = `${redirectTo}?name=${name}`;
	} catch (_err) {
		showLoginError('Server error. Please try again.');
	}
}

document.addEventListener('DOMContentLoaded', function () {
	const form = document.getElementById('loginForm');
	const toggles = document.querySelectorAll('.eye-button');
	form.addEventListener('submit', loginUser);

	toggles.forEach(function (toggleButton) {
		toggleButton.addEventListener('click', function () {
			togglePasswordVisibility(toggleButton.dataset.target, toggleButton);
		});
	});
});