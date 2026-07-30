(() => {
  "use strict";

  const PASSWORD_KEY = "lover_sales_password_hash_v74";
  const SESSION_KEY = "lover_sales_session_v74";
  const AUTO_LOGIN_KEY = "lover_sales_auto_login_v74";
  const CREDENTIAL_KEY = "lover_sales_webauthn_credential_v74";
  const DEFAULT_PASSWORD = "123456";

  const encoder = new TextEncoder();

  function bytesToBase64Url(bytes) {
    let binary = "";
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToBytes(value) {
    const base64 = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, ch => ch.charCodeAt(0));
  }

  async function hashPassword(password) {
    if (crypto.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", encoder.encode(password));
      return bytesToBase64Url(new Uint8Array(digest));
    }
    return btoa(unescape(encodeURIComponent(password)));
  }

  async function ensurePassword() {
    if (!localStorage.getItem(PASSWORD_KEY)) {
      localStorage.setItem(PASSWORD_KEY, await hashPassword(DEFAULT_PASSWORD));
    }
  }

  async function verifyPassword(password) {
    await ensurePassword();
    return (await hashPassword(password)) === localStorage.getItem(PASSWORD_KEY);
  }

  function showMessage(id, text, ok = false) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.remove("hidden", "success");
    if (ok) el.classList.add("success");
  }

  function unlock() {
    sessionStorage.setItem(SESSION_KEY, "1");
    localStorage.setItem(AUTO_LOGIN_KEY, "1");
    document.body.classList.remove("auth-locked");
    document.getElementById("authGate")?.classList.add("hidden");
  }

  function lock() {
    document.body.classList.add("auth-locked");
    document.getElementById("authGate")?.classList.remove("hidden");
  }

  function isLoggedIn() {
    return sessionStorage.getItem(SESSION_KEY) === "1" || localStorage.getItem(AUTO_LOGIN_KEY) === "1";
  }

  async function loginWithPassword(event) {
    event.preventDefault();
    const input = document.getElementById("loginPassword");
    const password = input.value;
    if (!password) return showMessage("loginMessage", "请输入密码");
    if (password.length > 12) return showMessage("loginMessage", "密码最长 12 字");
    if (!(await verifyPassword(password))) return showMessage("loginMessage", "密码错误");
    input.value = "";
    unlock();
  }

  async function webAuthnSupported() {
    if (!window.PublicKeyCredential || !navigator.credentials || !window.isSecureContext) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (_) {
      return false;
    }
  }

  async function registerBiometric() {
    if (!(await webAuthnSupported())) {
      alert("此设备或浏览器不支持 Face ID、Touch ID、Windows Hello 或 Android 指纹，或网页不是 HTTPS。 ");
      return;
    }
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Lover Legend Sales", id: location.hostname },
          user: { id: userId, name: "lover-sales", displayName: "Lover Legend Sales" },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 }
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            residentKey: "preferred",
            userVerification: "required"
          },
          timeout: 60000,
          attestation: "none"
        }
      });
      if (!credential) throw new Error("没有建立凭证");
      localStorage.setItem(CREDENTIAL_KEY, bytesToBase64Url(new Uint8Array(credential.rawId)));
      alert("生物识别已注册。以后可使用 Face ID、Touch ID、Windows Hello 或 Android 指纹登录。");
      updateBiometricButton();
    } catch (err) {
      if (err.name !== "NotAllowedError") alert("注册失败：" + (err.message || err));
    }
  }

  async function biometricLogin(silent = false) {
    const savedId = localStorage.getItem(CREDENTIAL_KEY);
    if (!savedId || !(await webAuthnSupported())) return false;
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type: "public-key", id: base64UrlToBytes(savedId), transports: ["internal"] }],
          userVerification: "required",
          timeout: silent ? 15000 : 60000
        },
        mediation: silent ? "optional" : undefined
      });
      if (!assertion) return false;
      unlock();
      return true;
    } catch (err) {
      if (!silent && err.name !== "NotAllowedError") showMessage("loginMessage", "生物识别登录失败");
      return false;
    }
  }

  async function updateBiometricButton() {
    const btn = document.getElementById("biometricLoginBtn");
    if (!btn) return;
    const enabled = Boolean(localStorage.getItem(CREDENTIAL_KEY)) && await webAuthnSupported();
    btn.classList.toggle("hidden", !enabled);
  }

  function openPasswordDialog() {
    const dialog = document.getElementById("passwordDialog");
    document.getElementById("passwordForm")?.reset();
    document.getElementById("passwordMessage")?.classList.add("hidden");
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute("open", "");
  }

  function closePasswordDialog() {
    const dialog = document.getElementById("passwordDialog");
    if (dialog?.close) dialog.close();
    else dialog?.removeAttribute("open");
  }

  async function changePassword(event) {
    event.preventDefault();
    const oldPassword = document.getElementById("oldPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    if (!(await verifyPassword(oldPassword))) return showMessage("passwordMessage", "旧密码错误");
    if (!newPassword) return showMessage("passwordMessage", "请输入新密码");
    if (newPassword.length > 12) return showMessage("passwordMessage", "新密码最长 12 字");
    if (newPassword !== confirmPassword) return showMessage("passwordMessage", "两次新密码不一致");
    if (oldPassword === newPassword) return showMessage("passwordMessage", "新密码不能和旧密码相同");
    localStorage.setItem(PASSWORD_KEY, await hashPassword(newPassword));
    showMessage("passwordMessage", "密码已更改", true);
    setTimeout(closePasswordDialog, 700);
  }

  function logoutSalesSystem() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(AUTO_LOGIN_KEY);
    lock();
    document.getElementById("loginPassword")?.focus();
  }

  async function init() {
    await ensurePassword();
    document.getElementById("loginForm")?.addEventListener("submit", loginWithPassword);
    document.getElementById("passwordForm")?.addEventListener("submit", changePassword);
    document.getElementById("biometricLoginBtn")?.addEventListener("click", () => biometricLogin(false));
    await updateBiometricButton();
    if (isLoggedIn()) {
      unlock();
    } else {
      lock();
      if (localStorage.getItem(CREDENTIAL_KEY)) biometricLogin(true);
    }
  }

  window.openPasswordDialog = openPasswordDialog;
  window.closePasswordDialog = closePasswordDialog;
  window.registerBiometric = registerBiometric;
  window.logoutSalesSystem = logoutSalesSystem;
  window.biometricLogin = biometricLogin;

  document.addEventListener("DOMContentLoaded", init);
})();
