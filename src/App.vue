<template>
    <div class="app">
        <div class="card">
            <h1><span>⏳</span> 工时·午休·纯净版</h1>
            <div class="sub">精确到秒 · 下班后自动隐藏模块 · 无冗余信息</div>

            <div style="text-align: center; margin-bottom: 14px">
                <span class="status-badge status-top">
                    <span class="status-with-worked">
                        <!-- aria-live 只包住状态文案，避免「已工作」每秒播报 -->
                        <span
                            class="status-main"
                            role="status"
                            aria-live="polite"
                            >{{ statusText }}</span
                        >
                        <span
                            v-if="status === '上班中'"
                            class="status-worked-time"
                            >已工作 {{ workedText }}</span
                        >
                    </span>
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
                    <!-- 倒计时每秒变化，不放进 aria-live，避免读屏连续播报 -->
                    <div class="countdown-number">{{ countdownText }}</div>
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

            <div class="tool-panel">
                <div class="tool-title">🧰 小工具</div>
                <button class="tool-entry" @click="showCarTool = true">
                    <span class="tool-entry-icon" aria-hidden="true">🚗</span>
                    <span class="tool-entry-text">
                        <strong>购车工具</strong>
                        <small>换算轮胎、玻璃的生产日期</small>
                    </span>
                    <span class="tool-entry-arrow" aria-hidden="true">›</span>
                </button>
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
                v-if="showModal"
                class="modal-overlay"
                @click.self="closeModal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modalTitle"
            >
                <div class="modal">
                    <button
                        ref="closeButton"
                        class="modal-close"
                        @click="closeModal"
                        aria-label="关闭弹窗"
                    >
                        ×
                    </button>
                    <h2 id="modalTitle">支持一下作者</h2>
                    <p>扫一扫二维码，给我买杯咖啡 ☕</p>
                    <img :src="sponsorQr" alt="赞助二维码" />
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

        <CarDateTool v-if="showCarTool" @close="showCarTool = false" />
    </div>
</template>

<script setup>
    import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
    import { useWorkClock } from "./composables/useWorkClock.js";
    import CarDateTool from "./components/CarDateTool.vue";
    import sponsorQr from "./assets/sponsor-placeholder.svg";

    const {
        config,
        currentTime,
        status,
        countdownText,
        workedText,
        showCountdown,
        warnings,
        updateTime,
        commitTimes,
        resetToDefault,
    } = useWorkClock();

    const statusMap = {
        上班中: "上班中 💼",
        未上班: "未上班 🌅",
        已下班: "已下班 🎉",
        等待输入: "⏳ 等待输入",
        错误: "⚠️ 错误",
    };

    const statusText = computed(
        () => statusMap[status.value] || status.value,
    );

    const showModal = ref(false);
    const showCarTool = ref(false);
    const closeButton = ref(null);
    let lastFocused = null;

    function openModal() {
        lastFocused = document.activeElement;
        showModal.value = true;
        nextTick(() => closeButton.value?.focus());
    }

    function closeModal() {
        showModal.value = false;
        lastFocused?.focus?.();
        lastFocused = null;
    }

    // 弹窗打开时锁住背景滚动
    watch(showModal, (open) => {
        document.body.style.overflow = open ? "hidden" : "";
    });

    function handleTimeInput(event, field) {
        if (!updateTime(field, event.target.value)) {
            event.target.value = config[field];
            navigator.vibrate?.(50);
        }
    }

    function handleTimeChange(event, field) {
        if (updateTime(field, event.target.value)) {
            commitTimes();
            return;
        }
        event.target.value = config[field];
        event.target.blur();
        setTimeout(() => event.target.focus(), 100);
    }

    function isTypingTarget(target) {
        return (
            target instanceof HTMLElement &&
            (target.closest("input, select, textarea") !== null ||
                target.isContentEditable)
        );
    }

    function handleKeydown(event) {
        if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "r"
        ) {
            // 在输入框里按 Ctrl+R 时不重置，避免和购车工具输入冲突
            if (isTypingTarget(event.target)) return;
            event.preventDefault();
            resetToDefault();
            return;
        }
        if (event.key === "Escape" && showModal.value) {
            closeModal();
        }
    }

    onMounted(() => {
        document.addEventListener("keydown", handleKeydown);
    });

    onUnmounted(() => {
        document.removeEventListener("keydown", handleKeydown);
        document.body.style.overflow = "";
    });
</script>

<style scoped>
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

    .tool-panel {
        margin: 14px 0 4px;
        padding: 14px 16px 16px;
        border: 1px dashed #e5c9a8;
        border-radius: 30px;
        background: #fff8ef;
    }

    .tool-title {
        margin-bottom: 8px;
        padding-left: 4px;
        font-size: 0.95rem;
        font-weight: 600;
        color: #9b5f2e;
    }

    .tool-entry {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 11px 14px;
        border: 1px solid #ead6c2;
        border-radius: 22px;
        background: #fff;
        color: #4a3a2a;
        text-align: left;
        cursor: pointer;
        box-shadow: 0 4px 0 #e3cbb1;
        transition: all 0.2s;
    }

    .tool-entry:active {
        transform: translateY(2px);
        box-shadow: 0 2px 0 #e3cbb1;
    }

    .tool-entry-icon {
        font-size: 1.5rem;
        line-height: 1;
    }

    .tool-entry-text {
        display: flex;
        flex-direction: column;
        flex: 1;
        gap: 2px;
        min-width: 0;
    }

    .tool-entry-text strong {
        font-size: 1rem;
    }

    .tool-entry-text small {
        font-size: 0.78rem;
        color: #9b8a78;
    }

    .tool-entry-arrow {
        font-size: 1.4rem;
        color: #c0a78c;
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
        line-height: 1.4;
    }

    @supports (-webkit-touch-callout: none) {
        .card {
            max-height: -webkit-fill-available;
        }
    }

    .app {
        display: flex;
        justify-content: center;
        width: 100%;
        min-height: 100%;
    }

    button:focus-visible,
    input:focus-visible {
        outline: 3px solid #b25f1f;
        outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
        * {
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
        }
    }
</style>
