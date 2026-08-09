// ==========================================================
// منطق فرم پذیرش عضویت
// ==========================================================

// ---------- محافظ در برابر لود نشدنِ SDK تلگرام ----------
// اگر فایل telegram-web-app.js از سایت تلگرام لود نشود (مثلاً به‌خاطر
// پروکسی/VPN ناپایدار)، window.Telegram اصلاً تعریف نمی‌شود. قبلاً در
// این حالت خط بعدی (window.Telegram.WebApp) با خطا کل اسکریپت را متوقف
// می‌کرد و کاربر فقط یک صفحه‌ی بی‌واکنش می‌دید — بدون هیچ توضیحی.
// حالا این حالت را صریحاً چک می‌کنیم و یک پیام روشن نشان می‌دهیم.
function showLoadError() {
  const overlay = document.getElementById("loadErrorOverlay");
  if (overlay) overlay.classList.remove("hidden");
  const retryBtn = document.getElementById("loadErrorRetryBtn");
  if (retryBtn) {
    retryBtn.addEventListener("click", () => window.location.reload());
  }
}

if (window.__tgSdkLoadFailed || !window.Telegram || !window.Telegram.WebApp) {
  showLoadError();
} else {
  initApp();
}

function initApp() {

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// این مینی‌اپ با تم تیره طراحی شده، پس صرف‌نظر از تم تلگرام کاربر
// همیشه هدر تلگرام را با پس‌زمینه‌ی خودمان هماهنگ می‌کنیم.
document.documentElement.style.colorScheme = "dark";
try {
  tg.setHeaderColor("#0c2a1a");
  tg.setBackgroundColor("#0c2a1a");
} catch (e) {
  /* در نسخه‌های قدیمی کلاینت تلگرام ممکن است این متدها نباشند */
}

// ==========================================================
// ۰) پاپ‌آپ آدابِ رواق — باید حتماً قبل از فرم تایید شود
// ==========================================================
const rulesOverlay = document.getElementById("rulesOverlay");
const agreeRow = document.getElementById("agreeRow");
const agreeBox = document.getElementById("agreeBox");
const rulesStartBtn = document.getElementById("rulesStartBtn");
const rulesCancelBtn = document.getElementById("rulesCancelBtn");

document.body.classList.add("rules-locked");
let rulesAgreed = false;

agreeRow.addEventListener("click", (e) => {
  // اگر کاربر روی لینک «مشاهده‌ی سیاست حریم خصوصی» زده، نباید تیک
  // موافقت toggle شود؛ باید بگذاریم لینک طبیعی خودش باز شود.
  if (e.target.closest("a")) return;
  rulesAgreed = !rulesAgreed;
  agreeRow.classList.toggle("checked", rulesAgreed);
  rulesStartBtn.disabled = !rulesAgreed;
});

rulesStartBtn.addEventListener("click", () => {
  if (!rulesAgreed) return;
  rulesOverlay.classList.add("hidden");
  document.body.classList.remove("rules-locked");
});

rulesCancelBtn.addEventListener("click", () => {
  // کاربر با آدابِ رواق موافقت نکرده؛ نمی‌تواند فرم را ادامه دهد
  tg.close();
});

// نمایش دکمه‌ی «بستن» تلگرام برای انصراف سریع، تا زمانی که پاپ‌آپ باز است
tg.BackButton && tg.BackButton.hide();

// ---------- لیست علایق (طبق درخواست کارفرما) ----------
const INTERESTS = [
  "اتاق پرامپت",
  "فرصت‌های شغلی",
  "پرزانته و پرتفولیو",
  "آکادمی آنلاین",
  "کتابخانه و ضوابط ملی",
  "رادیو معماری",
  "بانک پروژه",
  "معماری جهان",
  "فایل‌های گرافیکی",
  "دنیای نرم‌افزار و پلاگین",
  "آبجکت، فمیلی و متریال",
  "پلان و نقشه‌های اجرایی",
];
const MAX_INTERESTS = 3;

// ---------- ساخت چیپ‌های علایق ----------
const interestsGrid = document.getElementById("interestsGrid");
const interestsCountEl = document.getElementById("interestsCount");
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
    if (selectedInterests.size >= MAX_INTERESTS) return; // سقف ۳ مورد
    selectedInterests.add(value);
    chip.classList.add("selected");
  }
  refreshInterestLock();
  updateInterestsCount();
  validateCurrentStep();
}

function refreshInterestLock() {
  const reachedLimit = selectedInterests.size >= MAX_INTERESTS;
  document.querySelectorAll(".chip").forEach((chip) => {
    const isSelected = chip.classList.contains("selected");
    chip.classList.toggle("disabled", reachedLimit && !isSelected);
  });
}

function updateInterestsCount() {
  if (interestsCountEl) {
    interestsCountEl.textContent = `${toFarsiDigits(selectedInterests.size)} از ${toFarsiDigits(MAX_INTERESTS)}`;
  }
}

// ---------- مرحله ۱: مقطع تحصیلی (کارت‌های تک‌انتخابی) ----------
let selectedEducation = null; // { value, label }
const educationList = document.getElementById("educationList");

