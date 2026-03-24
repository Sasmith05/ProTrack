async function registerUser(event) {
    event.preventDefault();

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!firstName || !lastName || !phone || !email || !password || !confirmPassword) {
        showPopup('Missing Details', 'All fields are required.', false);
        return;
    }

    if (!validatePassword(password, confirmPassword)) {
        showPopup('Password Error', 'Passwords do not match.', false);
        return;
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
        showPopup('Weak Password', passwordValidation.message, false);
        return;
    }

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, phone, email, password })
        });

        const data = await parseResponse(response);

        if (!response.ok || !data.success) {
            showPopup('Registration Failed', data.error || 'Please try again.', false);
            return;
        }

        showPopup('Registration Successful', 'Your account has been created.', true);
    } catch (_err) {
        showPopup('Registration Failed', 'Server error. Please try again.', false);
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

function validatePassword(password, confirmPassword) {
    return password === confirmPassword;
}

function validatePasswordStrength(password) {
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    if (hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSymbol) {
        return { valid: true, message: "" };
    }

    return {
        valid: false,
        message: "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol."
    };
}

function updatePasswordHint() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const hint = document.getElementById('passwordMatchHint');

    if (!hint) {
        return;
    }

    if (!password) {
        hint.textContent = 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.';
        hint.className = 'field-error';
        return;
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
        hint.textContent = passwordValidation.message;
        hint.className = 'field-error';
        return;
    }

    if (!confirmPassword) {
        hint.textContent = 'Strong password. Please confirm password.';
        hint.className = 'field-error success';
        return;
    }

    if (password === confirmPassword) {
        hint.textContent = 'Passwords match';
        hint.className = 'field-error success';
    } else {
        hint.textContent = 'Passwords do not match';
        hint.className = 'field-error';
    }
}

function showPopup(title, text, shouldRedirect) {
    const popup = document.getElementById('successPopup');
    const popupTitle = document.getElementById('popupTitle');
    const popupText = document.getElementById('popupText');
    const okButton = document.getElementById('popupOkButton');

    popupTitle.textContent = title;
    popupText.textContent = text;
    okButton.dataset.redirect = shouldRedirect ? '1' : '0';
    popup.classList.remove('hidden');
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

document.addEventListener("DOMContentLoaded", function () {
    if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
    }

    const form = document.getElementById('registerForm');
    const popup = document.getElementById('successPopup');
    const popupOkButton = document.getElementById('popupOkButton');
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    const toggles = document.querySelectorAll('.eye-button');

    form.addEventListener('submit', registerUser);

    popupOkButton.addEventListener("click", function () {
        popup.classList.add('hidden');

        if (popupOkButton.dataset.redirect === '1') {
            window.location.href = '/login';
        }
    });

    password.addEventListener("input", updatePasswordHint);
    confirmPassword.addEventListener("input", updatePasswordHint);

    toggles.forEach(function (toggleButton) {
        toggleButton.addEventListener("click", function () {
            togglePasswordVisibility(toggleButton.dataset.target, toggleButton);
        });
    });
});