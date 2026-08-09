
/* ================= V14.4 Access Password System ================= */
const DEFAULT_ACCESS_PASSWORD_HASH =
  "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";
const DEFAULT_ACCESS_PASSWORD_HINT = "6个数字";
const ACCESS_UNLOCK_SESSION_KEY = "loverLegendSalesSystemUnlocked";
const MOBILE_ACCESS_GRANTED_AT_KEY = "loverLegendSalesMobileAccessGrantedAt";
const MOBILE_ACCESS_VALID_MS = 8 * 60 * 60 * 1000;
const DESKTOP_SAVED_PASSWORD_KEY = "loverLegendSalesDesktopSavedPassword";
const BIOMETRIC_CREDENTIAL_KEY = "loverLegendSalesBiometricCredentialId";
const BIOMETRIC_USER_ID_KEY = "loverLegendSalesBiometricUserId";

let backendWarmupPromise = null;

function startBackendWarmup() {
  if (backendWarmupPromise || !window.LOVER_API_URL) return backendWarmupPromise;

  backendWarmupPromise = new Promise(resolve => {
    const callback = "ll_warm_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      try { delete window[callback]; } catch (error) {}
      script.remove();
      resolve(false);
    }, 6000);

    window[callback] = () => {
      clearTimeout(timer);
      try { delete window[callback]; } catch (error) {}
      script.remove();
      resolve(true);
    };

    script.onerror = () => {
      clearTimeout(timer);
      try { delete window[callback]; } catch (error) {}
      script.remove();
      resolve(false);
    };

    const query = new URLSearchParams({
      action: "warmup",
      callback,
      _ts: String(Date.now())
    });
    script.async = true;
    script.src = window.LOVER_API_URL + "?" + query.toString();
    (document.head || document.documentElement).appendChild(script);
  });

  window.LOVER_BACKEND_WARMUP_PROMISE = backendWarmupPromise;
  return backendWarmupPromise;
}

let accessPasswordSettings = {
  accessPasswordHash: DEFAULT_ACCESS_PASSWORD_HASH,
  accessPasswordHint: DEFAULT_ACCESS_PASSWORD_HINT
};

function bytesToBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function base64UrlToBytes(value) {
  const base64 = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
function randomBytes(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}
async function hashAccessPassword(password) {
  const data = new TextEncoder().encode(String(password || ""));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}
function buildAccessPasswordHint(password) {
  const chars = Array.from(String(password || ""));
  const letters = chars.filter(char => /[A-Za-z]/.test(char)).length;
  const numbers = chars.filter(char => /[0-9]/.test(char)).length;
  const symbols = chars.length - letters - numbers;
  const parts = [];
  if (letters) parts.push(`${letters}个英文字`);
  if (symbols) parts.push(`${symbols}个符号`);
  if (numbers) parts.push(`${numbers}个数字`);
  return parts.join(" ") || "密码提示暂不可用";
}
function getAccessPasswordSettings() {
  return {
    accessPasswordHash:
      accessPasswordSettings.accessPasswordHash ||
      DEFAULT_ACCESS_PASSWORD_HASH,
    accessPasswordHint:
      accessPasswordSettings.accessPasswordHint ||
      DEFAULT_ACCESS_PASSWORD_HINT
  };
}
function applyAccessPasswordSettings(settings) {
  if (!settings || typeof settings !== "object") return;
  accessPasswordSettings = {
    accessPasswordHash:
      String(settings.accessPasswordHash || DEFAULT_ACCESS_PASSWORD_HASH),
    accessPasswordHint:
      String(settings.accessPasswordHint || DEFAULT_ACCESS_PASSWORD_HINT)
  };
  localStorage.setItem(
    "lover_sales_access_settings_cache",
    JSON.stringify(accessPasswordSettings)
  );
  updatePasswordHintDisplays();
}
function loadCachedAccessPasswordSettings() {
  try {
    const cached = JSON.parse(
      localStorage.getItem("lover_sales_access_settings_cache") || "null"
    );
    if (cached) applyAccessPasswordSettings(cached);
  } catch (error) {}
}
function updatePasswordHintDisplays() {
  const hint = getAccessPasswordSettings().accessPasswordHint;
  const loginHint = document.getElementById("accessPasswordHint");
  const currentHint = document.getElementById("currentPasswordHint");
  if (loginHint) loginHint.textContent = `密码提示：${hint}`;
  if (currentHint) currentHint.textContent = `当前密码提示：${hint}`;
}
function isMobileOrTabletDevice() {
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}
async function isPlatformBiometricAvailable() {
  if (!isMobileOrTabletDevice()) return false;
  if (!window.isSecureContext ||
      !window.PublicKeyCredential ||
      !navigator.credentials) return false;
  try {
    return await PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (error) {
    return false;
  }
}
function hasDeviceBiometricCredential() {
  return Boolean(localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY));
}
async function registerDeviceBiometric() {
  if (!(await isPlatformBiometricAvailable())) {
    throw new Error("此手机不支持 Face ID / 生物辨识");
  }
  let userId = localStorage.getItem(BIOMETRIC_USER_ID_KEY);
  if (!userId) {
    userId = bytesToBase64Url(randomBytes(16));
    localStorage.setItem(BIOMETRIC_USER_ID_KEY, userId);
  }
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "Lover Legend Sales System" },
      user: {
        id: base64UrlToBytes(userId),
        name: "lover-legend-sales-user",
        displayName: "Lover Legend Sales"
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 }
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred"
      },
      timeout: 60000,
      attestation: "none"
    }
  });
  if (!credential) throw new Error("无法建立生物辨识");
  localStorage.setItem(
    BIOMETRIC_CREDENTIAL_KEY,
    bytesToBase64Url(new Uint8Array(credential.rawId))
  );
  await updateDeviceBiometricStatus();
  return true;
}
async function authenticateDeviceBiometric() {
  const stored = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
  if (!stored) throw new Error("尚未启用生物辨识");
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{
        type: "public-key",
        id: base64UrlToBytes(stored),
        transports: ["internal"]
      }],
      userVerification: "required",
      timeout: 60000
    }
  });
  return Boolean(assertion);
}
function clearDeviceBiometric() {
  localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
  localStorage.removeItem(BIOMETRIC_USER_ID_KEY);
}
async function updateDeviceBiometricStatus() {
  const status = document.getElementById("deviceBiometricStatus");
  const setup = document.getElementById("setupBiometricBtn");
  const remove = document.getElementById("removeBiometricBtn");
  const login = document.getElementById("biometricLoginBtn");
  const deviceText = document.getElementById("accessLockDeviceText");

  if (!isMobileOrTabletDevice()) {
    if (status) status.textContent = "电脑使用已储存密码登录";
    if (setup) setup.hidden = true;
    if (remove) remove.hidden = true;
    if (login) login.hidden = true;
    if (deviceText) deviceText.textContent =
      "电脑会记住系统密码，点击进入系统即可";
    return;
  }

  const available = await isPlatformBiometricAvailable();
  if (!available) {
    if (status) status.textContent = "此手机不支持";
    if (setup) setup.hidden = true;
    if (remove) remove.hidden = true;
    if (login) login.hidden = true;
    return;
  }

  const enabled = hasDeviceBiometricCredential();
  if (status) status.textContent = enabled ? "已启用" : "尚未启用";
  if (setup) setup.hidden = enabled;
  if (remove) remove.hidden = !enabled;
  if (login) login.hidden = !enabled;
}
function getMobileAccessGrantedAt() {
  const value = Number(
    localStorage.getItem(MOBILE_ACCESS_GRANTED_AT_KEY) || 0
  );
  return Number.isFinite(value) ? value : 0;
}
function isMobileAccessStillValid() {
  if (!isMobileOrTabletDevice()) return false;
  const grantedAt = getMobileAccessGrantedAt();
  if (!grantedAt) return false;
  const elapsed = Date.now() - grantedAt;
  return elapsed >= 0 && elapsed < MOBILE_ACCESS_VALID_MS;
}
function clearExpiredMobileAccess() {
  localStorage.removeItem(MOBILE_ACCESS_GRANTED_AT_KEY);
  sessionStorage.removeItem(ACCESS_UNLOCK_SESSION_KEY);
}
function recordAccessGrantedTime() {
  if (isMobileOrTabletDevice()) {
    localStorage.setItem(
      MOBILE_ACCESS_GRANTED_AT_KEY,
      String(Date.now())
    );
  }
}

function unlockAccessLock(options = {}) {
  sessionStorage.setItem(ACCESS_UNLOCK_SESSION_KEY, "1");

  if (options.refreshGrantedTime !== false) {
    recordAccessGrantedTime();
  }

  const lock = document.getElementById("accessLock");
  if (lock) lock.hidden = true;

  document.body.classList.remove("access-locked");
  document.documentElement.classList.add("access-ready");

  // V14.4: keep a replayable unlock flag. On desktop Refresh, access.js may
  // unlock before the business-script loader at the bottom of index.html exists.
  // The loader can now detect this flag and start exactly once.
  window.LOVER_SALES_UNLOCKED = true;
  window.dispatchEvent(new CustomEvent("lover-sales-unlocked"));

  requestAnimationFrame(() => {
    document.querySelectorAll("[data-deferred-src]").forEach(image => {
      if (!image.getAttribute("src")) {
        image.src = image.dataset.deferredSrc || "";
      }
    });
  });
}

