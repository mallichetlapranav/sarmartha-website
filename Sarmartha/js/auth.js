async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

function setStatus(element, message, isError = false) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.toggle("error", isError);
}

async function handleSignup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById("signup-status");
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;

  if (password !== confirmPassword) {
    setStatus(status, "Passwords do not match.", true);
    return;
  }

  try {
    setStatus(status, "Creating your account...");
    await postJson("/api/signup", { name, email, password });
    setStatus(status, "Account created successfully. Redirecting to login...");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 900);
  } catch (error) {
    setStatus(status, error.message, true);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById("login-status");
  const email = form.email.value.trim();
  const password = form.password.value;

  try {
    setStatus(status, "Checking your details...");
    const result = await postJson("/api/login", { email, password });
    localStorage.setItem("sarmartha-user", JSON.stringify(result.user));
    setStatus(status, "Login successful. Redirecting...");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 900);
  } catch (error) {
    setStatus(status, error.message, true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");

  if (signupForm) {
    signupForm.addEventListener("submit", handleSignup);
  }

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }
});
