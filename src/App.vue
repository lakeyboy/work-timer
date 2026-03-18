<template>
    <div class="app">
        <div class="card">
            <h1><span>⏳</span> 工时·午休·纯净版</h1>
            <div class="sub">精确到秒 · 下班后自动隐藏模块 · 无冗余信息</div>

            <div style="text-align: center; margin-bottom: 14px">
                <span
                    class="status-badge status-top"
                    role="status"
                    aria-live="polite"
                >
                    <template v-if="status === '上班中'">
                        <div class="status-with-worked">
                            <span class="status-main">{{ status }} 💼</span>
                            <span class="status-worked-time"
                                >已工作 {{ workedText }}</span
                            >
                        </div>
                    </template>
                    <template v-else-if="status === '未上班'">
                        <span>{{ statusText }}</span>
                    </template>
                    <template v-else-if="status === '已下班'">
                        <span>{{ statusText }}</span>
                    </template>
                    <template v-else>
                        <span>{{ statusText }}</span>
                    </template>
                </span>
            </div>

            <div
                class="current-time-box"
                role="timer"
                aria-label="当前时间显示"
            >
                <span class="current-time-label">现在时刻</span>
                <span class="current-time-value">{{ currentTime }}</span>
            </div>

            <div v-show="showCountdown" id="countdownContainer">
                <div class="countdown-block">
                    <div class="countdown-title">距离下班还剩</div>
                    <div class="countdown-number" aria-live="polite">
                        {{ countdownText }}
                    </div>
                </div>
            </div>

            <div class="time-panel">
                <div class="input-group">
                    <div class="input-item">
                        <label for="startTime">🟢 上班</label>
                        <input
                            type="time"
                            id="startTime"
                            v-model="config.startTime"
                            @input="(e) => handleTimeInput(e, 'startTime')"
                            @change="(e) => handleTimeChange(e, 'startTime')"
                            aria-label="上班时间"
                        />
                    </div>
                    <div class="input-item">
                        <label for="endTime">🔴 下班</label>
                        <input
                            type="time"
                            id="endTime"
                            v-model="config.endTime"
                            @input="(e) => handleTimeInput(e, 'endTime')"
                            @change="(e) => handleTimeChange(e, 'endTime')"
                            aria-label="下班时间"
                        />
                    </div>
                </div>
                <div
                    v-show="warnings.timeConflict"
                    class="warning-text"
                    role="alert"
                >
                    ⚠️ 下班时间早于上班时间，已自动调整为次日
                </div>
            </div>

            <div class="rest-panel">
                <div class="rest-title">😴 午休时段（扣除不计入工时）</div>
                <div class="input-group">
                    <div class="input-item">
                        <label for="restStart">🌅 开始</label>
                        <input
                            type="time"
                            id="restStart"
                            v-model="config.restStart"
                            @input="(e) => handleTimeInput(e, 'restStart')"
                            @change="(e) => handleTimeChange(e, 'restStart')"
                            aria-label="午休开始时间"
                        />
                    </div>
                    <div class="input-item">
                        <label for="restEnd">🌄 结束</label>
                        <input
                            type="time"
                            id="restEnd"
                            v-model="config.restEnd"
                            @input="(e) => handleTimeInput(e, 'restEnd')"
                            @change="(e) => handleTimeChange(e, 'restEnd')"
                            aria-label="午休结束时间"
                        />
                    </div>
                </div>
                <div
                    v-show="warnings.restOutOfRange"
                    class="warning-text"
                    role="alert"
                >
                    ⚠️ 午休时间超出工作时段范围
                </div>
            </div>

            <div class="footer-note">
                <div
                    style="
                        display: flex;
                        gap: 10px;
                        flex-wrap: wrap;
                        justify-content: center;
                    "
                >
                    <button @click="resetToDefault" aria-label="重置默认时间">
                        🔄 重置 09:00–18:00 午休 12:00–13:00
                    </button>
                    <button
                        @click="openModal"
                        class="sponsor-btn"
                        aria-label="支持作者"
                    >
                        ☕ 支持一下
                    </button>
                </div>
                <p style="margin-top: 12px">
                    💡 下班后倒计时&工时自动隐藏 · 未上班仅显示倒计时
                </p>
                <p style="font-size: 0.8rem; color: #b0a090; margin-top: 6px">
                    ⌨️ 快捷键：Ctrl+R 重置 | Esc 关闭弹窗
                </p>
            </div>
        </div>

        <Teleport to="body">
            <div
                v-show="showModal"
                class="modal-overlay"
                @click.self="closeModal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modalTitle"
            >
                <div class="modal">
                    <button
                        class="modal-close"
                        @click="closeModal"
                        aria-label="关闭弹窗"
                    >
                        ×
                    </button>
                    <h2 id="modalTitle">支持一下作者</h2>
                    <p>扫一扫二维码，给我买杯咖啡 ☕</p>
                    <img
                        src="https://via.placeholder.com/180x180.png?text=QR+Code"
                        alt="赞助二维码"
                    />
                    <p
                        style="
                            font-size: 0.85rem;
                            color: #7b6a5d;
                            margin-top: 10px;
                        "
                    >
                        (或直接通过 GitHub Sponsor / 赏金方式支持)
                    </p>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script setup>
    import { ref, reactive, computed, onMounted, onUnmounted } from "vue";

    const STORAGE_KEY = "workTimeConfigV5";

    const config = reactive({
        startTime: "09:00",
        endTime: "18:00",
        restStart: "12:00",
        restEnd: "13:00",
    });

    const currentTime = ref("");
    const status = ref("");
    const countdownText = ref("");
    const workedSeconds = ref(0);
    const showCountdown = ref(true);
    const showModal = ref(false);

    const warnings = reactive({
        timeConflict: false,
        restOutOfRange: false,
    });

    let timer = null;
    let lastStatus = null;
    let lastShiftStart = null;
    let lastShiftEnd = null;
    let lastDateKey = null;

    const lastValidTimes = reactive({
        startTime: "09:00",
        endTime: "18:00",
        restStart: "12:00",
        restEnd: "13:00",
    });

    const statusMap = {
        上班中: "上班中 💼",
        未上班: "未上班 🌅",
        已下班: "已下班 🎉",
        等待输入: "⏳ 等待输入",
        错误: "⚠️ 错误",
    };

    const statusText = computed(() => statusMap[status.value] || status.value);
    const workedText = computed(() => formatWorked(workedSeconds.value));

    function parseTimeStr(timeStr) {
        if (!timeStr || !timeStr.includes(":")) return null;
        const parts = timeStr.split(":");
        const hour = parseInt(parts[0], 10);
        const minute = parseInt(parts[1], 10);
        if (isNaN(hour) || isNaN(minute)) return null;
        return { hour, minute };
    }

    function buildDateFromBase(baseDate, hour, minute) {
        const d = new Date(baseDate);
        d.setHours(hour, minute, 0, 0);
        return d;
    }

    function getEndDateForBase(baseDate, startHour, startMin, endHour, endMin) {
        const startDate = buildDateFromBase(baseDate, startHour, startMin);
        let endDate = buildDateFromBase(baseDate, endHour, endMin);
        if (endDate <= startDate) {
            endDate.setDate(endDate.getDate() + 1);
        }
        return endDate;
    }

    function computeDetails(now, startStr, endStr) {
        const startTime = parseTimeStr(startStr);
        const endTime = parseTimeStr(endStr);
        if (!startTime || !endTime) return null;

        const { hour: sH, minute: sM } = startTime;
        const { hour: eH, minute: eM } = endTime;

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const today = new Date(now);
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const endYesterday = getEndDateForBase(yesterday, sH, sM, eH, eM);
        const endToday = getEndDateForBase(today, sH, sM, eH, eM);
        const endTomorrow = getEndDateForBase(tomorrow, sH, sM, eH, eM);

        const candidates = [endYesterday, endToday, endTomorrow].filter(
            (d) => d > now,
        );
        if (candidates.length === 0) return null;

        const nextEnd = new Date(
            Math.min(...candidates.map((d) => d.getTime())),
        );

        const startYesterday = buildDateFromBase(yesterday, sH, sM);
        const endYesterdayInterval = getEndDateForBase(
            yesterday,
            sH,
            sM,
            eH,
            eM,
        );
        const startToday = buildDateFromBase(today, sH, sM);
        const endTodayInterval = getEndDateForBase(today, sH, sM, eH, eM);

        const inYesterday = now >= startYesterday && now < endYesterdayInterval;
        const inToday = now >= startToday && now < endTodayInterval;

        let currentStatus,
            currentShiftStart = null,
            currentShiftEnd = null;

        if (inYesterday) {
            currentStatus = "上班中";
            currentShiftStart = startYesterday;
            currentShiftEnd = endYesterdayInterval;
        } else if (inToday) {
            currentStatus = "上班中";
            currentShiftStart = startToday;
            currentShiftEnd = endTodayInterval;
        } else {
            if (now < startToday && !inYesterday) {
                currentStatus = "未上班";
            } else {
                currentStatus = "已下班";
            }
        }

        return {
            nextEnd,
            status: currentStatus,
            currentShiftStart,
            currentShiftEnd,
        };
    }

    function calculateWorkedSeconds(
        now,
        shiftStart,
        shiftEnd,
        restStartObj,
        restEndObj,
    ) {
        if (!shiftStart || now < shiftStart) return 0;

        const restStart = new Date(shiftStart);
        restStart.setHours(restStartObj.hour, restStartObj.minute, 0, 0);
        const restEnd = new Date(shiftStart);
        restEnd.setHours(restEndObj.hour, restEndObj.minute, 0, 0);

        if (restEnd <= restStart) {
            restEnd.setDate(restEnd.getDate() + 1);
        }

        const shiftStartMs = shiftStart.getTime();
        const shiftEndMs = shiftEnd.getTime();
        const restStartMs = Math.max(restStart.getTime(), shiftStartMs);
        const restEndMs = Math.min(restEnd.getTime(), shiftEndMs);

        const nowMs = now.getTime();
        let workedEndMs = Math.min(nowMs, shiftEndMs);

        if (nowMs > restStartMs && nowMs < restEndMs) {
            workedEndMs = restStartMs;
        }

        let totalWorkMs = workedEndMs - shiftStartMs;
        const restIntersectStart = Math.max(restStartMs, shiftStartMs);
        const restIntersectEnd = Math.min(restEndMs, workedEndMs);
        const restDurationMs = Math.max(
            0,
            restIntersectEnd - restIntersectStart,
        );

        const workedMs = totalWorkMs - restDurationMs;
        return Math.max(0, Math.floor(workedMs / 1000));
    }

    function formatRemaining(ms) {
        if (ms < 0) return "0 小时 0 分 0 秒";
        const totalSeconds = Math.floor(ms / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        let result = "";
        if (days > 0) result += `${days}天`;
        result += `${hours}小时${minutes}分${seconds}秒`;
        return result;
    }

    function formatWorked(seconds) {
        if (seconds < 0) return "--小时--分--秒";
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        let result = "";
        if (days > 0) result += `${days}天`;
        result += `${hours}小时${minutes}分${secs}秒`;
        return result;
    }

    function updateClock() {
        const now = new Date();
        const y = now.getFullYear();
        const M = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        currentTime.value = `${y}/${M}/${d} ${hh}:${mm}:${ss}`;
    }

    function updateTopStatus(
        newStatus,
        shiftStart,
        shiftEnd,
        restStartVal,
        restEndVal,
    ) {
        if (newStatus === "上班中" && shiftStart && shiftEnd) {
            const now = new Date();
            const restStartObj = parseTimeStr(restStartVal);
            const restEndObj = parseTimeStr(restEndVal);

            if (restStartObj && restEndObj) {
                workedSeconds.value = calculateWorkedSeconds(
                    now,
                    shiftStart,
                    shiftEnd,
                    restStartObj,
                    restEndObj,
                );
            } else {
                const totalSeconds = Math.floor(
                    (Math.min(now.getTime(), shiftEnd.getTime()) -
                        shiftStart.getTime()) /
                        1000,
                );
                workedSeconds.value = Math.max(0, totalSeconds);
            }
        } else {
            workedSeconds.value = 0;
        }
    }

    function updateDisplayOnly(now, newStatus, shiftStart, shiftEnd) {
        if (newStatus === "上班中" && shiftStart && shiftEnd) {
            const remainingMs = shiftEnd - now;
            countdownText.value = formatRemaining(remainingMs);
            updateTopStatus(
                newStatus,
                shiftStart,
                shiftEnd,
                config.restStart,
                config.restEnd,
            );
        } else if (newStatus === "未上班") {
            const details = computeDetails(
                now,
                config.startTime,
                config.endTime,
            );
            if (details) {
                const remainingMs = details.nextEnd - now;
                countdownText.value = formatRemaining(remainingMs);
            }
        }
    }

    function updateRemaining() {
        const now = new Date();
        const dateKey = now.toDateString();

        if (!config.startTime || !config.endTime) {
            countdownText.value = "请设置时间";
            status.value = "等待输入";
            showCountdown.value = true;
            return;
        }

        if (
            dateKey === lastDateKey &&
            lastStatus &&
            (lastStatus === "上班中" || lastStatus === "未上班")
        ) {
            updateDisplayOnly(now, lastStatus, lastShiftStart, lastShiftEnd);
            return;
        }

        const details = computeDetails(now, config.startTime, config.endTime);
        if (!details) {
            countdownText.value = "时间格式有误";
            status.value = "错误";
            showCountdown.value = true;
            return;
        }

        const {
            nextEnd,
            status: newStatus,
            currentShiftStart,
            currentShiftEnd,
        } = details;

        if (newStatus === "已下班") {
            showCountdown.value = false;
            status.value = newStatus;
        } else if (newStatus === "未上班") {
            showCountdown.value = true;
            const remainingMs = nextEnd - now;
            countdownText.value = formatRemaining(remainingMs);
            status.value = newStatus;
            updateTopStatus(newStatus, null, null, null, null);
        } else if (newStatus === "上班中") {
            showCountdown.value = true;
            status.value = newStatus;
            if (currentShiftEnd) {
                const remainingMs = currentShiftEnd - now;
                countdownText.value = formatRemaining(remainingMs);
            } else {
                countdownText.value = "计算异常";
            }
            updateTopStatus(
                newStatus,
                currentShiftStart,
                currentShiftEnd,
                config.restStart,
                config.restEnd,
            );
        }

        lastStatus = newStatus;
        lastShiftStart = currentShiftStart;
        lastShiftEnd = currentShiftEnd;
        lastDateKey = dateKey;
    }

    function validateTimeConfig() {
        const startTime = parseTimeStr(config.startTime);
        const endTime = parseTimeStr(config.endTime);
        const restStartObj = parseTimeStr(config.restStart);
        const restEndObj = parseTimeStr(config.restEnd);

        if (startTime && endTime) {
            const startDate = new Date(
                2000,
                0,
                1,
                startTime.hour,
                startTime.minute,
            );
            const endDate = new Date(2000, 0, 1, endTime.hour, endTime.minute);
            warnings.timeConflict = endDate <= startDate;
        }

        if (startTime && endTime && restStartObj && restEndObj) {
            const workStart = new Date(
                2000,
                0,
                1,
                startTime.hour,
                startTime.minute,
            );
            const workEnd = new Date(2000, 0, 1, endTime.hour, endTime.minute);
            const restStart = new Date(
                2000,
                0,
                1,
                restStartObj.hour,
                restStartObj.minute,
            );
            const restEnd = new Date(
                2000,
                0,
                1,
                restEndObj.hour,
                restEndObj.minute,
            );

            warnings.restOutOfRange =
                restStart < workStart || restEnd > workEnd;
        }
    }

    function loadSavedTimes() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                const { start, end, restStart, restEnd } = parsed;
                if (start) {
                    config.startTime = start;
                    lastValidTimes.startTime = start;
                }
                if (end) {
                    config.endTime = end;
                    lastValidTimes.endTime = end;
                }
                if (restStart) {
                    config.restStart = restStart;
                    lastValidTimes.restStart = restStart;
                }
                if (restEnd) {
                    config.restEnd = restEnd;
                    lastValidTimes.restEnd = restEnd;
                }
            }
        } catch (e) {
            console.warn("加载配置失败，使用默认值:", e);
        }
    }

    function saveTimes() {
        try {
            const configData = {
                start: config.startTime,
                end: config.endTime,
                restStart: config.restStart,
                restEnd: config.restEnd,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(configData));
            validateTimeConfig();
        } catch (e) {
            console.warn("保存配置失败:", e);
        }
    }

    function saveAndUpdate() {
        saveTimes();
        updateRemaining();
    }

    function resetToDefault() {
        config.startTime = "09:00";
        config.endTime = "18:00";
        config.restStart = "12:00";
        config.restEnd = "13:00";
        saveTimes();
        updateRemaining();
    }

    function openModal() {
        showModal.value = true;
    }

    function closeModal() {
        showModal.value = false;
    }

    function handleKeydown(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "r") {
            e.preventDefault();
            resetToDefault();
        }
        if (e.key === "Escape") {
            closeModal();
        }
    }

    function handleTimeInput(event, fieldName) {
        const newValue = event.target.value;

        if (!newValue || newValue.trim() === "") {
            event.target.value = lastValidTimes[fieldName];
            config[fieldName] = lastValidTimes[fieldName];

            if (navigator.vibrate) {
                navigator.vibrate(50);
            }

            return false;
        }

        lastValidTimes[fieldName] = newValue;
        return true;
    }

    function handleTimeChange(event, fieldName) {
        const isValid = handleTimeInput(event, fieldName);

        if (isValid) {
            saveAndUpdate();
        } else {
            event.target.blur();
            setTimeout(() => {
                event.target.focus();
            }, 100);
        }
    }

    function tick() {
        updateClock();
        updateRemaining();
    }

    onMounted(() => {
        loadSavedTimes();
        tick();
        timer = setInterval(tick, 1000);
        document.addEventListener("keydown", handleKeydown);

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                clearInterval(timer);
                timer = setInterval(tick, 5000);
            } else {
                clearInterval(timer);
                timer = setInterval(tick, 1000);
                tick();
            }
        });
    });

    onUnmounted(() => {
        if (timer) {
            clearInterval(timer);
        }
        document.removeEventListener("keydown", handleKeydown);
    });
