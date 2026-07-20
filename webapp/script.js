// ==========================================================
// منطق فرم پذیرش عضویت با احراز هویت شماره تلفن
// ==========================================================

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

document.documentElement.style.colorScheme = "dark";
try {
  tg.setHeaderColor("#0c2a1a");
  tg.setBackgroundColor("#0c2a1a");
} catch (e) { /* ignore */ }

// ==========================================================
// ۰) پاپ‌آپ قوانین
// ==========================================================
const rulesOverlay = document.getElementById("rulesOverlay");
const agreeRow = document.getElementById("agreeRow");
const agreeBox = document.getElementById("agreeBox");
const rulesStartBtn = document.getElementById("rulesStartBtn");
const rulesCancelBtn = document.getElementById("rulesCancelBtn");

document.body.classList.add("rules-locked");
let rulesAgreed = false;

agreeRow.addEventListener("click", () => {
  rulesAgreed = !rulesAgreed;
  agreeRow.classList.toggle("checked", rulesAgreed);
  rulesStartBtn.disabled = !rulesAgreed;
});

rulesStartBtn.addEventListener("click", () => {
  if (!rulesAgreed) return;
  rulesOverlay.classList.add("hidden");
  document.body.classList.remove("rules-locked");
  showStep(0);
});

rulesCancelBtn.addEventListener("click", () => {
  tg.close();
});

tg.BackButton && tg.BackButton.hide();

// ==========================================================
// ۱) مدیریت شماره تلفن
// ==========================================================
let userPhone = null;
let phoneRequested = false;

// تابع برای ذخیره‌ی شماره در localStorage و حافظه
function setUserPhone(phone) {
  userPhone = phone;
  try {
    localStorage.setItem('roaq_phone', phone);
  } catch (e) {}
}

// تابع برای دریافت شماره از localStorage
function getStoredPhone() {
  try {
    return localStorage.getItem('roaq_phone');
  } catch (e) {
    return null;
  }
}

// بررسی شماره‌ی ذخیره‌شده در localStorage
const storedPhone = getStoredPhone();
if (storedPhone) {
  userPhone = storedPhone;
}

// بررسی پارامتر phone در URL (وقتی از چت برمی‌گردد)
const urlParams = new URLSearchParams(window.location.search);
const phoneParam = urlParams.get('phone');
if (phoneParam) {
  setUserPhone(phoneParam);
  // پاک کردن پارامتر از URL برای جلوگیری از تکرار
  window.history.replaceState({}, document.title, window.location.pathname);
}

// اگر شماره موجود باشد، مستقیماً به مرحله‌ی ۱ برو
const phoneStep = document.getElementById("phoneStep");
const requestPhoneBtn = document.getElementById("requestPhoneBtn");

async function requestPhoneNumber() {
  if (phoneRequested) return;
  phoneRequested = true;
  requestPhoneBtn.disabled = true;
  requestPhoneBtn.textContent = "⏳ در حال دریافت...";

  try {
    const contact = await tg.requestContact();
    if (contact && contact.phone_number) {
      setUserPhone(contact.phone_number);
      showStep(1);
      return;
    }
  } catch (e) {
    console.warn('requestContact failed:', e);
  }

  requestPhoneBtn.disabled = false;
  requestPhoneBtn.textContent = "📞 اشتراک‌گذاری شماره تلفن";
  phoneRequested = false;
  showAlternativePhoneMethod();
}

function showAlternativePhoneMethod() {
  const phoneStepContent = document.getElementById('phoneStep');
  phoneStepContent.innerHTML = `
    <h2>📱 احراز هویت با شماره تلفن</h2>
    <p class="hint" style="margin-bottom:16px;">
      برای تکمیل عضویت، لطفاً شماره تلفن خود را به اشتراک بگذارید.
    </p>
    <div style="display:flex;flex-direction:column;gap:12px;">
      <button type="button" class="btn-primary" id="altPhoneBtn" style="width:100%;padding:14px;font-size:16px;">
        📲 ارسال شماره در چت ربات
      </button>
      <button type="button" class="btn-secondary" id="retryPhoneBtn" style="width:100%;padding:14px;font-size:14px;">
        🔄 تلاش مجدد با روش سریع
      </button>
      <p style="font-size:12px;color:var(--text-secondary);margin-top:8px;">
        با کلیک روی دکمه‌ی بالا، به چت ربات می‌روید و شماره خود را با یک دکمه به اشتراک می‌گذارید. سپس به‌طور خودکار به این صفحه بازمی‌گردید.
      </p>
    </div>
  `;

  document.getElementById('altPhoneBtn').addEventListener('click', () => {
    // دریافت یوزرنیم ربات از initData
    const botUsername = tg.initDataUnsafe?.user?.username || 'YourBotUsername';
    tg.openTelegramLink(`https://t.me/${botUsername}?start=phone`);
  });

  document.getElementById('retryPhoneBtn').addEventListener('click', () => {
    // بازنشانی و تلاش مجدد با روش اول
    phoneStepContent.innerHTML = `
      <h2>📱 احراز هویت با شماره تلفن</h2>
      <p class="hint" style="margin-bottom:24px;">
        برای تکمیل عضویت، لطفاً شماره تلفن خود را با کلیک روی دکمه‌ی زیر به اشتراک بگذارید.
        <br><small>شماره‌ی شما فقط برای احراز هویت استفاده می‌شود و نزد ما محفوظ است.</small>
      </p>
      <button type="button" class="btn-primary" id="requestPhoneBtn" style="width:100%;padding:14px;font-size:16px;">
        📞 اشتراک‌گذاری شماره تلفن
      </button>
    `;
    document.getElementById('requestPhoneBtn').addEventListener('click', requestPhoneNumber);
    phoneRequested = false;
  });
}