async function tryBiometricLogin(manual = false) {
  const status = document.getElementById("biometricLoginStatus");
  try {
    if (status) status.textContent =
      "请点击系统提示，使用 Passkey / Face ID 确认...";
    const ok = await authenticateDeviceBiometric();
    if (ok) unlockAccessLock();
  } catch (error) {
    if (status) {
      status.textContent = manual
        ? "Passkey / Face ID 未完成，可重新点击或输入密码"
        : "已取消 Passkey，可输入密码或点击 Use Passkey 再试";
    }
  }
}
async function setupAccessLock() {
  loadCachedAccessPasswordSettings();
  updatePasswordHintDisplays();

  const lock = document.getElementById("accessLock");
  const form = document.getElementById("accessLockForm");
  const input = document.getElementById("accessPasswordInput");
  const hintButton = document.getElementById("showPasswordHintBtn");
  const hint = document.getElementById("accessPasswordHint");
  const status = document.getElementById("accessLockStatus");
  const biometricButton = document.getElementById("biometricLoginBtn");

  if (!lock || !form || !input) return;

  const sessionUnlocked =
    sessionStorage.getItem(ACCESS_UNLOCK_SESSION_KEY) === "1";

  if (isMobileOrTabletDevice()) {
    if (sessionUnlocked && isMobileAccessStillValid()) {
      // 同一个运行中的 App，8小时内直接进入，
      // 不打开 Passkey 画面。
      unlockAccessLock({
        refreshGrantedTime: false
      });
      return;
    }

    // Force Close 会清除 sessionStorage。
    // 即使仍在 8 小时内，也必须显示登录画面，
    // 让用户主动点击 Use Passkey / Face ID。
    sessionStorage.removeItem(
      ACCESS_UNLOCK_SESSION_KEY
    );

    if (!isMobileAccessStillValid()) {
      clearExpiredMobileAccess();
    }
  } else if (sessionUnlocked) {
    unlockAccessLock({
      refreshGrantedTime: false
    });
    return;
  }

  document.body.classList.add("access-locked");

  // Warm Google Apps Script while the user is entering the password.
  startBackendWarmup();

  if (!isMobileOrTabletDevice()) {
    input.value =
      localStorage.getItem(
        DESKTOP_SAVED_PASSWORD_KEY
      ) || "";

    requestAnimationFrame(() => {
      input.focus();
    });
  }

  hintButton?.addEventListener("click", () => {
    const showing = !hint.hidden;
    hint.hidden = showing;
    hintButton.textContent = showing
      ? "忘记密码？查看提示"
      : "隐藏密码提示";
  });

  biometricButton?.addEventListener("click", () =>
    tryBiometricLogin(true)
  );

  if (!form.dataset.accessBound) {
    form.dataset.accessBound = "1";
    form.addEventListener("submit", event => {
      event.preventDefault();
      event.stopPropagation();
      return false;
    });
  }

  const enterButton = form.querySelector('button[type="submit"]');

  if (!isMobileOrTabletDevice() &&
      input.value &&
      enterButton) {
    requestAnimationFrame(() => {
      enterButton.focus();
    });
  }

  const handlePasswordLogin = async event => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const password = String(input.value || "");
    if (!password) {
      status.textContent = "请输入密码";
      return;
    }
    const hash = await hashAccessPassword(password);
    if (hash !== getAccessPasswordSettings().accessPasswordHash) {
      status.textContent = "密码错误，可查看密码提示";
      input.select();
      return;
    }

    if (!isMobileOrTabletDevice()) {
      localStorage.setItem(DESKTOP_SAVED_PASSWORD_KEY, password);
    }
    status.textContent = "";
    unlockAccessLock();

    if (isMobileOrTabletDevice() &&
        await isPlatformBiometricAvailable() &&
        !hasDeviceBiometricCredential()) {
      try {
        await registerDeviceBiometric();
      } catch (error) {
        // 用户取消也不影响密码登录。
      }
    }
    return false;
  };

  if (enterButton && !enterButton.dataset.accessBound) {
    enterButton.dataset.accessBound = "1";
    enterButton.addEventListener("click", handlePasswordLogin);
  }

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      handlePasswordLogin(event);
    }
  });

  input.disabled = false;
  input.readOnly = false;

  // 立即允许电脑输入或点击，不等待任何网络请求。
  requestAnimationFrame(() => {
    if (!isMobileOrTabletDevice() &&
        !input.value) {
      input.focus();
    }
  });

  // 设备状态改为后台检查，不能阻塞密码输入。
  Promise.resolve()
    .then(() => updateDeviceBiometricStatus())
    .catch(() => {});

  // 使用本机缓存立即显示登录画面；云端密码设置在后台更新。
  if (typeof loadAccessSettingsFromSheet === "function") {
    Promise.race([
      loadAccessSettingsFromSheet(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("access settings timeout")), 7000)
      )
    ]).then(cloudSettings => {
      if (cloudSettings) applyAccessPasswordSettings(cloudSettings);
    }).catch(() => {});
  }

  // V14.4：手机需要重新认证且已启用 Passkey 时，
  // 自动打开系统原生 Sign in / Use Passkey 画面。
  // 用户只需要在系统画面点击一次 Use Passkey，
  // Face ID 成功后直接进入系统。
  if (
    isMobileOrTabletDevice() &&
    hasDeviceBiometricCredential()
  ) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.setTimeout(() => {
        tryBiometricLogin(false);
      }, 250);
    }));
  }
}
function setupPasswordChange() {
  const oldInput = document.getElementById("oldAccessPassword");
  const newInput = document.getElementById("newAccessPassword");
  const confirmInput = document.getElementById("confirmAccessPassword");
  const button = document.getElementById("changeAccessPasswordBtn");
  const status = document.getElementById("passwordChangeStatus");
  if (!button) return;

  button.addEventListener("click", async () => {
    const oldPassword = String(oldInput?.value || "");
    const newPassword = String(newInput?.value || "");
    const confirmPassword = String(confirmInput?.value || "");

    if (!oldPassword || !newPassword || !confirmPassword) {
      status.textContent =
        "请填写旧密码、新密码和确认密码";
      return;
    }
    if (Array.from(newPassword).length > 12) {
      status.textContent = "密码最多12个字";
      return;
    }
    if (newPassword !== confirmPassword) {
      status.textContent = "两次输入的新密码不一致";
      return;
    }
    if (
      await hashAccessPassword(oldPassword) !==
      getAccessPasswordSettings().accessPasswordHash
    ) {
      status.textContent = "旧密码不正确";
      return;
    }

    const newHash = await hashAccessPassword(newPassword);
    const newHint = buildAccessPasswordHint(newPassword);
    button.disabled = true;
    status.textContent =
      `密码已更改 · 提示：${newHint} · 正在同步`;

    try {
      const saved = await saveAccessSettingsToSheet({
        accessPasswordHash: newHash,
        accessPasswordHint: newHint
      });
      applyAccessPasswordSettings(saved || {
        accessPasswordHash: newHash,
        accessPasswordHint: newHint
      });

      if (!isMobileOrTabletDevice()) {
        localStorage.setItem(
          DESKTOP_SAVED_PASSWORD_KEY,
          newPassword
        );
      }

      oldInput.value = "";
      newInput.value = "";
      confirmInput.value = "";
      setTimeout(() => {
        status.textContent = "";
      }, 3000);
    } catch (error) {
      const message = String(error?.message || error || "");
      status.textContent = /Unknown action:\s*saveAccessSettings/i.test(message)
        ? "密码同步失败：Google Apps Script 仍是旧部署，请重新部署 V14.4 Code.gs"
        : "密码同步失败：" + message;
    } finally {
      button.disabled = false;
    }
  });
}
function setupDeviceBiometricSettings() {
  const setup = document.getElementById("setupBiometricBtn");
  const remove = document.getElementById("removeBiometricBtn");
  setup?.addEventListener("click", async () => {
    try {
      await registerDeviceBiometric();
      alert("此设备已启用 Face ID / 生物辨识登录");
    } catch (error) {
      alert(error.message || "生物辨识未完成");
    }
  });
  remove?.addEventListener("click", async () => {
    if (!confirm(
      "确认关闭此设备的 Face ID / 生物辨识登录？"
    )) return;
    clearDeviceBiometric();
    await updateDeviceBiometricStatus();
    alert("此设备已关闭生物辨识登录");
  });
  updateDeviceBiometricStatus();
}

/* ================= V14.4 Instant Login Bootstrap ================= */
// Run the access lock as soon as its small script is parsed. Business scripts,
// large images, Service Worker checks and cloud sync all start only after unlock.
setupAccessLock();

function finishAccessSettingsBootstrap() {
  setupPasswordChange();
  setupDeviceBiometricSettings();
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", finishAccessSettingsBootstrap, { once:true });
} else {
  finishAccessSettingsBootstrap();
}
