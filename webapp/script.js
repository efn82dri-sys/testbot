// ==========================================================
// منطق فرم پذیرش عضویت با احراز هویت شماره تلفن درون‌برنامه‌ای
// ==========================================================

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// تنظیم رنگ‌های مینی‌اپ
document.documentElement.style.colorScheme = "dark";
try {
  tg.setHeaderColor("#0c2a1a");
  tg.setBackgroundColor("#0c2a1a");
} catch (e) { /* ignore */ }

// ==========================================================
// ۰) پاپ‌آپ قوانین (قبلاً موجود)
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
  // بعد از پذیرش قوانین، مرحله‌ی شماره تلفن را نشان بده
  showStep(0);
});

rulesCancelBtn.addEventListener("click", () => {
  tg.close();
});

tg.BackButton && tg.BackButton.hide();

// ==========================================================
// ۱) درخواست شماره تلفن (مرحله ۰)
// ==========================================================
let userPhone = null;

const phoneStep = document.getElementById("phoneStep");
const requestPhoneBtn = document.getElementById("requestPhoneBtn");

requestPhoneBtn.addEventListener("click", async () => {
  try {
    // استفاده از متد رسمی تلگرام برای دریافت شماره
    const contact = await tg.requestContact();
    if (contact && contact.phone_number) {
      userPhone = contact.phone_number;
      // پس از دریافت شماره، به مرحله‌ی اول فرم برو
      showStep(1);
    } else {
      // کاربر انصراف داده یا شماره معتبر نیست
      tg.showPopup({
        title: "خطا",
        message: "برای ادامه، باید شماره تلفن خود را به اشتراک بگذارید.",
        buttons: [{ type: "ok" }]
      });
    }
  } catch (e) {
    // کاربر انصراف داده
    tg.showPopup({
      title: "اطلاع",
      message: "برای ادامه، اشتراک‌گذاری شماره ضروری است.",
      buttons: [{ type: "ok" }]
    });
  }
});

// ==========================================================
// ۲) لیست علایق و منطق فرم (همانند قبل)
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
let currentStep = 0; // 0 برای شماره، 1-3 برای فرم، 4 برای نتیجه

const progressLines = Array.from(document.querySelectorAll(".progress-line"));
const progressBarContainer = document.getElementById("progressBarContainer");
const stepLabel = document.getElementById("stepLabel");
const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");

const FORM_STEPS = 3; // 1,2,3

function showStep(n) {
  steps.forEach((s) => s.classList.toggle("active", Number(s.dataset.step) === n));
  const isFormStep = n >= 1 && n <= FORM_STEPS;
  const isResultStep = n === 4;
  
  // نمایش نوار پیشرفت فقط در مراحل فرم
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

  // دکمه‌ها
  backBtn.style.visibility = (n === 0 || n === 4) ? "hidden" : "visible";
  nextBtn.textContent = (n === FORM_STEPS) ? "ثبت و پیوستن" : "بعدی ←";
  
  // اگر مرحله ۰ (شماره) باشد، دکمه‌ی بعدی را غیرفعال می‌کنیم و خود کاربر با دکمه‌ی اختصاصی شماره را می‌فرستد
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
  if (currentStep > 1) { // از مرحله 1 به عقب نمی‌رویم (تا 0 نمی‌رویم)
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
// ۳) ارسال نهایی فرم به همراه شماره تلفن
// ==========================================================
const navButtons = document.getElementById("navButtons");
const resultBadge = document.getElementById("resultBadge");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");

async function submitForm() {
  if (!userPhone) {
    tg.showPopup({
      title: "خطا",
      message: "شماره تلفن خود را به اشتراک نگذاشته‌اید. لطفاً دوباره تلاش کنید.",
      buttons: [{ type: "ok" }]
    });
    return;
  }

  nextBtn.disabled = true;
  nextBtn.textContent = "⏳ در حال ارسال...";

  const formPayload = {
    education: selectedEducation.value,
    education_label: selectedEducation.label,
    referral: selectedReferral,
    interests: Array.from(selectedInterests),
    phone: userPhone, // ارسال شماره به بک‌اند
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
      // باز کردن خودکار لینک (با تاخیر تا کاربر پیام را ببیند)
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

  // مینی‌اپ بعد از ۵ ثانیه بسته می‌شود (کاربر می‌تواند زودتر ببندد)
  setTimeout(() => tg.close(), 5000);
}

// شروع از مرحله ۰ (شماره تلفن)؛ اما اگر شماره قبلاً ذخیره شده باشد (از قبل)، می‌توانیم مستقیم به مرحله ۱ برویم.
// برای سادگی، همیشه از مرحله ۰ شروع می‌کنیم.
showStep(0);