// دکمه‌ی اصلی برای درخواست شماره
requestPhoneBtn.addEventListener('click', requestPhoneNumber);

// ==========================================================
// ۲) لیست علایق و منطق فرم
// ==========================================================
const INTERESTS = [
  "کافه معماری",
  "فرصت‌های شغلی و کارآموزی",
  "اتاق پرامپت",
  "پرزانته و پرتفولیو",
  "کتابخانه و ضوابط ملی",
  "رادیو معماری",
  "معماری جهان",
  "بانک پروژه",
  "فایل‌های گرافیکی و پست پرو",
  "دنیای نرم‌افزار و پلاگین",
  "آبجکت، فمیلی و متریال",
  "پلان و نقشه‌های اجرایی",
  "آکادمی آنلاین",
];
const MAX_INTERESTS = 3;

const interestsGrid = document.getElementById("interestsGrid");
const selectedInterests = new Set();

INTERESTS.forEach((label) => {
  const chip = document.createElement("div");
  chip.className = "chip";
  chip.textContent = label;
  chip.dataset.value = label;
  chip.addEventListener("click", () => toggleInterest(chip));
  interestsGrid.appendChild(chip);
});

function toggleInterest(chip) {
  const value = chip.dataset.value;
  if (selectedInterests.has(value)) {
    selectedInterests.delete(value);
    chip.classList.remove("selected");
  } else {
    if (selectedInterests.size >= MAX_INTERESTS) return;
    selectedInterests.add(value);
    chip.classList.add("selected");
  }
  refreshInterestLock();
  validateCurrentStep();
}

function refreshInterestLock() {
  const reachedLimit = selectedInterests.size >= MAX_INTERESTS;
  document.querySelectorAll(".chip").forEach((chip) => {
    const isSelected = chip.classList.contains("selected");
    chip.classList.toggle("disabled", reachedLimit && !isSelected);
  });
}

// ---------- مرحله ۱: مقطع تحصیلی ----------
let selectedEducation = null;
const educationList = document.getElementById("educationList");
educationList.querySelectorAll(".option-item").forEach((item) => {
  item.addEventListener("click", () => {
    educationList.querySelectorAll(".option-item").forEach(el => el.classList.remove("selected"));
    item.classList.add("selected");
    selectedEducation = { value: item.dataset.value, label: item.dataset.label };
    validateCurrentStep();
  });
});

// ---------- مرحله ۲: نحوه آشنایی ----------
let selectedReferral = null;
const referralList = document.getElementById("referralList");
referralList.querySelectorAll(".option-item").forEach((item) => {
  item.addEventListener("click", () => {
    referralList.querySelectorAll(".option-item").forEach(el => el.classList.remove("selected"));
    item.classList.add("selected");
    selectedReferral = item.dataset.value;
    validateCurrentStep();
  });
});

// ---------- ناوبری بین مراحل ----------
const steps = Array.from(document.querySelectorAll(".step"));
let currentStep = 0;

const progressLines = Array.from(document.querySelectorAll(".progress-line"));
const progressBarContainer = document.getElementById("progressBarContainer");
const stepLabel = document.getElementById("stepLabel");
const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");

const FORM_STEPS = 3;

