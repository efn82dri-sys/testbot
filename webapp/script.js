// ==========================================================
// منطق فرم پذیرش عضویت
// ==========================================================

// ----------------------------------------------------------
// STEP 0: بررسی در دسترس بودن Telegram WebApp
// ----------------------------------------------------------
let tg = null;
try {
    tg = window.Telegram?.WebApp;
    if (!tg) throw new Error('Telegram WebApp not available');
    tg.ready();
    tg.expand();
    document.documentElement.style.colorScheme = "dark";
    try {
        tg.setHeaderColor("#0c2a1a");
        tg.setBackgroundColor("#0c2a1a");
    } catch (e) { /* ignore */ }
} catch (e) {
    // اگر WebApp در دسترس نبود، یک پیام خطای دوستانه نشان بده
    document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;text-align:center;background:#1a1e1a;color:#f0ece4;font-family:'Kalameh',Tahoma,sans-serif;direction:rtl;">
            <div>
                <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
                <h2 style="color:#c9a86c;font-size:20px;">مشکل در اتصال</h2>
                <p style="font-size:14px;line-height:2;color:#b8b0a0;max-width:360px;">
                    به نظر می‌رسد اتصال اینترنت شما پایدار نیست یا فیلترشکن شما با تلگرام هماهنگ نیست.
                    <br><br>
                    لطفاً <strong>VPN یا پروکسی</strong> خود را عوض کنید و دوباره روی دکمه‌ی «تکمیل فرم» کلیک کنید.
                </p>
            </div>
        </div>
    `;
    throw new Error('Telegram WebApp not available');
}

// ----------------------------------------------------------
// فیدبکِ لمسی (Haptic Feedback) — لرزشِ ظریف موقعِ تعامل با اپ
// ----------------------------------------------------------
// نکته: HapticFeedback ممکن است روی نسخه‌های خیلی قدیمیِ کلاینتِ
// تلگرام یا روی نسخه‌ی وبِ تلگرام (که ویبره فیزیکی معنی نداره) در
// دسترس نباشد، پس همیشه داخل try/catch صدا زده می‌شود تا در آن
// موارد بی‌صدا نادیده گرفته شود و باعثِ خطا نشود.
function haptic(kind, style) {
    try {
        if (!tg.HapticFeedback) return;
        if (kind === "impact") {
            tg.HapticFeedback.impactOccurred(style || "light");
        } else if (kind === "notification") {
            tg.HapticFeedback.notificationOccurred(style || "success");
        } else if (kind === "selection") {
            tg.HapticFeedback.selectionChanged();
        }
    } catch (e) { /* ignore */ }
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

agreeRow.addEventListener("click", () => {
    rulesAgreed = !rulesAgreed;
    agreeRow.classList.toggle("checked", rulesAgreed);
    rulesStartBtn.disabled = !rulesAgreed;
    haptic("impact", "light");
});

rulesStartBtn.addEventListener("click", () => {
    if (!rulesAgreed) return;
    rulesOverlay.classList.add("hidden");
    document.body.classList.remove("rules-locked");
});

rulesCancelBtn.addEventListener("click", () => {
    tg.close();
});

tg.BackButton && tg.BackButton.hide();

// ---------- لیست علایق ----------
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
        haptic("impact", "light");
    } else {
        if (selectedInterests.size >= MAX_INTERESTS) {
            haptic("notification", "error");
            return;
        }
        selectedInterests.add(value);
        chip.classList.add("selected");
        haptic("impact", "light");
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
        educationList.querySelectorAll(".option-item").forEach((el) => el.classList.remove("selected"));
        item.classList.add("selected");
        selectedEducation = { value: item.dataset.value, label: item.dataset.label };
        haptic("selection");
        validateCurrentStep();
    });
});

// ---------- مرحله ۲: نحوه آشنایی ----------
let selectedReferral = null;
const referralList = document.getElementById("referralList");

referralList.querySelectorAll(".option-item").forEach((item) => {
    item.addEventListener("click", () => {
        referralList.querySelectorAll(".option-item").forEach((el) => el.classList.remove("selected"));
        item.classList.add("selected");
        selectedReferral = item.dataset.value;
        haptic("selection");
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

const FORM_STEPS = 3;

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

// ---------- ارسال نهایی داده به سرور + اسپینر لودینگ ----------
const navButtons = document.getElementById("navButtons");
const resultBadge = document.getElementById("resultBadge");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");

let retryButton = null;

async function submitForm() {
    nextBtn.disabled = true;
    nextBtn.textContent = "⏳ در حال ارسال...";

    const formPayload = {
        education: selectedEducation.value,
        education_label: selectedEducation.label,
        referral: selectedReferral,
        interests: Array.from(selectedInterests),
    };

    currentStep = 4;
    showStep(4);
    navButtons.style.display = "none";

    // نمایش اسپینر
    resultBadge.textContent = "";
    resultBadge.classList.remove("error", "celebrate");
    resultBadge.innerHTML = `<span class="spinner"></span>`;
    resultTitle.textContent = "در حال ثبت اطلاعات...";
    resultText.textContent = "لطفاً چند لحظه صبر کنید.";

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
            haptic("notification", "success");
            setTimeout(() => tg.close(), 5000);
        } else {
            throw new Error(data.error || "unknown");
        }
    } catch (err) {
        resultBadge.innerHTML = "!";
        resultBadge.classList.add("error");
        resultBadge.classList.remove("celebrate");
        resultTitle.textContent = "مشکلی پیش آمد";
        resultText.textContent = "متأسفانه در ثبتِ فرم مشکلی پیش آمد. لطفاً دوباره تلاش کن یا از طریقِ گروه با ادمین در میان بگذار.";
        haptic("notification", "error");

        if (retryButton) retryButton.remove();

        retryButton = document.createElement("button");
        retryButton.textContent = "🔄 تلاش مجدد";
        retryButton.className = "btn-primary";
        retryButton.style.marginTop = "20px";
        retryButton.style.padding = "12px 32px";
        retryButton.style.borderRadius = "12px";
        retryButton.style.border = "none";
        retryButton.style.fontFamily = "inherit";
        retryButton.style.fontSize = "14px";
        retryButton.style.fontWeight = "700";
        retryButton.style.cursor = "pointer";
        retryButton.style.background = "linear-gradient(135deg, #c9a86c, #b8925a)";
        retryButton.style.color = "#1a1e1a";
        retryButton.style.boxShadow = "0 4px 24px rgba(201,168,108,0.3)";
        retryButton.addEventListener("click", () => {
            retryButton.remove();
            submitForm();
        });

        const resultBox = document.querySelector(".result-box");
        resultBox.appendChild(retryButton);
    }
}

// شروع از مرحله ۱
showStep(currentStep);