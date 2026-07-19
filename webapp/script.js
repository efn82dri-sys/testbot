// ==========================================================
// منطق فرم پذیرش عضویت
// ==========================================================

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// اگر تم تلگرام تیره باشد هم صفحه خوانا بماند
document.documentElement.style.colorScheme = "light";

// ---------- لیست علایق (طبق درخواست کارفرما) ----------
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

// ---------- ساخت چیپ‌های علایق ----------
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
    if (selectedInterests.size >= MAX_INTERESTS) return; // سقف ۳ مورد
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

// ---------- ناوبری بین مراحل ----------
const steps = Array.from(document.querySelectorAll(".step"));
const totalSteps = steps.length;
let currentStep = 1;

const progressFill = document.getElementById("progressFill");
const stepLabel = document.getElementById("stepLabel");
const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");
const educationSelect = document.getElementById("education");

function showStep(n) {
  steps.forEach((s) => s.classList.toggle("active", Number(s.dataset.step) === n));
  progressFill.style.width = `${(n / totalSteps) * 100}%`;
  stepLabel.textContent = `مرحله ${toFarsiDigits(n)} از ${toFarsiDigits(totalSteps)}`;
  backBtn.style.visibility = n === 1 ? "hidden" : "visible";
  nextBtn.textContent = n === totalSteps ? "ثبت نهایی" : "ادامه";
  validateCurrentStep();
}

function toFarsiDigits(num) {
  const map = ["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];
  return String(num).replace(/\d/g, (d) => map[d]);
}

function validateCurrentStep() {
  let valid = false;
  if (currentStep === 1) {
    valid = !!educationSelect.value;
  } else if (currentStep === 2) {
    valid = !!document.querySelector('input[name="referral"]:checked');
  } else if (currentStep === 3) {
    valid = selectedInterests.size > 0;
  }
  nextBtn.disabled = !valid;
}

educationSelect.addEventListener("change", validateCurrentStep);
document.getElementById("referralList").addEventListener("change", validateCurrentStep);

backBtn.addEventListener("click", () => {
  if (currentStep > 1) {
    currentStep -= 1;
    showStep(currentStep);
  }
});

nextBtn.addEventListener("click", () => {
  if (nextBtn.disabled) return;
  if (currentStep < totalSteps) {
    currentStep += 1;
    showStep(currentStep);
  } else {
    submitForm();
  }
});

// ---------- ارسال نهایی داده به ربات ----------
function submitForm() {
  nextBtn.disabled = true;
  nextBtn.textContent = "در حال ارسال...";

  const referralEl = document.querySelector('input[name="referral"]:checked');

  const payload = {
    education: educationSelect.value,
    education_label: educationSelect.options[educationSelect.selectedIndex].text,
    referral: referralEl.value,
    interests: Array.from(selectedInterests),
  };

  // این خط، داده را برای ربات (main.py) می‌فرستد و WebApp را می‌بندد
  tg.sendData(JSON.stringify(payload));
  tg.close();
}

// شروع از مرحله ۱
showStep(currentStep);