function showStep(n) {
  steps.forEach((s) => s.classList.toggle("active", Number(s.dataset.step) === n));
  const isFormStep = n >= 1 && n <= FORM_STEPS;
  const isResultStep = n === 4;
  
  if (isFormStep) {
    progressBarContainer.style.display = "flex";
    stepLabel.style.display = "block";
    progressLines.forEach((line) => {
      line.classList.toggle("filled", Number(line.dataset.line) <= n);
    });
    stepLabel.textContent = `سوال ${toFarsiDigits(n)} از ${toFarsiDigits(FORM_STEPS)}`;
  } else {
    progressBarContainer.style.display = "none";
    stepLabel.style.display = "none";
  }

  backBtn.style.visibility = (n === 0 || n === 4) ? "hidden" : "visible";
  nextBtn.textContent = (n === FORM_STEPS) ? "ثبت و پیوستن" : "بعدی ←";
  
  if (n === 0) {
    nextBtn.disabled = true;
  } else if (isFormStep) {
    validateCurrentStep();
  }
}

function toFarsiDigits(num) {
  const map = ["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];
  return String(num).replace(/\d/g, (d) => map[d]);
}

function validateCurrentStep() {
  let valid = false;
  if (currentStep === 1) {
    valid = !!selectedEducation;
  } else if (currentStep === 2) {
    valid = !!selectedReferral;
  } else if (currentStep === 3) {
    valid = selectedInterests.size > 0;
  }
  nextBtn.disabled = !valid;
}

backBtn.addEventListener("click", () => {
  if (currentStep > 1) {
    currentStep -= 1;
    showStep(currentStep);
  }
});

nextBtn.addEventListener("click", () => {
  if (nextBtn.disabled) return;
  if (currentStep < FORM_STEPS) {
    currentStep += 1;
    showStep(currentStep);
  } else if (currentStep === FORM_STEPS) {
    submitForm();
  }
});

// ==========================================================
// ۳) ارسال نهایی فرم
// ==========================================================
const navButtons = document.getElementById("navButtons");
const resultBadge = document.getElementById("resultBadge");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");

// لینک دعوت گروه را از متغیر محیطی یا اینجا تنظیم کنید
const GROUP_INVITE_LINK = "https://t.me/+S04d2nabqShmZTJk";

async function submitForm() {
  // چک کردن شماره (اگر هنوز وجود نداشته باشد، از localStorage بخوان)
  if (!userPhone) {
    const stored = getStoredPhone();
    if (stored) {
      userPhone = stored;
    } else {
      tg.showPopup({
        title: "خطا",
        message: "شماره تلفن خود را به اشتراک نگذاشته‌اید. لطفاً دوباره تلاش کنید.",
        buttons: [{ type: "ok" }]
      });
      showStep(0);
      return;
    }
  }

  nextBtn.disabled = true;
  nextBtn.textContent = "⏳ در حال ارسال...";

  const formPayload = {
    education: selectedEducation.value,
    education_label: selectedEducation.label,
    referral: selectedReferral,
    interests: Array.from(selectedInterests),
    phone: userPhone,
  };

  currentStep = 4;
  showStep(4);
  navButtons.style.display = "none";

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initData: tg.initData,
        form: formPayload,
      }),
    });
    const data = await res.json();

    if (data.ok) {
      resultBadge.textContent = "✓";
      resultBadge.classList.remove("error");
      resultBadge.classList.add("celebrate");
      resultTitle.textContent = "🏛 عضویت‌ات به امضا رسید!";
      resultText.innerHTML = `
        هویت‌ات در این رواق ثبت شد.
        <br><br>
        برای ورود به گروه، روی دکمه‌ی زیر کلیک کن و پس از کلیک روی «عضویت»، به‌طور خودکار تایید می‌شوی.
        <br><br>
        <a href="${GROUP_INVITE_LINK}" target="_blank" style="display:inline-block;background:#c9a86c;color:#1a1e1a;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;margin-top:8px;">
          ورود به گروه
        </a>
      `;
      setTimeout(() => {
        tg.openLink(GROUP_INVITE_LINK);
      }, 2000);
    } else {
      throw new Error(data.error || "unknown");
    }
  } catch (err) {
    resultBadge.textContent = "!";
    resultBadge.classList.add("error");
    resultBadge.classList.remove("celebrate");
    resultTitle.textContent = "مشکلی پیش آمد";
    resultText.textContent = "متأسفانه در ثبتِ فرم مشکلی پیش آمد. لطفاً دوباره تلاش کن یا از طریقِ گروه با ادمین در میان بگذار.";
  }

  setTimeout(() => tg.close(), 5000);
}

// ==========================================================
// ۴) شروع برنامه
// ==========================================================
// اگر شماره از قبل وجود داشته باشد (localStorage یا پارامتر URL)، مرحله‌ی ۱ را نشان بده
if (userPhone) {
  setTimeout(() => showStep(1), 300);
} else {
  showStep(0);
}