</script>

<style scoped>
    * {
        box-sizing: border-box;
        font-family:
            system-ui,
            -apple-system,
            "Segoe UI",
            Roboto,
            "Helvetica Neue",
            sans-serif;
        margin: 0;
        padding: 0;
        -webkit-tap-highlight-color: transparent;
    }

    body {
        min-height: 100vh;
        min-height: -webkit-fill-available;
        background: linear-gradient(145deg, #f9f3e8 0%, #fff4e4 100%);
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 12px;
        margin: 0;
        overflow-x: hidden;
        touch-action: manipulation;
        -webkit-overflow-scrolling: touch;
    }

    .card {
        max-width: 600px;
        width: 100%;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-radius: 40px;
        box-shadow:
            0 25px 45px -10px rgba(0, 0, 0, 0.15),
            0 2px 8px rgba(0, 0, 0, 0.05);
        padding: 28px 20px;
        border: 1px solid rgba(255, 245, 235, 0.6);
        transition: all 0.2s;
        max-height: calc(100vh - 24px);
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
    }

    h1 {
        font-size: clamp(1.6rem, 4vw, 2rem);
        font-weight: 700;
        letter-spacing: -0.02em;
        color: #2d2a24;
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        flex-wrap: wrap;
    }

    h1 span {
        background: #f1d5b5;
        font-size: clamp(1.5rem, 3.5vw, 1.8rem);
        padding: 0 10px;
        border-radius: 60px;
        line-height: 1.3;
    }

    .sub {
        color: #7e6e5d;
        font-size: clamp(0.85rem, 2.5vw, 0.95rem);
        font-weight: 400;
        margin-bottom: 20px;
        border-left: 4px solid #f3b37f;
        padding-left: 14px;
        background: rgba(243, 179, 127, 0.08);
        border-radius: 0 20px 20px 0;
    }

    .time-panel {
        background: #ffffffd6;
        border-radius: 36px;
        padding: 20px 16px;
        margin-bottom: 16px;
        border: 1px solid #ffeede;
        box-shadow:
            inset 0 2px 4px #fff9f0,
            0 8px 18px -8px rgba(100, 70, 40, 0.2);
    }

    .current-time-box {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #fdefdb;
        padding: 12px 16px;
        border-radius: 100px;
        margin-bottom: 20px;
        color: #3e362e;
        font-weight: 500;
        flex-wrap: wrap;
        gap: 8px;
    }

    .current-time-label {
        font-size: 1rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #a76326;
    }

    .current-time-value {
        font-size: clamp(1.2rem, 3vw, 1.5rem);
        font-weight: 700;
        font-family: "JetBrains Mono", "Cascadia Code", monospace;
        background: #3e2e1e;
        color: #fbead0;
        padding: 6px 16px;
        border-radius: 60px;
        box-shadow: 0 4px 0 #1f160f;
        white-space: nowrap;
        max-width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }

    .input-group {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        justify-content: space-between;
    }

    .input-item {
        flex: 1 1 140px;
        min-width: 130px;
    }

    .input-item label {
        display: block;
        font-size: 0.9rem;
        font-weight: 600;
        color: #664d38;
        margin-bottom: 6px;
        margin-left: 8px;
    }

    .input-item input[type="time"] {
        width: 100%;
        background: #fffbf5;
        border: 2px solid #ead6c2;
        border-radius: 40px;
        padding: clamp(12px, 3vw, 14px) clamp(14px, 3vw, 16px);
        font-size: clamp(1rem, 2.5vw, 1.1rem);
        font-weight: 500;
        color: #2d241c;
        outline: none;
        transition: 0.2s;
        box-shadow: 0 5px 0 #d0b99e;
        -webkit-appearance: none;
        appearance: none;
        min-height: 48px;
    }

    .input-item input[type="time"]:focus {
        border-color: #f3a15d;
        box-shadow: 0 5px 0 #b57a42;
    }

    .input-item input[type="time"]::-webkit-date-and-time-value {
        text-align: left;
    }

    .rest-panel {
        background: #f1e4d6d6;
        border-radius: 30px;
        padding: 16px 16px 12px;
        margin: 8px 0 12px;
        border: 1px solid #f8cdae;
    }

    .rest-title {
        font-size: 1rem;
        font-weight: 600;
        color: #9b5f2e;
        margin-bottom: 8px;
        padding-left: 8px;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    #countdownContainer {
        display: block;
    }

    #workedContainer {
        display: none;
        text-align: center;
    }

    .countdown-block {
        background: #362f28;
        border-radius: 50px;
        padding: 24px 12px;
        text-align: center;
        margin: 8px 0 12px;
        box-shadow:
            0 10px 0 #1d1712,
            inset 0 2px 10px #ffe1ae40;
    }

    .countdown-title {
        color: #c9ad8a;
        font-size: 0.95rem;
        letter-spacing: 2px;
        text-transform: uppercase;
        margin-bottom: 10px;
    }

    .countdown-number {
        font-size: clamp(1.6rem, 4vw, 2.2rem);
        font-weight: 800;
        line-height: 1.3;
        color: #fff1de;
        font-family: "JetBrains Mono", monospace;
        text-shadow: 0 4px 0 #a76529;
        word-break: break-word;
        white-space: normal;
    }

    .status-badge {
        display: inline-block;
        background: #eedac7;
        border-radius: 40px;
        padding: clamp(10px, 2.5vw, 12px) clamp(18px, 4vw, 24px);
        font-size: clamp(1rem, 3vw, 1.2rem);
        font-weight: 700;
        color: #3e2a1a;
        box-shadow: 0 5px 0 #b28b64;
        margin: 4px 0 6px;
        width: auto;
        max-width: 100%;
    }

    .status-top {
        display: block;
        font-size: clamp(1.2rem, 3.5vw, 1.4rem);
        padding: clamp(12px, 3vw, 14px) clamp(20px, 4vw, 26px);
        background: linear-gradient(90deg, #ffca7f, #fad6b0);
        border: 2px solid #f3a15d;
        box-shadow: 0 6px 0 rgba(180, 110, 40, 0.75);
    }

    .status-with-worked {
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: center;
    }

    .status-main {
        font-size: clamp(1.2rem, 3.5vw, 1.4rem);
        font-weight: 700;
    }

    .status-worked-time {
        font-size: clamp(0.9rem, 2.5vw, 1rem);
        font-weight: 600;
        background: rgba(255, 255, 255, 0.75);
        padding: 4px 12px;
        border-radius: 20px;
        font-family: "JetBrains Mono", monospace;
        color: #4a3a2a;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .worked-badge {
        display: inline-block;
        background: #d8d0c0;
        border-radius: 40px;
        padding: clamp(8px, 2vw, 10px) clamp(14px, 3vw, 20px);
        font-size: clamp(0.95rem, 2.5vw, 1.1rem);
        font-weight: 600;
        color: #2d3e3a;
        box-shadow: 0 4px 0 #8f7e6b;
        margin: 8px 0 4px;
        width: auto;
        max-width: 100%;
        font-family: "JetBrains Mono", monospace;
    }

    .footer-note {
        text-align: center;
        color: #9b8a78;
        font-size: 0.85rem;
        margin-top: 20px;
        border-top: 1px dashed #e5cfbc;
        padding-top: 18px;
    }

    .footer-note button {
        background: none;
        border: 1px solid #ccb79f;
        border-radius: 40px;
        padding: clamp(10px, 2.5vw, 12px) clamp(18px, 4vw, 24px);
        color: #6b4f37;
        font-weight: 600;
        font-size: clamp(0.9rem, 2.5vw, 1rem);
        cursor: pointer;
        transition: 0.2s;
        background-color: #fcf3e9;
        box-shadow: 0 3px 0 #d0b99e;
        -webkit-tap-highlight-color: transparent;
        min-height: 44px;
        touch-action: manipulation;
    }

    .footer-note button:active {
        transform: translateY(2px);
        box-shadow: 0 1px 0 #d0b99e;
    }

    .footer-note button:hover {
        background: #cfb89d;
        color: white;
    }

    @media (max-width: 480px) {
        .card {
            padding: 20px 16px;
            border-radius: 30px;
        }

        h1 {
            font-size: 1.6rem;
            gap: 6px;
        }

        .sub {
            font-size: 0.85rem;
            margin-bottom: 16px;
        }

        .current-time-box {
            padding: 10px 14px;
            gap: 6px;
        }

        .current-time-label {
            font-size: 0.9rem;
        }

        .current-time-value {
            font-size: 1.2rem;
            padding: 5px 12px;
        }

        .countdown-number {
            font-size: 1.6rem;
            padding: 18px 10px;
        }

        .countdown-title {
            font-size: 0.85rem;
        }

        .input-item {
            min-width: 100%;
            flex-basis: 100%;
        }

        .input-item input[type="time"] {
            padding: 14px 16px;
            font-size: 1rem;
            min-height: 50px;
        }

        .input-item label {
            font-size: 0.85rem;
        }

        .status-badge {
            font-size: 1.1rem;
            padding: 10px 20px;
        }

        .worked-badge {
            font-size: 1rem;
            padding: 8px 16px;
        }

        .time-panel {
            padding: 16px 14px;
        }

        .rest-panel {
            padding: 14px 14px 10px;
        }

        .footer-note {
            font-size: 0.8rem;
            padding-top: 16px;
        }

        .footer-note button {
            width: 100%;
            margin-bottom: 8px;
        }

        .footer-note button:last-child {
            margin-bottom: 0;
        }
    }

    @media (max-width: 360px) {
        .card {
            padding: 18px 14px;
            border-radius: 24px;
        }

        .current-time-box {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
        }

        .current-time-value {
            align-self: flex-end;
            font-size: 1.1rem;
        }

        .input-group {
            gap: 12px;
        }

        .countdown-block {
            padding: 18px 10px;
        }

        .countdown-number {
            font-size: 1.5rem;
        }

        h1 {
            font-size: 1.5rem;
        }

        h1 span {
            font-size: 1.4rem;
        }
    }

    @media (min-width: 481px) and (max-width: 768px) {
        .card {
            padding: 24px 18px;
        }

        .input-item {
            min-width: 45%;
        }
    }

    @media (orientation: landscape) and (max-height: 500px) {
        body {
            padding: 8px;
            align-items: flex-start;
        }

        .card {
            padding: 16px;
            max-height: calc(100vh - 16px);
        }

        .input-group {
            flex-wrap: nowrap;
            gap: 10px;
        }

        .input-item {
            min-width: 120px;
        }

        .countdown-block {
            padding: 16px 12px;
            margin: 6px 0 10px;
        }

        .countdown-number {
            font-size: 1.4rem;
        }

        .current-time-box {
            padding: 8px 12px;
            margin-bottom: 14px;
        }

        .time-panel {
            padding: 14px 12px;
            margin-bottom: 12px;
        }

        .rest-panel {
            padding: 12px 12px 10px;
            margin: 6px 0 10px;
        }
    }

    @media (orientation: landscape) and (max-height: 400px) {
        h1 {
            font-size: 1.3rem;
            margin-bottom: 6px;
        }

        h1 span {
            font-size: 1.2rem;
        }

        .sub {
            font-size: 0.75rem;
            margin-bottom: 12px;
        }

        .current-time-value {
            font-size: 1rem;
        }

        .countdown-number {
            font-size: 1.2rem;
        }

        .status-top {
            font-size: 1.1rem;
            padding: 8px 16px;
        }
    }

    button,
    input {
        -webkit-tap-highlight-color: transparent;
    }

    .current-time-value::-webkit-scrollbar {
        height: 3px;
        background: transparent;
    }

    .current-time-value::-webkit-scrollbar-thumb {
        background: #b28b64;
        border-radius: 10px;
    }

    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 2000;
        -webkit-overflow-scrolling: touch;
    }

    .modal {
        width: min(420px, 100%);
        max-height: calc(100vh - 40px);
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        background: rgba(255, 255, 255, 0.96);
        border-radius: 18px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
        padding: 22px;
        text-align: center;
        position: relative;
    }

    .modal h2 {
        margin: 0 0 14px;
        font-size: 1.4rem;
    }

    .modal p {
        margin: 0 0 18px;
        color: #5b4a3b;
    }

    .modal img {
        width: 180px;
        height: 180px;
        object-fit: contain;
        border-radius: 14px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        margin-bottom: 16px;
    }

    .modal-close {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 32px;
        height: 32px;
        border: none;
        background: rgba(0, 0, 0, 0.12);
        border-radius: 50%;
        color: white;
        font-size: 18px;
        cursor: pointer;
        min-width: 32px;
        min-height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .warning-text {
        color: #d9534f;
        font-size: 0.85rem;
        margin-top: 8px;
        padding-left: 8px;
        display: none;
        line-height: 1.4;
    }

    @supports (-webkit-touch-callout: none) {
        .card {
            max-height: -webkit-fill-available;
        }
    }

    @media screen and (-webkit-min-device-pixel-ratio: 0) {
        body {
            min-height: -webkit-fill-available;
        }
    }
    .app {
        width: 100%;
        min-height: 100vh;
    }

    * {
        box-sizing: border-box;
        font-family:
            system-ui,
            -apple-system,
            "Segoe UI",
            Roboto,
            "Helvetica Neue",
            sans-serif;
        margin: 0;
        padding: 0;
        -webkit-tap-highlight-color: transparent;
    }
    /* ... 其余样式保持不变 ... */
</style>