educationList.querySelectorAll(".option-item").forEach((item) => {
  item.addEventListener("click", () => {
    educationList.querySelectorAll(".option-item").forEach((el) => el.classList.remove("selected"));
    item.classList.add("selected");
    selectedEducation = { value: item.dataset.value, label: item.dataset.label };
    validateCurrentStep();
  });
});

// ---------- مرحله ۲: نحوه آشنایی (کارت‌های تک‌انتخابی) ----------
let selectedReferral = null;
const referralList = document.getElementById("referralList");

referralList.querySelectorAll(".option-item").forEach((item) => {
  item.addEventListener("click", () => {
    referralList.querySelectorAll(".option-item").forEach((el) => el.classList.remove("selected"));
    item.classList.add("selected");
    selectedReferral = item.dataset.value;
    validateCurrentStep();
  });
});

// ---------- ناوبری بین مراحل ----------
const steps = Array.from(document.querySelectorAll(".step"));
let currentStep = 1;

const progressLines = Array.from(document.querySelectorAll(".progress-line"));
const progressBarContainer = document.getElementById("progressBarContainer");
const stepLabel = document.getElementById("stepLabel");
const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");

const FORM_STEPS = 3; // مرحله ۴ صفحه‌ی نتیجه است، نه یک قدم فرم

function showStep(n) {
  steps.forEach((s) => s.classList.toggle("active", Number(s.dataset.step) === n));
  const isResultStep = n > FORM_STEPS;
  progressBarContainer.style.display = isResultStep ? "none" : "flex";
  stepLabel.style.display = isResultStep ? "none" : "block";
  if (!isResultStep) {
    progressLines.forEach((line) => {
      line.classList.toggle("filled", Number(line.dataset.line) <= n);
    });
    stepLabel.textContent = `سوال ${toFarsiDigits(n)} از ${toFarsiDigits(FORM_STEPS)}`;
  }
  backBtn.style.visibility = n === 1 ? "hidden" : "visible";
  nextBtn.textContent = n === FORM_STEPS ? "ثبت و پیوستن" : "بعدی ←";
  if (!isResultStep) validateCurrentStep();
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
  } else {
    submitForm();
  }
});

// ---------- ارسال نهایی داده به سرور ----------
// نکته: تابع tg.sendData فقط برای مینی‌اپ‌هایی کار می‌کند که از
// «Keyboard Button» باز شده باشند. چون این مینی‌اپ از دکمه‌ی زیر پیام
// (Inline Button) باز می‌شود، داده را با fetch مستقیم به بک‌اند خودمان
// می‌فرستیم و tg.initData را هم همراهش می‌فرستیم تا هویت کاربر تایید شود.
const navButtons = document.getElementById("navButtons");
const resultBadge = document.getElementById("resultBadge");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const resultRetryBtn = document.getElementById("resultRetryBtn");

function showResultSpinner() {
  resultBadge.innerHTML = '<span class="spinner"></span>';
  resultBadge.classList.remove("error", "celebrate");
  resultTitle.textContent = "در حال بررسی...";
  resultText.textContent = "لطفاً چند لحظه صبر کنید.";
  resultRetryBtn.classList.add("hidden");
}

async function submitForm() {
  nextBtn.disabled = true;

  const formPayload = {
    education: selectedEducation.value,
    education_label: selectedEducation.label,
    referral: selectedReferral,
    interests: Array.from(selectedInterests),
  };

  currentStep = 4;
  showStep(4);
  navButtons.style.display = "none";
  showResultSpinner(); // چرخِ لودینگ تا وقتی جواب سرور برسد نمایش داده می‌شود

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
      resultBadge.innerHTML = "✓";
      resultBadge.classList.remove("error");
      resultBadge.classList.add("celebrate");
      resultTitle.textContent = "🏛 عضویت‌ات به امضا رسید!";
      resultText.textContent = "هویت‌ات در این رواق ثبت شد. همین حالا می‌توانی به گروه برگردی و فایل‌ها را ورق بزنی — درگاه، به رویِ تو گشوده شد.";
      setTimeout(() => tg.close(), 2600);
    } else {
      throw new Error(data.error || "unknown");
    }
  } catch (err) {
    resultBadge.innerHTML = "!";
    resultBadge.classList.add("error");
    resultBadge.classList.remove("celebrate");
    resultTitle.textContent = "مشکلی پیش آمد";
    resultText.textContent = "متأسفانه در ثبتِ فرم مشکلی پیش آمد. لطفاً دوباره تلاش کن یا از طریقِ گروه با ادمین در میان بگذار.";
    // به‌جای بستن خودکارِ اپ، به کاربر امکان تلاش مجدد می‌دهیم — ممکن
    // است خطا موقتی (مثلاً قطعی لحظه‌ای شبکه) بوده باشد.
    resultRetryBtn.classList.remove("hidden");
  }
}

resultRetryBtn.addEventListener("click", () => {
  submitForm();
});

// شروع از مرحله ۱
updateInterestsCount();
showStep(currentStep);

} // پایان initApp