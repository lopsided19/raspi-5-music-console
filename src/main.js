import "./styles.css";
import { BasicSynth } from "./synth.js";
import { SCALES, buildScaleNotes, getScaleToneRole } from "./music.js";
import {
  beatPulseAt,
  eraseTrackRange,
  loopProgressAt,
  loopPosition,
  loopStepCount,
  normalizedPoint,
  recordPoint,
  recordingPhraseGapMs,
  recordingTransportStart,
  rhythmicEnvelopeAt,
  shiftTrackLoop,
  stepDurationMs,
  trackPointsAtAbsoluteStep,
} from "./loop.js";
import { createProjectArchive, parseProjectArchive } from "./project-archive.js";
import { ProjectHistory } from "./project-history.js";
import { loadHistorySession, saveHistorySession } from "./history-storage.js";
import { instrumentMidi, instrumentPreset } from "./instruments.js";
import {
  POP_CHORD_REGIONS,
  POP_STRONG_DIRECTIONAL_IDS,
  availablePopInversionIds,
  buildPopChordVoicing,
  nextPopChordVoicingState,
  popChordAtPoint,
  popChordIndexAtPoint,
  recommendedPopBassTargetIds,
  recommendedPopChordIds,
} from "./chords.js";
import { clampTempo, isTapIntervalInRange, tapTempoFromTimestamps } from "./tempo.js";
import {
  drumEventsAt,
  drumPatternIndexAtX,
  drumStepAtLoopStep,
  isDrumTriggerLoopStep,
} from "./drums.js";
import { activePointerPoint, registerPointerPress, unregisterPointer } from "./touch-control.js";
import { edgeHitAtX, interiorRangeAtX } from "./edge-hit.js";
import {
  isTrackAudible,
  toggleTrackMute,
  toggleTrackSolo,
  trackGestureAction,
  trackGestureLabel,
  trackGesturePreview,
} from "./track-mute.js";
import { trackPathData } from "./track-visualization.js";
import {
  MAX_LOOP_BARS,
  SONG_SECTIONS,
  beginSongLoopLengthEdit,
  cancelSongLoopLengthEdit,
  createSongProject,
  currentSongSection,
  deleteSongClip,
  deselectSongClip,
  expandSongClipForRecording,
  mergeSongClipWithNext,
  moveSongClip,
  nextAdjacentSongClip,
  placeSongLoopAt,
  previewSongLoopLengthEdit,
  resizeSongClip,
  resizeSongClipStart,
  restoreSongProject,
  sectionBars,
  sectionLoopRange,
  selectSongClip,
  selectedPerformanceLoops,
  selectedSongClip,
  selectedSongLoop,
  setSongSectionLength,
  setSongSectionLoopRange,
  songClipPathData,
  songLoopById,
  songPointAtAbsoluteStep,
  songPlaybackRangeStateAfterChange,
  songRecordingTargetAtAbsoluteStep,
  songSectionLoopStartPlaybackState,
  songSectionStepAtTransportStep,
  songSectionTransitionAtNextBar,
  splitSongClip,
  syncPerformanceLoopsToSong,
} from "./song.js";
import {
  TUTORIAL_VERSION,
  activeProfileId,
  clearActiveProfileId,
  createProfile,
  loadProfiles,
  normalizeTutorialProgress,
  normalizedProfileName,
  replaceProfile,
  saveProfiles,
  scopedStorageKey,
  setActiveProfileId,
  validatePin,
  validateProfileName,
  verifyProfilePin,
} from "./profiles.js";
import {
  TUTORIAL_CHORD_SEQUENCE,
  chordSequenceComplete,
  nextChordProgress,
} from "./tutorial.js";

function registerOfflineApp() {
  if (!import.meta.env.PROD || !window.isSecureContext || !("serviceWorker" in navigator)) return;
  const manifestUrl = new URL(document.querySelector('link[rel="manifest"]').href);
  const serviceWorkerUrl = new URL("sw.js", manifestUrl);
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(serviceWorkerUrl, { scope: "./" }).catch(console.error);
  });
}

registerOfflineApp();

const ARCHIVE_STORAGE_KEY = "music-console-project-v1";
const AUTOSAVE_STORAGE_KEY = "music-console-autosave-v1";
const SONG_SPLIT_STORAGE_KEY = "music-console-song-split-v1";
const LEGACY_MIGRATION_STORAGE_KEY = "music-console-legacy-profile-migration-v1";

const INSTRUMENTS = [
  { id: "melody", label: "旋律", glowColor: "oklch(78% 0.13 95)" },
  { id: "bass", label: "贝斯", glowColor: "oklch(78% 0.13 255)" },
  { id: "chord", label: "和弦", glowColor: "oklch(78% 0.13 335)" },
  { id: "sfx", label: "SFX", glowColor: "oklch(78% 0.13 150)" },
  { id: "drums", label: "鼓", glowColor: "oklch(78% 0.13 25)" },
];
const TRACK_IDS = INSTRUMENTS.map(({ id }) => id);

const appShell = document.querySelector("#app-shell");
const authScreen = document.querySelector("#auth-screen");
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const profileSelect = document.querySelector("#profile-select");
const loginPinInput = document.querySelector("#login-pin");
const registerNameInput = document.querySelector("#register-name");
const registerPinInput = document.querySelector("#register-pin");
const registerPinConfirmInput = document.querySelector("#register-pin-confirm");
const showRegisterButton = document.querySelector("#show-register-button");
const showLoginButton = document.querySelector("#show-login-button");
const authStatus = document.querySelector("#auth-status");
const currentProfileName = document.querySelector("#current-profile-name");
const restartTutorialButton = document.querySelector("#restart-tutorial-button");
const switchProfileButton = document.querySelector("#switch-profile-button");
const exitAppButton = document.querySelector("#exit-app-button");
const tutorialOverlay = document.querySelector("#tutorial-overlay");
const tutorialStepLabel = document.querySelector("#tutorial-step-label");
const tutorialProgressBar = document.querySelector("#tutorial-progress-bar");
const tutorialTitle = document.querySelector("#tutorial-title");
const tutorialBody = document.querySelector("#tutorial-body");
const tutorialChordSequence = document.querySelector("#tutorial-chord-sequence");
const tutorialHint = document.querySelector("#tutorial-hint");
const tutorialPrimaryButton = document.querySelector("#tutorial-primary-button");
const skipTutorialButton = document.querySelector("#skip-tutorial-button");
const performanceView = document.querySelector("#performance-view");
const songSplitHandle = document.querySelector("#song-split-handle");
const surface = document.querySelector("#touch-surface");
const appMenuButton = document.querySelector("#app-menu-button");
const appMenu = document.querySelector("#app-menu");
const clearTrackButton = document.querySelector("#clear-track-button");
const archiveButton = document.querySelector("#archive-button");
const archiveStatus = document.querySelector("#archive-status");
const undoButton = document.querySelector("#undo-button");
const redoButton = document.querySelector("#redo-button");
const autosaveStatus = document.querySelector("#autosave-status");
const topBeatButtons = [...document.querySelectorAll(".top-beat-button[data-beat]")];
const metronomeButton = document.querySelector("#metronome-button");
const releaseTouchesButton = document.querySelector("#release-touches-button");
const glowLayer = document.querySelector("#glow-layer");
const inputLayer = document.querySelector("#touch-input-layer");
const noteStatus = document.querySelector("#note-status");
const functionGrid = document.querySelector("#function-grid");
const scalePanel = document.querySelector("#scale-panel");
const scaleMenuButton = document.querySelector("#scale-menu-button");
const scaleOptions = document.querySelector("#scale-options");
const confirmScaleButton = document.querySelector("#confirm-scale-button");
const tempoPanel = document.querySelector("#tempo-panel");
const tempoButton = document.querySelector("#tempo-button");
const tempoValue = document.querySelector("#tempo-value");
const tempoDeltaButtons = [...document.querySelectorAll("[data-tempo-delta]")];
const tapTempoButton = document.querySelector("#tap-tempo-button");
const confirmTempoButton = document.querySelector("#confirm-tempo-button");
const loopLengthPanel = document.querySelector("#loop-length-panel");
const loopLengthButton = document.querySelector("#loop-length-button");
const loopLengthOptions = document.querySelector("#loop-length-options");
const confirmLoopLengthButton = document.querySelector("#confirm-loop-length-button");
const loopShiftPanel = document.querySelector("#loop-shift-panel");
const loopShiftButton = document.querySelector("#loop-shift-button");
const loopShiftTitle = document.querySelector("#loop-shift-title");
const loopShiftSlider = document.querySelector("#loop-shift-slider");
const loopShiftCoarseButtons = [...document.querySelectorAll("[data-loop-shift]")];
const confirmLoopShiftButton = document.querySelector("#confirm-loop-shift-button");
const instrumentSwitcher = document.querySelector("#instrument-switcher");
const songSectionSwitcher = document.querySelector("#song-section-switcher");
const songArranger = document.querySelector("#song-arranger");
const songTimelineViewport = document.querySelector("#song-timeline-viewport");
const songTimelineContent = document.querySelector("#song-timeline-content");
const songRuler = document.querySelector("#song-ruler");
const songSectionLoopRange = document.querySelector("#song-section-loop-range");
const songSectionLoopStart = document.querySelector("#song-section-loop-start");
const songSectionLoopEnd = document.querySelector("#song-section-loop-end");
const songTrackLanes = document.querySelector("#song-track-lanes");
const songPlayhead = document.querySelector("#song-playhead");
const songClipSplitMarker = document.querySelector("#song-clip-split-marker");
const songLoopLengthGhost = document.querySelector("#song-loop-length-ghost");
const songLoopLengthMarker = document.querySelector("#song-loop-length-marker");
const songClipMenu = document.querySelector("#song-clip-menu");
const lengthSongClipButton = document.querySelector("#length-song-clip-button");
const mergeSongClipButton = document.querySelector("#merge-song-clip-button");
const splitSongClipButton = document.querySelector("#split-song-clip-button");
const deleteSongClipButton = document.querySelector("#delete-song-clip-button");
const songClipSplitActions = document.querySelector("#song-clip-split-actions");
const cancelSongSplitButton = document.querySelector("#cancel-song-split-button");
const confirmSongSplitButton = document.querySelector("#confirm-song-split-button");
const songLoopLengthActions = document.querySelector("#song-loop-length-actions");
const cancelSongLoopLengthButton = document.querySelector("#cancel-song-loop-length-button");
const confirmSongLoopLengthButton = document.querySelector("#confirm-song-loop-length-button");
const songLoopPicker = document.querySelector("#song-loop-picker");
const songLoopPickerList = document.querySelector("#song-loop-picker-list");
const currentInstrumentButton = document.querySelector("#current-instrument-button");
const recordButton = document.querySelector("#record-button");
const playButton = document.querySelector("#play-button");
const eraserButton = document.querySelector("#eraser-button");
const songModeButton = document.querySelector("#song-mode-button");
const songFunctionStrip = document.querySelector("#song-function-strip");
const exitSongModeButton = document.querySelector("#exit-song-mode-button");
const songRecordButton = document.querySelector("#song-record-button");
const songPlayButton = document.querySelector("#song-play-button");
const songEraserButton = document.querySelector("#song-eraser-button");
const eraserButtons = [eraserButton, songEraserButton];
const sectionLengthButton = document.querySelector("#section-length-button");
const songScaleButton = document.querySelector("#song-scale-button");
const songTempoButton = document.querySelector("#song-tempo-button");
const sectionLengthPanel = document.querySelector("#section-length-panel");
const sectionLengthValue = document.querySelector("#section-length-value");
const sectionBaseOptions = document.querySelector("#section-base-options");
const sectionExtraOptions = document.querySelector("#section-extra-options");
const confirmSectionLengthButton = document.querySelector("#confirm-section-length-button");
const synth = new BasicSynth();

let notes = [];
let currentScaleKey = "major";
let currentInstrumentId = "melody";
let tempo = 120;
let recordArmed = false;
let isPlaying = false;
let transportStartedAt = 0;
let lastAbsoluteStep = -1;
let transportFrame = 0;
let lastLivePointerId = null;
let clearConfirmTimer = 0;
let idlePulseFrame = 0;
let idleBeatStartedAt = performance.now();
let metronomeMode = "off";
let lastMetronomeAnchor = null;
let lastMetronomeBeat = null;
let tempoTaps = [];
let idleDrumPatternStartedAt = 0;
let lastIdleDrumAbsoluteStep = null;
let liveVoiceToken = 0;
let activeLiveVoiceId = null;
let fineLoopShift = 0;
let fineLoopShiftDirty = false;
let historyReady = false;
let autosaveTimer = 0;
let persistenceChain = Promise.resolve();
let recordingPhraseDirty = false;
let recordingPhraseInstrumentId = null;
let recordingPhraseTimer = 0;
let eraserHistoryDirty = false;
let lastPopChordId = "I";
let lastPopChordState = null;
let livePopChordVoicingState = null;
let playbackPopChordVoicingState = null;
let isSongMode = false;
let songProject = null;
let songTimelineInteraction = null;
let songSectionLoopInteraction = null;
let songPlaybackRangeState = null;
let songSectionTransitionState = null;
let songSplitInteraction = null;
let songRecordingExpansionState = null;
let lastSongBlankTap = null;
let songClipMenuState = null;
let songLoopPickerState = null;
let songClipSplitState = null;
let songLoopLengthState = null;
let profiles = [];
let activeProfile = null;
let tutorialTarget = null;
let shouldMigrateLegacyHistory = false;

const pointerNotes = new Map();
const pointerPositions = new Map();
const pointerPressOrder = [];
const playbackPoints = new Map();
const playbackStates = new Map();
const tracks = new Map(INSTRUMENTS.map(({ id }) => [id, new Map()]));
const trackLoopBars = new Map(INSTRUMENTS.map(({ id }) => [id, 1]));
const mutedTrackIds = new Set();
const soloTrackIds = new Set();
const glows = new Map();
const eraserPointerIds = new Set();
let eraserKeyboardHeld = false;
let projectHistory = new ProjectHistory({ limit: 256 });

const TUTORIAL_STEPS = [
  {
    title: "用四个和弦完成第一首歌",
    body: "你会亲手演奏并录下 C、G、Am、F。所有操作都发生在真实创作界面中。",
    hint: "大约需要 2 分钟，随时可以跳过或稍后继续。",
    primary: "开始创作",
  },
  {
    title: "先找到和弦轨道",
    body: "点击轨道栏里的「和弦」，演奏区会切换成和弦地图。",
    hint: "闪烁的按钮就是下一步目标。",
    target: () => instrumentSwitcher.querySelector('[data-instrument="chord"]'),
  },
  {
    title: "练习 C → G → Am → F",
    body: "依次触摸演奏区中的 C、G、Am、F。每个和弦都先松手，再触摸下一个。",
    hint: "弹错没关系，从 C 重新开始即可。",
    chords: true,
    target: () => surface,
  },
  {
    title: "准备录制",
    body: "点击「录制」。第一次触摸和弦时，播放会自动开始。",
    hint: "录制按钮亮起后进入下一步。",
    target: () => recordButton,
  },
  {
    title: "录下四和弦循环",
    body: "再次依次演奏 C、G、Am、F，每个和弦保持一会，让它们进入循环。",
    hint: "系统会自动记录你的演奏。",
    chords: true,
    target: () => surface,
  },
  {
    title: "结束录制并试听",
    body: "再次点击「录制」结束录音。循环会继续播放，你可以马上听到自己的作品。",
    hint: "你的第一首四和弦作品已经自动保存。",
    target: () => recordButton,
  },
  {
    title: "第一首歌完成了",
    body: "你已经学会选择和弦、录制和播放循环。以后登录这个用户会直接进入创作界面。",
    hint: "可随时从菜单重新打开新手教程。",
    primary: "完成教程",
  },
];

function activeProjectStorageKey(baseKey) {
  return activeProfile ? scopedStorageKey(baseKey, activeProfile.id) : baseKey;
}

function activeHistorySessionKey() {
  return activeProfile ? `user:${activeProfile.id}` : "active";
}

function migrateLegacyProjectStorage() {
  if (profiles.length !== 1 || localStorage.getItem(LEGACY_MIGRATION_STORAGE_KEY)) return;
  shouldMigrateLegacyHistory = true;
  for (const baseKey of [ARCHIVE_STORAGE_KEY, AUTOSAVE_STORAGE_KEY, SONG_SPLIT_STORAGE_KEY]) {
    const legacyValue = localStorage.getItem(baseKey);
    const userKey = activeProjectStorageKey(baseKey);
    if (legacyValue !== null && localStorage.getItem(userKey) === null) {
      localStorage.setItem(userKey, legacyValue);
    }
  }
  localStorage.setItem(LEGACY_MIGRATION_STORAGE_KEY, activeProfile.id);
}

function showAuthMode(mode) {
  const registering = mode === "register";
  loginForm.hidden = registering;
  registerForm.hidden = !registering;
  showLoginButton.hidden = profiles.length === 0;
  authStatus.textContent = "";
  requestAnimationFrame(() => {
    if (registering) registerNameInput.focus();
    else profileSelect.focus();
  });
}

function updateLoginPinField() {
  const profile = profiles.find(({ id }) => id === profileSelect.value);
  const hasPin = Boolean(profile?.pinHash);
  loginPinInput.value = "";
  loginPinInput.required = hasPin;
  loginPinInput.placeholder = hasPin ? "请输入 4～8 位 PIN" : "该用户没有设置 PIN";
}

function renderProfileOptions() {
  profileSelect.replaceChildren();
  const rememberedId = activeProfileId();
  for (const profile of profiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    option.selected = profile.id === rememberedId;
    profileSelect.append(option);
  }
  updateLoginPinField();
}

function authenticateUser() {
  profiles = loadProfiles();
  renderProfileOptions();
  showAuthMode(profiles.length === 0 ? "register" : "login");

  return new Promise((resolve) => {
    const finish = (profile) => {
      activeProfile = profile;
      setActiveProfileId(profile.id);
      currentProfileName.textContent = profile.name;
      migrateLegacyProjectStorage();
      authScreen.hidden = true;
      appShell.hidden = false;
      resolve(profile);
    };

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const profile = profiles.find(({ id }) => id === profileSelect.value);
      if (!profile) {
        authStatus.textContent = "请选择一个用户";
        return;
      }
      authStatus.textContent = "正在验证…";
      try {
        if (!await verifyProfilePin(profile, loginPinInput.value)) {
          authStatus.textContent = "PIN 不正确";
          loginPinInput.select();
          return;
        }
        finish(profile);
      } catch (error) {
        console.error(error);
        authStatus.textContent = "无法验证用户，请重试";
      }
    });

    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = registerNameInput.value;
      const pin = registerPinInput.value;
      const nameError = validateProfileName(name);
      const pinError = validatePin(pin);
      if (nameError || pinError) {
        authStatus.textContent = nameError || pinError;
        return;
      }
      if (profiles.some((profile) => profile.nameKey === normalizedProfileName(name))) {
        authStatus.textContent = "这个昵称已经存在";
        return;
      }
      if (pin !== registerPinConfirmInput.value) {
        authStatus.textContent = "两次输入的 PIN 不一致";
        return;
      }

      authStatus.textContent = "正在创建本地用户…";
      try {
        const profile = await createProfile(name, pin);
        profiles = [...profiles, profile];
        saveProfiles(profiles);
        finish(profile);
      } catch (error) {
        console.error(error);
        authStatus.textContent = error instanceof RangeError ? error.message : "创建用户失败，请重试";
      }
    });
  });
}

function saveActiveTutorial(progress) {
  if (!activeProfile) return;
  activeProfile = { ...activeProfile, tutorial: normalizeTutorialProgress(progress) };
  profiles = replaceProfile(profiles, activeProfile);
  saveProfiles(profiles);
}

function clearTutorialTarget() {
  tutorialTarget?.classList.remove("tutorial-target");
  tutorialTarget = null;
  for (const region of document.querySelectorAll(".tutorial-chord-target")) {
    region.classList.remove("tutorial-chord-target");
  }
}

function renderTutorial() {
  const progress = normalizeTutorialProgress(activeProfile?.tutorial);
  const stepIndex = Math.min(TUTORIAL_STEPS.length - 1, progress.step);
  const step = TUTORIAL_STEPS[stepIndex];
  tutorialOverlay.hidden = false;
  tutorialStepLabel.textContent = stepIndex === 0
    ? "新手教程 · 准备"
    : `新手教程 · ${stepIndex}/${TUTORIAL_STEPS.length - 1}`;
  tutorialProgressBar.style.width = `${stepIndex / (TUTORIAL_STEPS.length - 1) * 100}%`;
  tutorialTitle.textContent = step.title;
  tutorialBody.textContent = step.body;
  tutorialHint.textContent = step.hint;
  tutorialChordSequence.hidden = !step.chords;
  for (const [index, chip] of [...tutorialChordSequence.children].entries()) {
    chip.classList.toggle("is-complete", index < progress.chordProgress);
    chip.classList.toggle("is-next", index === progress.chordProgress);
  }
  tutorialPrimaryButton.hidden = !step.primary;
  tutorialPrimaryButton.textContent = step.primary ?? "";
  skipTutorialButton.hidden = stepIndex === TUTORIAL_STEPS.length - 1;

  clearTutorialTarget();
  tutorialTarget = step.target?.() ?? null;
  tutorialTarget?.classList.add("tutorial-target");
  if (step.chords) {
    const nextChordId = TUTORIAL_CHORD_SEQUENCE[progress.chordProgress];
    const nextRegion = [...surface.querySelectorAll(".pop-chord-region")]
      .find((region) => region.dataset.chordId === nextChordId);
    nextRegion?.classList.add("tutorial-chord-target");
  }
}

function setTutorialStep(step, { chordProgress = 0 } = {}) {
  saveActiveTutorial({
    ...activeProfile.tutorial,
    version: TUTORIAL_VERSION,
    status: "in-progress",
    step,
    chordProgress,
    completedAt: null,
  });
  renderTutorial();
}

function closeTutorial(status) {
  clearTutorialTarget();
  tutorialOverlay.hidden = true;
  saveActiveTutorial({
    ...activeProfile.tutorial,
    version: TUTORIAL_VERSION,
    status,
    completedAt: status === "completed" ? new Date().toISOString() : null,
  });
  persistAutosaveNow();
}

function beginTutorial() {
  if (isSongMode) exitSongMode();
  if (isPlaying) stopTransport();
  if (recordArmed) toggleRecord();
  setTutorialStep(0);
  setMenuOpen(false);
}

function showPendingTutorial() {
  const progress = normalizeTutorialProgress(activeProfile?.tutorial);
  if (["completed", "skipped"].includes(progress.status)) return;
  if ([4, 5].includes(progress.step) && !recordArmed) {
    saveActiveTutorial({ ...progress, status: "in-progress", step: 3, chordProgress: 0 });
  }
  renderTutorial();
}

function observeTutorialInstrument(instrumentId) {
  if (tutorialOverlay.hidden || instrumentId !== "chord") return;
  if (normalizeTutorialProgress(activeProfile.tutorial).step === 1) setTutorialStep(2);
}

function observeTutorialChord(chordId) {
  if (tutorialOverlay.hidden) return;
  const progress = normalizeTutorialProgress(activeProfile.tutorial);
  if (![2, 4].includes(progress.step)) return;
  if (progress.step === 4 && !recordArmed) return;
  const chordProgress = nextChordProgress(progress.chordProgress, chordId);
  saveActiveTutorial({ ...progress, chordProgress });
  if (chordSequenceComplete(chordProgress)) {
    setTutorialStep(progress.step + 1);
  } else {
    renderTutorial();
  }
}

function observeTutorialRecordState(armed) {
  if (tutorialOverlay.hidden) return;
  const progress = normalizeTutorialProgress(activeProfile.tutorial);
  if (progress.step === 3 && armed) setTutorialStep(4);
  else if (progress.step === 4 && !armed) setTutorialStep(3);
  else if (progress.step === 5 && !armed) setTutorialStep(6);
}

async function switchProfile() {
  persistAutosaveNow();
  await persistenceChain.catch(() => {});
  clearActiveProfileId();
  window.location.reload();
}

async function exitApplication() {
  setMenuOpen(false);
  exitAppButton.disabled = true;
  exitAppButton.textContent = "正在保存并退出…";
  archiveStatus.textContent = "正在保存并退出";
  persistAutosaveNow();
  await persistenceChain.catch(() => {});

  try {
    const response = await fetch("/__music_console__/exit", {
      method: "POST",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Exit request failed: ${response.status}`);
  } catch (error) {
    console.error(error);
    exitAppButton.disabled = false;
    exitAppButton.textContent = "退出应用";
    archiveStatus.textContent = "无法自动退出，请关闭应用窗口";
  }
}

function activateOnPress(button, callback) {
  let lastDirectActivation = -Infinity;
  const directPointers = new Map();

  button.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    directPointers.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: false });
  });

  button.addEventListener("pointermove", (event) => {
    const pointer = directPointers.get(event.pointerId);
    if (!pointer) return;
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10) pointer.moved = true;
  });

  button.addEventListener("pointerup", (event) => {
    const pointer = directPointers.get(event.pointerId);
    directPointers.delete(event.pointerId);
    if (!pointer || pointer.moved) return;
    lastDirectActivation = performance.now();
    callback();
  });

  button.addEventListener("pointercancel", (event) => directPointers.delete(event.pointerId));

  button.addEventListener("click", () => {
    if (performance.now() - lastDirectActivation < 700) return;
    callback();
  });
}

const scaleGroups = new Map();
for (const [value, scale] of Object.entries(SCALES)) {
  let groupGrid = scaleGroups.get(scale.group);
  if (!groupGrid) {
    const section = document.createElement("section");
    section.className = "scale-group";

    const heading = document.createElement("h3");
    heading.textContent = scale.group;

    groupGrid = document.createElement("div");
    groupGrid.className = "scale-group-grid";
    section.append(heading, groupGrid);
    scaleOptions.append(section);
    scaleGroups.set(scale.group, groupGrid);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.scale = value;
  button.textContent = scale.shortLabel ?? scale.label;
  button.setAttribute("aria-label", scale.label);
  button.setAttribute("aria-pressed", "false");
  groupGrid.append(button);
}

const scaleScrollPointers = new Map();
let ignoreScaleClickUntil = -Infinity;

scaleOptions.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;

  const button = event.target.closest("button[data-scale]");
  scaleScrollPointers.set(event.pointerId, {
    button,
    startY: event.clientY,
    lastY: event.clientY,
    moved: false,
  });
  scaleOptions.setPointerCapture(event.pointerId);
});

scaleOptions.addEventListener("pointermove", (event) => {
  const pointer = scaleScrollPointers.get(event.pointerId);
  if (!pointer) return;

  if (Math.abs(event.clientY - pointer.startY) > 8) pointer.moved = true;
  if (pointer.moved) {
    event.preventDefault();
    scaleOptions.scrollTop -= event.clientY - pointer.lastY;
  }
  pointer.lastY = event.clientY;
});

scaleOptions.addEventListener("pointerup", (event) => {
  const pointer = scaleScrollPointers.get(event.pointerId);
  scaleScrollPointers.delete(event.pointerId);
  if (!pointer) return;

  ignoreScaleClickUntil = performance.now() + 700;
  if (!pointer.moved && pointer.button) selectScale(pointer.button.dataset.scale);
});

scaleOptions.addEventListener("pointercancel", (event) => scaleScrollPointers.delete(event.pointerId));

scaleOptions.addEventListener("click", (event) => {
  if (performance.now() < ignoreScaleClickUntil) return;
  const button = event.target.closest("button[data-scale]");
  if (button) selectScale(button.dataset.scale);
});

function noteIndexAtNormalizedX(x) {
  return Math.min(notes.length - 1, Math.floor(x * notes.length));
}

function surfaceIndexAtPoint(point, instrumentId = currentInstrumentId, popChordState = null) {
  if (instrumentId === "drums") return drumPatternIndexAtX(point.x);
  if (instrumentId === "chord") return popChordIndexAtPoint(point, popChordState);
  return noteIndexAtNormalizedX(point.x);
}

function updateActiveRegions() {
  const activeIndexes = new Set();
  const livePoint = currentRecordingPoint();
  if (livePoint) activeIndexes.add(surfaceIndexAtPoint(livePoint, currentInstrumentId, livePopChordVoicingState));
  const playbackPoint = playbackPoints.get(currentInstrumentId);
  if (playbackPoint) activeIndexes.add(surfaceIndexAtPoint(
    playbackPoint,
    currentInstrumentId,
    playbackPopChordVoicingState
  ));

  if (currentInstrumentId === "chord") {
    const activePoint = livePoint ?? playbackPoint;
    const previousState = livePoint ? livePopChordVoicingState : playbackPopChordVoicingState;
    if (activePoint) {
      const chord = popChordAtPoint(activePoint, previousState);
      lastPopChordState = previousState?.chordId === chord.id
        ? previousState
        : nextPopChordVoicingState(previousState, chord);
      lastPopChordId = chord.id;
    }
  }
  const suggestions = new Set(recommendedPopChordIds(lastPopChordId));
  const bassTargets = new Set(recommendedPopBassTargetIds(lastPopChordState));
  const visibleInversions = new Set(availablePopInversionIds(lastPopChordState));
  const hasStrongDirection = POP_STRONG_DIRECTIONAL_IDS.includes(lastPopChordId);
  for (const region of surface.querySelectorAll(".note-region")) {
    const isInversion = region.classList.contains("tier-inversion");
    region.classList.toggle(
      "is-contextual-hidden",
      currentInstrumentId === "chord" && isInversion && !visibleInversions.has(region.dataset.chordId)
    );
    region.classList.toggle("is-active", activeIndexes.has(Number(region.dataset.index)));
    const isBassTarget = currentInstrumentId === "chord" && bassTargets.has(region.dataset.chordId);
    const isSuggested = isBassTarget || (currentInstrumentId === "chord"
      && (suggestions.has(region.dataset.chordId) || suggestions.has(region.dataset.functionId))
    );
    region.classList.toggle("is-suggested", isSuggested);
    region.classList.toggle("is-strong-suggested", isBassTarget || (isSuggested && hasStrongDirection));
  }
}

function renderPopChordRegion(chord, index) {
  const region = document.createElement("div");
  const compactClass = chord.height <= 0.27 / 2 ? " is-compact" : "";
  region.className = `note-region pop-chord-region tier-${chord.tier}${compactClass}`;
  region.dataset.index = String(index);
  region.dataset.chordId = chord.id;
  region.dataset.functionId = chord.functionId;
  region.style.setProperty("--region-x", `${chord.x * 100}%`);
  region.style.setProperty("--region-y", `${chord.y * 100}%`);
  region.style.setProperty("--region-width", `${chord.width * 100}%`);
  region.style.setProperty("--region-height", `${chord.height * 100}%`);
  region.setAttribute("aria-hidden", "true");

  const roman = document.createElement("strong");
  roman.className = "pop-chord-roman";
  roman.textContent = chord.roman;
  const symbol = document.createElement("span");
  symbol.className = "pop-chord-symbol";
  symbol.textContent = chord.symbol;
  const hint = document.createElement("span");
  hint.className = "pop-chord-hint";
  hint.textContent = chord.hint;
  region.append(roman, symbol, hint);
  return region;
}

function renderScale() {
  for (const region of surface.querySelectorAll(".note-region")) region.remove();

  const scale = SCALES[currentScaleKey];
  notes = buildScaleNotes(scale.intervals);
  const regions = document.createDocumentFragment();

  const isPopChordSurface = currentInstrumentId === "chord";
  surface.classList.toggle("is-pop-chord-surface", isPopChordSurface);
  if (isPopChordSurface) {
    POP_CHORD_REGIONS.forEach((chord, index) => regions.append(renderPopChordRegion(chord, index)));
    surface.setAttribute("aria-label", "流行歌和弦触控面板，按位置演奏核心、七和弦、借用和弦与半音连接和弦");
  } else {
    const regionCount = currentInstrumentId === "drums" ? 5 : notes.length;
    Array.from({ length: regionCount }, (_, index) => currentInstrumentId === "drums" ? null : notes[index]).forEach((midi, index) => {
      const region = document.createElement("div");
      const interval = midi === null ? null : (midi - 60) % 12;
      const toneRole = midi === null ? "drum" : getScaleToneRole(currentScaleKey, interval);
      region.className = midi === null
        ? `note-region drum-region intensity-${index + 1}`
        : `note-region role-${toneRole} variant-${index % 2 === 0 ? "a" : "b"}`;
      region.dataset.index = String(index);
      if (midi !== null) region.dataset.midi = String(midi);
      region.dataset.toneRole = toneRole;
      region.setAttribute("aria-hidden", "true");
      regions.append(region);
    });
    surface.setAttribute("aria-label", currentInstrumentId === "drums"
      ? "横向轻触或拖动来选择鼓组强度"
      : "横向轻触或拖动来演奏音高");
  }

  surface.insertBefore(regions, glowLayer);

  for (const [pointerId, point] of pointerPositions) {
    const index = surfaceIndexAtPoint(point, currentInstrumentId, livePopChordVoicingState);
    pointerNotes.set(pointerId, index);
    if (pointerId === lastLivePointerId && currentInstrumentId !== "drums" && activeLiveVoiceId) {
      synth.change(activeLiveVoiceId, noteAtPoint(point, currentInstrumentId, "live").midi);
    }
  }
  for (const [instrumentId, point] of playbackPoints) {
    if (instrumentId !== "drums") {
      synth.change(`loop:${instrumentId}`, noteAtPoint(point, instrumentId, "playback").midi);
    }
  }

  if (isPopChordSurface) {
    scaleMenuButton.textContent = "流行歌";
    scaleMenuButton.dataset.chordPreset = "true";
    scaleMenuButton.disabled = true;
    scaleMenuButton.setAttribute("aria-label", "和弦预设：流行歌（C 大调）");
    scaleMenuButton.setAttribute("aria-disabled", "true");
  } else {
    scaleMenuButton.textContent = scale.shortLabel ?? scale.label;
    delete scaleMenuButton.dataset.chordPreset;
    scaleMenuButton.disabled = false;
    scaleMenuButton.setAttribute("aria-label", `音阶：${scale.label}`);
    scaleMenuButton.setAttribute("aria-disabled", "false");
  }
  songScaleButton.textContent = scale.shortLabel ?? scale.label;
  for (const button of scaleOptions.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.scale === currentScaleKey));
  }
  updateActiveRegions();
  noteStatus.textContent = pointerNotes.size
    ? "正在演奏"
    : isPopChordSurface
      ? `流行歌 · C 大调 · ${POP_CHORD_REGIONS.length} 个和弦区`
      : `${scale.label} · ${notes.length} 个音区`;
}

function selectScale(scaleKey) {
  if (scaleKey === currentScaleKey) return;
  finishRecordingPhrase();
  currentScaleKey = scaleKey;
  renderScale();
  recordHistoryState("更改音阶");
}

function openScalePanel() {
  (isSongMode ? songFunctionStrip : functionGrid).hidden = true;
  appShell.classList.toggle("is-song-setting-open", isSongMode);
  scalePanel.hidden = false;
}

function openSettingPanel(panel) {
  (isSongMode ? songFunctionStrip : functionGrid).hidden = true;
  appShell.classList.toggle("is-song-setting-open", isSongMode);
  panel.hidden = false;
}

function closePanel(panel, trigger) {
  panel.hidden = true;
  (isSongMode ? songFunctionStrip : functionGrid).hidden = false;
  appShell.classList.remove("is-song-setting-open");
  trigger.focus({ preventScroll: true });
  if (isSongMode) songFunctionStrip.scrollLeft = 0;
}

function replacePerformanceLoopsFromSong() {
  const selected = selectedPerformanceLoops(ensureSongProject(), songProject.currentSectionId, TRACK_IDS);
  for (const trackId of TRACK_IDS) {
    const track = tracks.get(trackId);
    track.clear();
    for (const [step, point] of selected.tracks.get(trackId)) track.set(step, point);
    trackLoopBars.set(trackId, selected.trackLoopBars.get(trackId));
    stopPlaybackVoice(trackId);
  }
  updateRecordedStepCount();
  updateInstrumentButtons();
  updateLoopLengthControls();
}

function updateSongOverflowHint() {
  if (!isSongMode) return;
  const remaining = songTimelineViewport.scrollWidth
    - songTimelineViewport.clientWidth
    - songTimelineViewport.scrollLeft;
  songArranger.dataset.overflowRight = String(remaining > 1);
}

function updateSongTimelineMetrics() {
  const viewportWidth = songTimelineViewport.clientWidth;
  if (viewportWidth > 0) {
    songTimelineContent.style.setProperty("--song-bar-width", `${viewportWidth / 16}px`);
  }
  updateSongOverflowHint();
}

function songSplitAvailableHeight() {
  const shellStyle = getComputedStyle(appShell);
  const contentHeight = appShell.clientHeight
    - Number.parseFloat(shellStyle.paddingTop)
    - Number.parseFloat(shellStyle.paddingBottom);
  const flowChildren = [...appShell.children].filter((element) => {
    if (element.hidden || element === performanceView || element === songArranger) return false;
    return getComputedStyle(element).position !== "absolute";
  });
  const fixedHeight = flowChildren.reduce(
    (total, element) => total + element.getBoundingClientRect().height,
    0
  );
  const visibleFlowCount = flowChildren.length + 2;
  const gapsHeight = Math.max(0, visibleFlowCount - 1) * Number.parseFloat(shellStyle.rowGap);
  return Math.max(0, contentHeight - fixedHeight - gapsHeight);
}

function songSplitLimits(availableHeight) {
  const minimumPerformanceHeight = Math.min(140, availableHeight * 0.42);
  const minimumArrangerHeight = Math.min(120, availableHeight * 0.36);
  return {
    minimum: minimumPerformanceHeight,
    maximum: Math.max(minimumPerformanceHeight, availableHeight - minimumArrangerHeight),
  };
}

function storedSongSplitRatio() {
  try {
    const ratio = Number(localStorage.getItem(activeProjectStorageKey(SONG_SPLIT_STORAGE_KEY)));
    return Number.isFinite(ratio) && ratio >= 0.2 && ratio <= 0.8 ? ratio : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function persistSongSplitRatio() {
  try {
    localStorage.setItem(
      activeProjectStorageKey(SONG_SPLIT_STORAGE_KEY),
      String(ensureSongProject().arrangerSplitRatio)
    );
  } catch (error) {
    console.error(error);
  }
}

function setSongSplitHeight(height, availableHeight = songSplitAvailableHeight()) {
  if (availableHeight <= 0) return;
  const { minimum, maximum } = songSplitLimits(availableHeight);
  const nextHeight = Math.min(maximum, Math.max(minimum, height));
  appShell.style.setProperty("--song-performance-height", `${nextHeight.toFixed(1)}px`);
  const percent = Math.round(nextHeight / availableHeight * 100);
  songSplitHandle.setAttribute("aria-valuenow", String(percent));
  songSplitHandle.setAttribute("aria-valuetext", `演奏区占 ${percent}%`);
  requestAnimationFrame(updateSongTimelineMetrics);
}

function applySongSplitRatio() {
  if (!isSongMode || songSplitHandle.hidden) return;
  const availableHeight = songSplitAvailableHeight();
  setSongSplitHeight(availableHeight * ensureSongProject().arrangerSplitRatio, availableHeight);
}

function updateSongSplitFromPointer(event) {
  if (!songSplitInteraction || event.pointerId !== songSplitInteraction.pointerId) return;
  event.preventDefault();
  const desiredHeight = songSplitInteraction.startHeight + event.clientY - songSplitInteraction.startY;
  const { minimum, maximum } = songSplitLimits(songSplitInteraction.availableHeight);
  const nextHeight = Math.min(maximum, Math.max(minimum, desiredHeight));
  songProject.arrangerSplitRatio = nextHeight / songSplitInteraction.availableHeight;
  setSongSplitHeight(nextHeight, songSplitInteraction.availableHeight);
}

function finishSongSplitInteraction(event) {
  if (!songSplitInteraction || (event && event.pointerId !== songSplitInteraction.pointerId)) return;
  const pointerId = songSplitInteraction.pointerId;
  songSplitInteraction = null;
  songSplitHandle.dataset.dragging = "false";
  if (songSplitHandle.hasPointerCapture?.(pointerId)) songSplitHandle.releasePointerCapture(pointerId);
  persistSongSplitRatio();
  scheduleAutosave();
}

function createSongClipElement(trackId, clip, totalBars) {
  const loop = songLoopById(songProject, trackId, clip.loopId);
  const selected = selectedSongClip(songProject, songProject.currentSectionId, trackId)?.id === clip.id;
  const element = document.createElement("div");
  element.className = "song-clip";
  element.dataset.clipId = clip.id;
  element.dataset.loopId = clip.loopId;
  element.dataset.trackId = trackId;
  element.dataset.partialEnd = String((clip.sourceOffsetBars + clip.lengthBars) % loop.bars !== 0);
  element.setAttribute("role", "button");
  element.setAttribute("tabindex", "0");
  element.setAttribute("aria-pressed", String(selected));
  element.setAttribute(
    "aria-label",
    `${instrumentById(trackId).label} Loop ${loop.number}，第 ${clip.startBar + 1} 小节开始，${clip.lengthBars} 小节，源位置第 ${clip.sourceOffsetBars + 1} 小节`
  );
  element.style.left = `${clip.startBar / totalBars * 100}%`;
  element.style.width = `${clip.lengthBars / totalBars * 100}%`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "song-clip-chart");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "song-clip-path");
  path.setAttribute("d", songClipPathData(loop, clip.lengthBars, clip.sourceOffsetBars));
  svg.append(path);

  const cycles = document.createElement("span");
  cycles.className = "song-clip-cycles";
  let bar = 0;
  let sourceBar = clip.sourceOffsetBars;
  while (bar < clip.lengthBars) {
    const barsUntilSourceEnd = loop.bars - sourceBar;
    const cycleBars = Math.min(barsUntilSourceEnd, clip.lengthBars - bar);
    const cycle = document.createElement("span");
    cycle.className = `song-clip-cycle${cycleBars < barsUntilSourceEnd ? " is-partial" : ""}`;
    cycle.style.left = `${bar / clip.lengthBars * 100}%`;
    cycle.style.width = `${cycleBars / clip.lengthBars * 100}%`;
    cycles.append(cycle);
    bar += cycleBars;
    sourceBar = 0;
  }

  const number = document.createElement("span");
  number.className = "song-loop-number";
  number.textContent = String(loop.number);

  const startResizeHandle = document.createElement("span");
  startResizeHandle.className = "song-clip-resize is-start";
  startResizeHandle.dataset.resizeStartHandle = "true";
  const endResizeHandle = document.createElement("span");
  endResizeHandle.className = "song-clip-resize is-end";
  endResizeHandle.dataset.resizeEndHandle = "true";
  element.append(cycles, svg, number, startResizeHandle, endResizeHandle);
  return element;
}

function closeSongClipSplitEditor() {
  songClipSplitState = null;
  songClipSplitMarker.hidden = true;
  songClipSplitActions.hidden = true;
}

function positionSongClipEditorActions(actions, clipElement) {
  const arrangerBounds = songArranger.getBoundingClientRect();
  const clipBounds = clipElement.getBoundingClientRect();
  const width = actions.offsetWidth;
  const height = actions.offsetHeight;
  const left = Math.min(
    arrangerBounds.width - width - 4,
    Math.max(4, clipBounds.left - arrangerBounds.left + clipBounds.width / 2 - width / 2)
  );
  const top = Math.max(2, clipBounds.top - arrangerBounds.top - height - 3);
  actions.style.left = `${left}px`;
  actions.style.top = `${top}px`;
}

function renderSongClipSplitEditor() {
  if (!songClipSplitState) return;
  const { trackId, clipId, splitBar } = songClipSplitState;
  const clipElement = [...songTrackLanes.querySelectorAll(".song-clip")]
    .find((element) => element.dataset.trackId === trackId && element.dataset.clipId === clipId);
  const clip = currentSongSection(songProject).tracks[trackId].clips
    .find((candidate) => candidate.id === clipId);
  if (!clipElement || !clip) {
    closeSongClipSplitEditor();
    return;
  }
  const totalBars = sectionBars(currentSongSection(songProject));
  const contentBounds = songTimelineContent.getBoundingClientRect();
  const clipBounds = clipElement.getBoundingClientRect();
  songClipSplitMarker.style.left = `${splitBar / totalBars * 100}%`;
  songClipSplitMarker.style.top = `${clipBounds.top - contentBounds.top}px`;
  songClipSplitMarker.style.height = `${clipBounds.height}px`;
  songClipSplitMarker.setAttribute("aria-valuemin", String(clip.startBar + 2));
  songClipSplitMarker.setAttribute("aria-valuemax", String(clip.startBar + clip.lengthBars));
  songClipSplitMarker.setAttribute("aria-valuenow", String(splitBar + 1));
  songClipSplitMarker.setAttribute("aria-valuetext", `第 ${splitBar + 1} 小节处分割`);
  songClipSplitMarker.hidden = false;
  songClipSplitActions.hidden = false;
  positionSongClipEditorActions(songClipSplitActions, clipElement);
}

function hideSongLoopLengthEditor() {
  songLoopLengthMarker.hidden = true;
  songLoopLengthGhost.hidden = true;
  songLoopLengthActions.hidden = true;
}

function renderSongLoopLengthEditor() {
  if (!songLoopLengthState) {
    hideSongLoopLengthEditor();
    return;
  }
  const { edit, preview } = songLoopLengthState;
  const clipElement = [...songTrackLanes.querySelectorAll(".song-clip")]
    .find((element) => element.dataset.trackId === edit.trackId && element.dataset.clipId === edit.clipId);
  const clip = currentSongSection(songProject).tracks[edit.trackId].clips
    .find((candidate) => candidate.id === edit.clipId);
  if (!clipElement || !clip || !preview) {
    hideSongLoopLengthEditor();
    return;
  }

  const totalBars = sectionBars(currentSongSection(songProject));
  const contentBounds = songTimelineContent.getBoundingClientRect();
  const clipBounds = clipElement.getBoundingClientRect();
  songLoopLengthMarker.style.left = `${preview.handleBar / totalBars * 100}%`;
  songLoopLengthMarker.style.top = `${clipBounds.top - contentBounds.top}px`;
  songLoopLengthMarker.style.height = `${clipBounds.height}px`;
  songLoopLengthMarker.setAttribute("aria-valuemin", "1");
  songLoopLengthMarker.setAttribute("aria-valuemax", String(MAX_LOOP_BARS));
  songLoopLengthMarker.setAttribute("aria-valuenow", String(preview.loopBars));
  songLoopLengthMarker.setAttribute("aria-valuetext", `${preview.loopBars} 小节`);
  songLoopLengthMarker.hidden = false;

  if (preview.blocked) {
    const ghostEndBar = Math.min(totalBars, preview.ghostEndBar);
    songLoopLengthGhost.dataset.trackId = edit.trackId;
    songLoopLengthGhost.style.left = `${preview.ghostStartBar / totalBars * 100}%`;
    songLoopLengthGhost.style.width = `${Math.max(0, ghostEndBar - preview.ghostStartBar) / totalBars * 100}%`;
    songLoopLengthGhost.style.top = `${clipBounds.top - contentBounds.top}px`;
    songLoopLengthGhost.style.height = `${clipBounds.height}px`;
    songLoopLengthGhost.hidden = false;
  } else {
    songLoopLengthGhost.hidden = true;
  }

  songLoopLengthActions.hidden = false;
  positionSongClipEditorActions(songLoopLengthActions, clipElement);
}

function renderSongSectionLoopRange() {
  const section = currentSongSection(ensureSongProject());
  const totalBars = sectionBars(section);
  const range = sectionLoopRange(section);
  songSectionLoopRange.style.left = `${range.startBar / totalBars * 100}%`;
  songSectionLoopRange.style.width = `${range.lengthBars / totalBars * 100}%`;
  songSectionLoopRange.setAttribute(
    "aria-label",
    `Section 循环：第 ${range.startBar + 1} 至第 ${range.endBar} 小节`
  );
  songSectionLoopStart.setAttribute("aria-valuemin", "1");
  songSectionLoopStart.setAttribute("aria-valuemax", String(range.endBar));
  songSectionLoopStart.setAttribute("aria-valuenow", String(range.startBar + 1));
  songSectionLoopStart.setAttribute("aria-valuetext", `第 ${range.startBar + 1} 小节开始`);
  songSectionLoopEnd.setAttribute("aria-valuemin", String(range.startBar + 1));
  songSectionLoopEnd.setAttribute("aria-valuemax", String(totalBars));
  songSectionLoopEnd.setAttribute("aria-valuenow", String(range.endBar));
  songSectionLoopEnd.setAttribute("aria-valuetext", `第 ${range.endBar} 小节结束`);
}

function renderSongTimeline({ resetScroll = false } = {}) {
  const section = currentSongSection(ensureSongProject());
  const totalBars = sectionBars(section);
  songTimelineContent.style.width = `${Math.max(100, totalBars / 16 * 100)}%`;

  const rulerMarks = [];
  for (let bar = 0; bar < totalBars; bar += 4) {
    const mark = document.createElement("span");
    mark.className = "song-ruler-mark";
    mark.style.left = `${bar / totalBars * 100}%`;
    mark.textContent = String(bar + 1);
    rulerMarks.push(mark);
  }
  songRuler.replaceChildren(songSectionLoopRange, ...rulerMarks);
  renderSongSectionLoopRange();

  const lanes = TRACK_IDS.map((trackId) => {
    const lane = document.createElement("div");
    lane.className = `song-track-lane${trackId === currentInstrumentId ? " is-active" : ""}`;
    lane.dataset.trackId = trackId;
    lane.setAttribute("role", "group");
    lane.setAttribute("aria-label", instrumentById(trackId).label);
    const clips = section.tracks[trackId].clips.map((clip) => createSongClipElement(trackId, clip, totalBars));
    lane.replaceChildren(...clips);
    return lane;
  });
  songTrackLanes.replaceChildren(...lanes);
  if (resetScroll) songTimelineViewport.scrollLeft = 0;
  renderSongClipSplitEditor();
  renderSongLoopLengthEditor();
  updateSongTimelineMetrics();
  requestAnimationFrame(updateSongTimelineMetrics);
}

function updateSongLoopClipCharts(trackId, loopId) {
  if (!isSongMode) return;
  const section = currentSongSection(songProject);
  const clipsById = new Map(section.tracks[trackId].clips.map((clip) => [clip.id, clip]));
  const loop = songLoopById(songProject, trackId, loopId);
  if (!loop) return;
  for (const element of songTrackLanes.querySelectorAll(
    `.song-clip[data-track-id="${trackId}"][data-loop-id="${loopId}"]`
  )) {
    const clip = clipsById.get(element.dataset.clipId);
    const path = element.querySelector(".song-clip-path");
    if (path && clip) path.setAttribute("d", songClipPathData(loop, clip.lengthBars, clip.sourceOffsetBars));
  }
}

function updateSongActiveTrackVisuals() {
  if (!isSongMode) return;
  for (const lane of songTrackLanes.querySelectorAll(".song-track-lane")) {
    lane.classList.toggle("is-active", lane.dataset.trackId === currentInstrumentId);
  }
}

function closeSongClipMenu() {
  songClipMenu.hidden = true;
  songClipMenuState = null;
}

function closeSongLoopPicker() {
  if (songLoopPickerState?.scrollTimer) clearTimeout(songLoopPickerState.scrollTimer);
  songLoopPicker.hidden = true;
  songLoopPickerState = null;
}

function syncSongLoopLengthToPerformance(edit) {
  const selected = selectedSongLoop(songProject, songProject.currentSectionId, edit.trackId);
  const loop = songLoopById(songProject, edit.trackId, edit.loopId);
  if (!selected || !loop || selected.id !== loop.id) return;
  const track = tracks.get(edit.trackId);
  track.clear();
  for (const [step, point] of Object.entries(loop.points)) track.set(Number(step), point);
  trackLoopBars.set(edit.trackId, loop.bars);
  updateLoopLengthControls(edit.trackId);
  updateInstrumentButtons();
  updateTrackLoopChart(edit.trackId);
}

function updateArrangedSongLoopLength(loopBars) {
  if (!songLoopLengthState) return false;
  const preview = previewSongLoopLengthEdit(songProject, songLoopLengthState.edit, loopBars);
  if (!preview) return false;
  songLoopLengthState.preview = preview;
  syncSongLoopLengthToPerformance(songLoopLengthState.edit);
  renderSongTimeline();
  return true;
}

function cancelArrangedSongLoopLength({ render = true } = {}) {
  if (!songLoopLengthState) return false;
  const { edit } = songLoopLengthState;
  cancelSongLoopLengthEdit(songProject, edit);
  songLoopLengthState = null;
  hideSongLoopLengthEditor();
  syncSongLoopLengthToPerformance(edit);
  if (render) renderSongTimeline();
  return true;
}

function confirmArrangedSongLoopLength() {
  if (!songLoopLengthState) return;
  const { edit, preview } = songLoopLengthState;
  const changed = preview.loopBars !== edit.originalLoopBars
    || preview.clipLengthBars !== edit.originalClipLengthBars;
  songLoopLengthState = null;
  hideSongLoopLengthEditor();
  syncSongLoopLengthToPerformance(edit);
  renderSongTimeline();
  if (changed) recordHistoryState("更改 Song Loop 长度");
}

function openSongLoopLengthEditor() {
  if (!songClipMenuState) return;
  const { trackId, clipId } = songClipMenuState;
  const edit = beginSongLoopLengthEdit(songProject, songProject.currentSectionId, trackId, clipId);
  if (!edit) return;
  closeSongClipSplitEditor();
  closeSongClipMenu();
  const preview = previewSongLoopLengthEdit(songProject, edit, edit.originalLoopBars);
  songLoopLengthState = { edit, preview, pointerId: null };
  syncSongLoopLengthToPerformance(edit);
  renderSongTimeline();
}

function openSongClipMenu(trackId, clipId) {
  cancelArrangedSongLoopLength();
  closeSongLoopPicker();
  closeSongClipSplitEditor();
  const element = [...songTrackLanes.querySelectorAll(".song-clip")]
    .find((clip) => clip.dataset.trackId === trackId && clip.dataset.clipId === clipId);
  if (!element) return;
  const arrangement = currentSongSection(songProject).tracks[trackId];
  const clip = arrangement.clips.find((candidate) => candidate.id === clipId);
  const nextClip = nextAdjacentSongClip(songProject, songProject.currentSectionId, trackId, clipId);
  songClipMenuState = { trackId, clipId };
  mergeSongClipButton.hidden = !nextClip;
  mergeSongClipButton.disabled = Boolean(nextClip && clip.lengthBars + nextClip.lengthBars > MAX_LOOP_BARS);
  mergeSongClipButton.setAttribute("aria-label", mergeSongClipButton.disabled
    ? "无法合并：合并后会超过 16 小节"
    : "与紧接着的下一个 Loop 合并");
  splitSongClipButton.disabled = clip.lengthBars < 2;
  songClipMenu.hidden = false;
  const arrangerBounds = songArranger.getBoundingClientRect();
  const clipBounds = element.getBoundingClientRect();
  const menuWidth = songClipMenu.offsetWidth;
  const menuHeight = songClipMenu.offsetHeight;
  const left = Math.min(
    arrangerBounds.width - menuWidth - 4,
    Math.max(4, clipBounds.left - arrangerBounds.left + clipBounds.width / 2 - menuWidth / 2)
  );
  const top = Math.max(2, clipBounds.top - arrangerBounds.top - menuHeight - 3);
  songClipMenu.style.left = `${left}px`;
  songClipMenu.style.top = `${top}px`;
}

function mergeArrangedSongClip() {
  if (!songClipMenuState) return;
  const { trackId, clipId } = songClipMenuState;
  const merged = mergeSongClipWithNext(songProject, songProject.currentSectionId, trackId, clipId);
  if (!merged) return;
  closeSongClipMenu();
  replacePerformanceLoopsFromSong();
  renderSongTimeline();
  recordHistoryState("合并 Song Loop");
}

function openSongClipSplitEditor() {
  if (!songClipMenuState) return;
  const { trackId, clipId } = songClipMenuState;
  const clip = currentSongSection(songProject).tracks[trackId].clips
    .find((candidate) => candidate.id === clipId);
  if (!clip || clip.lengthBars < 2) return;
  cancelArrangedSongLoopLength({ render: false });
  const splitBar = clip.startBar + Math.floor(clip.lengthBars / 2);
  closeSongClipMenu();
  songClipSplitState = { trackId, clipId, splitBar, pointerId: null };
  renderSongClipSplitEditor();
}

function confirmArrangedSongClipSplit() {
  if (!songClipSplitState) return;
  const { trackId, clipId, splitBar } = songClipSplitState;
  const split = splitSongClip(songProject, songProject.currentSectionId, trackId, clipId, splitBar);
  if (!split) return;
  closeSongClipSplitEditor();
  renderSongTimeline();
  recordHistoryState("分割 Song Loop");
}

function deleteArrangedSongClip() {
  if (!songClipMenuState) return;
  const { trackId, clipId } = songClipMenuState;
  closeSongClipMenu();
  if (!deleteSongClip(songProject, songProject.currentSectionId, trackId, clipId)) return;
  replacePerformanceLoopsFromSong();
  renderSongTimeline();
  recordHistoryState("删除 Song Loop 摆放");
}

function updateLoopPickerSelection(loopId) {
  if (!songLoopPickerState) return;
  songLoopPickerState.loopId = loopId;
  for (const option of songLoopPickerList.querySelectorAll(".song-loop-picker-option")) {
    option.setAttribute("aria-selected", String(option.dataset.loopId === loopId));
  }
}

function updateLoopPickerSelectionFromScroll() {
  if (!songLoopPickerState) return;
  const bounds = songLoopPickerList.getBoundingClientRect();
  const center = bounds.top + bounds.height / 2;
  const options = [...songLoopPickerList.querySelectorAll(".song-loop-picker-option")];
  const closest = options.sort((first, second) => {
    const firstBounds = first.getBoundingClientRect();
    const secondBounds = second.getBoundingClientRect();
    return Math.abs(firstBounds.top + firstBounds.height / 2 - center)
      - Math.abs(secondBounds.top + secondBounds.height / 2 - center);
  })[0];
  if (closest) updateLoopPickerSelection(closest.dataset.loopId);
}

function createLoopPickerOption(trackId, loop) {
  const button = document.createElement("button");
  button.className = "song-loop-picker-option";
  button.type = "button";
  button.dataset.trackId = trackId;
  button.dataset.loopId = loop.id;
  button.setAttribute("role", "option");
  button.setAttribute("aria-label", `${instrumentById(trackId).label} Loop ${loop.number}`);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "song-clip-path");
  path.setAttribute("d", songClipPathData(loop, loop.bars));
  svg.append(path);

  const number = document.createElement("span");
  number.className = "song-loop-number";
  number.textContent = String(loop.number);
  button.append(svg, number);
  return button;
}

function centerLoopPickerOption(option, behavior = "smooth") {
  const top = option.offsetTop - (songLoopPickerList.clientHeight - option.offsetHeight) / 2;
  songLoopPickerList.scrollTo({ top, behavior });
}

function openSongLoopPicker(trackId, bar) {
  cancelArrangedSongLoopLength({ render: false });
  closeSongClipMenu();
  const loops = songProject.loopsByTrack[trackId];
  if (!loops?.length) return;
  const selected = selectedSongLoop(songProject, songProject.currentSectionId, trackId) ?? loops[0];
  songLoopPickerState = { trackId, bar, loopId: selected.id, scrollTimer: 0 };
  songLoopPickerList.replaceChildren(...loops.map((loop) => createLoopPickerOption(trackId, loop)));
  updateLoopPickerSelection(selected.id);
  songLoopPicker.hidden = false;
  requestAnimationFrame(() => {
    const option = [...songLoopPickerList.querySelectorAll(".song-loop-picker-option")]
      .find((candidate) => candidate.dataset.loopId === selected.id);
    if (option) centerLoopPickerOption(option, "auto");
  });
}

function placePickedSongLoop() {
  if (!songLoopPickerState) return false;
  const { trackId, bar, loopId } = songLoopPickerState;
  const clip = placeSongLoopAt(songProject, songProject.currentSectionId, trackId, loopId, bar);
  if (!clip) return false;
  closeSongLoopPicker();
  replacePerformanceLoopsFromSong();
  renderSongTimeline();
  recordHistoryState("摆放 Song Loop");
  return true;
}

function updateSectionLengthControls() {
  const section = currentSongSection(ensureSongProject());
  const totalBars = sectionBars(section);
  sectionLengthButton.textContent = `${totalBars} 小节`;
  sectionLengthButton.setAttribute("aria-label", `段落长度：${totalBars} 小节`);
  sectionLengthValue.textContent = `${totalBars} 小节`;
  for (const button of sectionBaseOptions.querySelectorAll("button[data-section-base]")) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.sectionBase) === section.baseBars));
  }
  for (const button of sectionExtraOptions.querySelectorAll("button[data-section-extra]")) {
    button.setAttribute("aria-pressed", String(section.extraBars.includes(Number(button.dataset.sectionExtra))));
  }
}

function clearSongSectionButtonPulse(button) {
  button.classList.remove("is-queued-beat-active");
  button.style.removeProperty("background-color");
  button.style.removeProperty("border-color");
  button.style.removeProperty("box-shadow");
  button.style.removeProperty("color");
}

function renderSongSectionSwitcher() {
  const section = currentSongSection(ensureSongProject());
  for (const button of songSectionSwitcher.querySelectorAll("button[data-section]")) {
    const queued = songSectionTransitionState?.targetSectionId === button.dataset.section;
    button.setAttribute("aria-pressed", String(button.dataset.section === section.id));
    button.dataset.queued = String(queued);
    button.setAttribute("aria-label", queued
      ? `${button.textContent}，已预备，将在下一小节切换`
      : button.textContent);
    if (!queued) clearSongSectionButtonPulse(button);
  }
}

function updateQueuedSongSectionPulse(now) {
  const queuedSectionId = isSongMode && isPlaying
    ? songSectionTransitionState?.targetSectionId
    : null;
  for (const button of songSectionSwitcher.querySelectorAll("button[data-section]")) {
    if (!queuedSectionId || button.dataset.section !== queuedSectionId) {
      clearSongSectionButtonPulse(button);
      continue;
    }
    const intensity = rhythmicEnvelopeAt(now, transportStartedAt, tempo);
    const background = Math.round(48 + (232 - 48) * intensity);
    const foreground = Math.round(244 - (244 - 24) * intensity);
    const border = Math.round(114 + 141 * intensity);
    button.classList.toggle("is-queued-beat-active", intensity > 0.001);
    button.style.backgroundColor = `rgb(${background} ${background} ${background})`;
    button.style.borderColor = `rgb(${border} ${border} ${border})`;
    button.style.boxShadow = intensity > 0.001
      ? `0 0 ${Math.max(1, 13 * intensity).toFixed(2)}px ${(2.4 * intensity).toFixed(2)}px rgb(255 255 255 / ${(0.68 * intensity).toFixed(3)})`
      : "none";
    button.style.color = `rgb(${foreground} ${foreground} ${foreground})`;
  }
}

function renderSongMode(options) {
  ensureSongProject();
  renderSongSectionSwitcher();
  songScaleButton.textContent = SCALES[currentScaleKey].shortLabel ?? SCALES[currentScaleKey].label;
  songTempoButton.textContent = `${tempo} BPM`;
  updateSectionLengthControls();
  renderSongTimeline(options);
}

function applyWorkspaceModeLayout(nextIsSongMode, { resetScroll = false } = {}) {
  songSectionTransitionState = null;
  cancelArrangedSongLoopLength({ render: false });
  closeSongClipMenu();
  closeSongLoopPicker();
  closeSongClipSplitEditor();
  for (const panel of [scalePanel, tempoPanel, loopLengthPanel, loopShiftPanel, sectionLengthPanel]) {
    panel.hidden = true;
  }
  appShell.classList.remove("is-song-setting-open");
  performanceView.hidden = false;
  isSongMode = nextIsSongMode;

  if (isSongMode) {
    appShell.classList.add("is-song-mode");
    instrumentSwitcher.hidden = true;
    functionGrid.hidden = true;
    songSplitHandle.hidden = false;
    songArranger.hidden = false;
    songSectionSwitcher.hidden = false;
    songFunctionStrip.hidden = false;
    songFunctionStrip.scrollLeft = 0;
    renderSongMode({ resetScroll });
    requestAnimationFrame(applySongSplitRatio);
    return;
  }

  appShell.classList.remove("is-song-mode");
  songSplitHandle.hidden = true;
  songArranger.hidden = true;
  songSectionSwitcher.hidden = true;
  songFunctionStrip.hidden = true;
  instrumentSwitcher.hidden = false;
  functionGrid.hidden = false;
  renderScale();
  updateInstrumentButtons();
}

function enterSongMode() {
  if (isSongMode) return;
  finishRecordingPhrase();
  finishEraserHistory();
  stopTransport();
  const song = ensureSongProject();
  song.arrangerSplitRatio = storedSongSplitRatio() ?? song.arrangerSplitRatio;
  syncPerformanceLoopsToSong(song, song.currentSectionId, tracks, trackLoopBars);
  applyWorkspaceModeLayout(true, { resetScroll: true });
  recordHistoryState("切换至 Song Mode");
}

function exitSongMode() {
  if (!isSongMode) return;
  stopTransport();
  cancelArrangedSongLoopLength({ render: false });
  replacePerformanceLoopsFromSong();
  applyWorkspaceModeLayout(false);
  recordHistoryState("切换至 Loop Mode");
}

function selectSongSection(sectionId) {
  const song = ensureSongProject();
  if (!song.sections[sectionId]) return;
  if (isSongMode && isPlaying) {
    if (song.currentSectionId === sectionId) {
      songSectionTransitionState = null;
      renderSongSectionSwitcher();
      return;
    }
    const now = performance.now();
    const transportStep = (now - transportStartedAt) / stepDurationMs(tempo);
    const transition = songSectionTransitionAtNextBar(
      song,
      sectionId,
      transportStep,
      songPlaybackStepAt(transportStep)
    );
    if (!transition) return;
    cancelArrangedSongLoopLength({ render: false });
    closeSongClipMenu();
    closeSongLoopPicker();
    closeSongClipSplitEditor();
    songSectionTransitionState = transition;
    renderSongSectionSwitcher();
    updateQueuedSongSectionPulse(now);
    return;
  }
  songSectionTransitionState = null;
  renderSongSectionSwitcher();
  if (song.currentSectionId === sectionId) return;
  cancelArrangedSongLoopLength({ render: false });
  closeSongClipMenu();
  closeSongLoopPicker();
  closeSongClipSplitEditor();
  stopTransport();
  syncPerformanceLoopsToSong(song, song.currentSectionId, tracks, trackLoopBars);
  song.currentSectionId = sectionId;
  replacePerformanceLoopsFromSong();
  renderSongMode({ resetScroll: true });
  scheduleAutosave();
}

function selectArrangedClip(trackId, clipId, { record = true } = {}) {
  cancelArrangedSongLoopLength({ render: false });
  const changed = selectSongClip(songProject, songProject.currentSectionId, trackId, clipId);
  if (!changed) return false;
  replacePerformanceLoopsFromSong();
  renderSongTimeline();
  if (record) recordHistoryState("选择 Song Loop");
  return true;
}

function deselectArrangedClip(trackId, { record = true } = {}) {
  cancelArrangedSongLoopLength({ render: false });
  closeSongClipMenu();
  closeSongClipSplitEditor();
  const changed = deselectSongClip(songProject, songProject.currentSectionId, trackId);
  if (!changed) return false;
  renderSongTimeline();
  if (record) recordHistoryState("取消选择 Song Loop");
  return true;
}

function applySectionBaseLength(value) {
  const section = currentSongSection(songProject);
  if (!setSongSectionLength(songProject, section.id, Number(value), section.extraBars)) return;
  replacePerformanceLoopsFromSong();
  renderSongMode();
  recordHistoryState("更改段落长度");
}

function toggleSectionExtraLength(value) {
  const section = currentSongSection(songProject);
  const bars = Number(value);
  const extras = section.extraBars.includes(bars)
    ? section.extraBars.filter((candidate) => candidate !== bars)
    : [...section.extraBars, bars];
  if (!setSongSectionLength(songProject, section.id, section.baseBars, extras)) return;
  replacePerformanceLoopsFromSong();
  renderSongMode();
  recordHistoryState("更改段落长度");
}

function songBarAtClientX(clientX) {
  const bounds = songTimelineContent.getBoundingClientRect();
  const totalBars = sectionBars(currentSongSection(songProject));
  return Math.min(totalBars - 1, Math.max(0, Math.floor((clientX - bounds.left) / bounds.width * totalBars)));
}

function songBoundaryBarAtClientX(clientX) {
  const bounds = songRuler.getBoundingClientRect();
  const totalBars = sectionBars(currentSongSection(songProject));
  return Math.min(totalBars, Math.max(0, Math.round((clientX - bounds.left) / bounds.width * totalBars)));
}

function songSectionLoopEdgeAtClientX(clientX) {
  const rangeBounds = songSectionLoopRange.getBoundingClientRect();
  const startHitBounds = songSectionLoopStart.getBoundingClientRect();
  const endHitBounds = songSectionLoopEnd.getBoundingClientRect();
  return edgeHitAtX({
    start: rangeBounds.left,
    end: rangeBounds.right,
    startHitStart: startHitBounds.left,
    startHitEnd: startHitBounds.right,
    endHitStart: endHitBounds.left,
    endHitEnd: endHitBounds.right,
  }, clientX);
}

function beginSongSectionLoopDrag(event, edge, handle) {
  if (!isSongMode || (event.pointerType === "mouse" && event.button !== 0)) return;
  event.preventDefault();
  event.stopPropagation();
  closeSongClipMenu();
  closeSongLoopPicker();
  const range = sectionLoopRange(currentSongSection(songProject));
  songSectionLoopInteraction = {
    edge,
    pointerId: event.pointerId,
    handle,
    changed: false,
    startBar: range.startBar,
    endBar: range.endBar,
  };
  try {
    handle.setPointerCapture(event.pointerId);
  } catch {
    // Synthetic pointer events may not own pointer capture.
  }
}

function songClipAtInteriorX(lane, clientX) {
  const ranges = [...lane.querySelectorAll(".song-clip")].map((element) => {
    const bounds = element.getBoundingClientRect();
    return { element, start: bounds.left, end: bounds.right };
  });
  return interiorRangeAtX(ranges, clientX)?.element ?? null;
}

function songClipEdgeAtClientX(clipElement, clientX) {
  const clipBounds = clipElement.getBoundingClientRect();
  const startHandle = clipElement.querySelector("[data-resize-start-handle]");
  const endHandle = clipElement.querySelector("[data-resize-end-handle]");
  const startHitBounds = startHandle.getBoundingClientRect();
  const endHitBounds = endHandle.getBoundingClientRect();
  const startOutset = Number.parseFloat(getComputedStyle(startHandle, "::before").width) || 0;
  const endOutset = Number.parseFloat(getComputedStyle(endHandle, "::before").width) || 0;
  return edgeHitAtX({
    start: clipBounds.left,
    end: clipBounds.right,
    startHitStart: startHitBounds.left - startOutset,
    startHitEnd: startHitBounds.right,
    endHitStart: endHitBounds.left,
    endHitEnd: endHitBounds.right + endOutset,
  }, clientX);
}

function applySongSectionLoopRange(startBar, endBar, edge) {
  const section = currentSongSection(songProject);
  const transportStep = isPlaying && isSongMode
    ? (performance.now() - transportStartedAt) / stepDurationMs(tempo)
    : null;
  const currentSectionStep = transportStep === null ? null : songPlaybackStepAt(transportStep);
  if (!setSongSectionLoopRange(songProject, section.id, startBar, endBar)) return false;
  if (transportStep === null) {
    songPlaybackRangeState = null;
    return true;
  }

  songPlaybackRangeState = songPlaybackRangeStateAfterChange(
    section,
    edge,
    transportStep,
    currentSectionStep
  );
  return true;
}

function moveSongSectionLoopDrag(event) {
  const interaction = songSectionLoopInteraction;
  if (!interaction || interaction.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  const boundaryBar = songBoundaryBarAtClientX(event.clientX);
  const startBar = interaction.edge === "start"
    ? Math.min(interaction.endBar - 1, boundaryBar)
    : interaction.startBar;
  const endBar = interaction.edge === "end"
    ? Math.max(interaction.startBar + 1, boundaryBar)
    : interaction.endBar;
  if (!applySongSectionLoopRange(startBar, endBar, interaction.edge)) return;
  interaction.changed = true;
  renderSongSectionLoopRange();
}

function finishSongSectionLoopDrag(event) {
  const interaction = songSectionLoopInteraction;
  if (!interaction || interaction.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  songSectionLoopInteraction = null;
  if (interaction.handle.hasPointerCapture?.(event.pointerId)) {
    interaction.handle.releasePointerCapture(event.pointerId);
  }
  if (interaction.changed) recordHistoryState("调整 Section 循环范围");
}

function nudgeSongSectionLoop(edge, direction) {
  const section = currentSongSection(songProject);
  const range = sectionLoopRange(section);
  const changed = edge === "start"
    ? applySongSectionLoopRange(
      Math.min(range.endBar - 1, Math.max(0, range.startBar + direction)),
      range.endBar,
      edge
    )
    : applySongSectionLoopRange(
      range.startBar,
      Math.min(sectionBars(section), Math.max(range.startBar + 1, range.endBar + direction)),
      edge
    );
  if (!changed) return;
  renderSongSectionLoopRange();
  recordHistoryState("调整 Section 循环范围");
}

function beginSongTimelineInteraction(event) {
  if (!isSongMode || (event.pointerType === "mouse" && event.button !== 0)) return;
  if (songClipSplitState && !event.target.closest("#song-clip-split-marker")) closeSongClipSplitEditor();
  const lane = event.target.closest(".song-track-lane");
  if (!lane) return;
  const targetedClipElement = event.target.closest(".song-clip");
  const clipElement = songClipAtInteriorX(lane, event.clientX) ?? targetedClipElement;

  const trackId = lane.dataset.trackId;
  if (trackId !== currentInstrumentId) selectInstrument(trackId);
  if (!clipElement) {
    songTimelineInteraction = {
      mode: "blank",
      pointerId: event.pointerId,
      trackId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    return;
  }

  const clipId = clipElement.dataset.clipId;
  if (clipElement.getAttribute("aria-pressed") !== "true") {
    event.preventDefault();
    selectArrangedClip(trackId, clipId);
    openSongClipMenu(trackId, clipId);
    return;
  }

  const clip = currentSongSection(songProject).tracks[trackId].clips
    .find((candidate) => candidate.id === clipId);
  const edge = songClipEdgeAtClientX(clipElement, event.clientX);
  const mode = edge ? `resize-${edge}` : "move";
  songTimelineInteraction = {
    mode,
    pointerId: event.pointerId,
    trackId,
    clipId,
    startX: event.clientX,
    originalStartBar: clip.startBar,
    originalLengthBars: clip.lengthBars,
    changed: false,
  };
  try {
    songTimelineViewport.setPointerCapture(event.pointerId);
  } catch {
    // Synthetic pointer events may not own pointer capture.
  }
  event.preventDefault();
}

function moveSongTimelineInteraction(event) {
  const interaction = songTimelineInteraction;
  if (!interaction || interaction.pointerId !== event.pointerId) return;
  if (interaction.mode === "blank") {
    if (Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY) > 8) {
      interaction.moved = true;
    }
    return;
  }

  event.preventDefault();
  const totalBars = sectionBars(currentSongSection(songProject));
  const barWidth = songTimelineContent.getBoundingClientRect().width / totalBars;
  const deltaBars = Math.round((event.clientX - interaction.startX) / barWidth);
  const changed = interaction.mode === "resize-end"
    ? resizeSongClip(
      songProject,
      songProject.currentSectionId,
      interaction.trackId,
      interaction.clipId,
      interaction.originalLengthBars + deltaBars
    )
    : interaction.mode === "resize-start"
      ? resizeSongClipStart(
        songProject,
        songProject.currentSectionId,
        interaction.trackId,
        interaction.clipId,
        interaction.originalStartBar + deltaBars
      )
      : moveSongClip(
      songProject,
      songProject.currentSectionId,
      interaction.trackId,
      interaction.clipId,
      interaction.originalStartBar + deltaBars
    );
  if (!changed) return;
  interaction.changed = true;
  renderSongTimeline();
}

function endSongTimelineInteraction(event) {
  const interaction = songTimelineInteraction;
  if (!interaction || interaction.pointerId !== event.pointerId) return;
  songTimelineInteraction = null;
  if (songTimelineViewport.hasPointerCapture(event.pointerId)) {
    songTimelineViewport.releasePointerCapture(event.pointerId);
  }

  if (interaction.mode !== "blank") {
    if (interaction.changed) {
      const label = interaction.mode === "move"
        ? "移动 Song Loop"
        : interaction.mode === "resize-start"
          ? "调整 Song Loop 开头"
          : "调整 Song Loop 结尾";
      recordHistoryState(label);
    }
    else deselectArrangedClip(interaction.trackId);
    return;
  }
  if (interaction.moved) return;

  deselectArrangedClip(interaction.trackId);
  const bar = songBarAtClientX(event.clientX);
  const now = performance.now();
  const isSecondTap = lastSongBlankTap
    && now - lastSongBlankTap.at < 360
    && lastSongBlankTap.trackId === interaction.trackId
    && lastSongBlankTap.bar === bar;
  if (isSecondTap) {
    openSongLoopPicker(interaction.trackId, bar);
    lastSongBlankTap = null;
  } else {
    lastSongBlankTap = { at: now, trackId: interaction.trackId, bar };
  }
}

function cancelSongTimelineInteraction(event) {
  if (songTimelineInteraction?.pointerId !== event.pointerId) return;
  const changed = songTimelineInteraction.changed;
  songTimelineInteraction = null;
  if (changed) recordHistoryState("调整 Song Loop");
}

function updateSongClipSplitFromPointer(event) {
  if (!songClipSplitState || songClipSplitState.pointerId !== event.pointerId) return;
  event.preventDefault();
  const clip = currentSongSection(songProject).tracks[songClipSplitState.trackId].clips
    .find((candidate) => candidate.id === songClipSplitState.clipId);
  if (!clip) return;
  const bounds = songTimelineContent.getBoundingClientRect();
  const totalBars = sectionBars(currentSongSection(songProject));
  const bar = Math.round((event.clientX - bounds.left) / bounds.width * totalBars);
  songClipSplitState.splitBar = Math.min(
    clip.startBar + clip.lengthBars - 1,
    Math.max(clip.startBar + 1, bar)
  );
  renderSongClipSplitEditor();
}

function finishSongClipSplitPointer(event) {
  if (!songClipSplitState || songClipSplitState.pointerId !== event.pointerId) return;
  songClipSplitState.pointerId = null;
  if (songClipSplitMarker.hasPointerCapture?.(event.pointerId)) {
    songClipSplitMarker.releasePointerCapture(event.pointerId);
  }
}

function songLoopBarsAtClientX(clientX) {
  if (!songLoopLengthState) return null;
  const { edit } = songLoopLengthState;
  const clip = currentSongSection(songProject).tracks[edit.trackId].clips
    .find((candidate) => candidate.id === edit.clipId);
  if (!clip) return null;
  const bounds = songTimelineContent.getBoundingClientRect();
  const totalBars = sectionBars(currentSongSection(songProject));
  const boundaryBar = Math.round((clientX - bounds.left) / bounds.width * totalBars);
  const minimumBars = minimumEditableSongLoopBars(edit);
  return Math.min(
    MAX_LOOP_BARS,
    Math.max(minimumBars, boundaryBar - clip.startBar + edit.originalSourceOffsetBars)
  );
}

function minimumEditableSongLoopBars(edit) {
  return Math.min(MAX_LOOP_BARS, Math.max(1, Math.floor(edit.originalSourceOffsetBars) + 1));
}

function updateSongLoopLengthFromPointer(event) {
  if (!songLoopLengthState || songLoopLengthState.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  const loopBars = songLoopBarsAtClientX(event.clientX);
  if (loopBars !== null) updateArrangedSongLoopLength(loopBars);
}

function finishSongLoopLengthPointer(event) {
  if (!songLoopLengthState || songLoopLengthState.pointerId !== event.pointerId) return;
  songLoopLengthState.pointerId = null;
  if (songLoopLengthMarker.hasPointerCapture?.(event.pointerId)) {
    songLoopLengthMarker.releasePointerCapture(event.pointerId);
  }
}

function shiftCurrentTrack(stepOffset) {
  if (!stepOffset) return 0;
  const shifted = shiftTrackLoop(tracks.get(currentInstrumentId), stepOffset, loopBarsFor());
  updateTrackLoopChart(currentInstrumentId);
  if (shifted > 0) scheduleAutosave();
  return shifted;
}

function resetFineLoopShift() {
  fineLoopShift = 0;
  fineLoopShiftDirty = false;
  loopShiftSlider.value = "0";
}

function openLoopShiftPanel() {
  finishRecordingPhrase();
  finishEraserHistory();
  resetFineLoopShift();
  loopShiftTitle.textContent = `${instrumentById(currentInstrumentId).label} · Loop 移位`;
  instrumentSwitcher.classList.add("is-track-expanded");
  openSettingPanel(loopShiftPanel);
}

function closeLoopShiftPanel() {
  commitFineLoopShift();
  resetFineLoopShift();
  instrumentSwitcher.classList.remove("is-track-expanded");
  closePanel(loopShiftPanel, loopShiftButton);
}

function applyCoarseLoopShift(button) {
  commitFineLoopShift();
  const shifted = shiftCurrentTrack(Number(button.dataset.loopShift));
  if (shifted > 0) recordHistoryState("固定距离 Loop 移位");
  resetFineLoopShift();
}

function applyFineLoopShift() {
  const nextShift = Number(loopShiftSlider.value);
  const shifted = shiftCurrentTrack(nextShift - fineLoopShift);
  if (shifted > 0) fineLoopShiftDirty = true;
  fineLoopShift = nextShift;
}

function pointAtPosition(clientX, clientY) {
  return normalizedPoint(clientX, clientY, surface.getBoundingClientRect());
}

function noteAtPoint(point, instrumentId = currentInstrumentId, voicingContext = "live") {
  if (instrumentId === "chord") {
    const previousState = voicingContext === "playback"
      ? playbackPopChordVoicingState
      : livePopChordVoicingState;
    const chord = popChordAtPoint(point, previousState);
    const nextState = nextPopChordVoicingState(previousState, chord);
    if (voicingContext === "playback") playbackPopChordVoicingState = nextState;
    else livePopChordVoicingState = nextState;
    return {
      index: popChordIndexAtPoint(point, previousState),
      midi: buildPopChordVoicing(
        chord,
        48,
        nextState.variant,
        nextState.usesRouteBass ? nextState.bassMidi : null
      ),
    };
  }
  const index = noteIndexAtNormalizedX(point.x);
  return { index, midi: instrumentMidi(instrumentId, notes[index]) };
}

function instrumentById(instrumentId) {
  return INSTRUMENTS.find(({ id }) => id === instrumentId);
}

function showGlow(id, point, isPlayback = false, instrumentId = currentInstrumentId) {
  let glow = glows.get(id);
  if (!glow) {
    glow = document.createElement("div");
    glow.className = `touch-glow${isPlayback ? " is-playback" : ""}`;
    glowLayer.append(glow);
    glows.set(id, glow);
  }
  glow.dataset.instrument = instrumentId;
  glow.style.setProperty("--glow-color", instrumentById(instrumentId).glowColor);
  glow.style.left = `${point.x * 100}%`;
  glow.style.top = `${point.y * 100}%`;
  ensureIdlePulse();
}

function hideGlow(id) {
  glows.get(id)?.remove();
  glows.delete(id);
  if (!isPlaying && glows.size === 0) glowLayer.style.setProperty("--beat-pulse", "1");
}

function updateGlowPulse(now, beatStartedAt) {
  glowLayer.style.setProperty("--beat-pulse", beatPulseAt(now, beatStartedAt, tempo).toFixed(3));
}

function updatePopChordGuidePulse(now, beatStartedAt) {
  surface.style.setProperty(
    "--pop-guide-pulse",
    rhythmicEnvelopeAt(now, beatStartedAt, tempo).toFixed(3)
  );
}

function tickIdlePulse(now) {
  if (isPlaying) {
    idlePulseFrame = 0;
    return;
  }
  updateTopBeatButtons(now, idleBeatStartedAt, false);
  updateMetronome(now, idleBeatStartedAt);
  processIdleDrumPattern(now);
  updatePopChordGuidePulse(now, idleBeatStartedAt);
  if (glows.size > 0) updateGlowPulse(now, idleBeatStartedAt);
  idlePulseFrame = requestAnimationFrame(tickIdlePulse);
}

function ensureIdlePulse() {
  if (!isPlaying && !idlePulseFrame) {
    idlePulseFrame = requestAnimationFrame(tickIdlePulse);
  }
}

function storePointerPoint(pointerId, point) {
  pointerPositions.set(pointerId, point);
  pointerNotes.set(pointerId, surfaceIndexAtPoint(point, currentInstrumentId, livePopChordVoicingState));
  if (pointerId !== lastLivePointerId) return;
  showGlow("live:control", point, false, currentInstrumentId);
  recordLivePointNow(point);
}

function stopActiveLiveVoice() {
  liveVoiceToken += 1;
  activeLiveVoiceId = null;
  synth.stopByPrefix("live:control:");
}

function trackIsAudible(instrumentId) {
  return isTrackAudible(mutedTrackIds, soloTrackIds, instrumentId);
}

function loopBarsFor(instrumentId = currentInstrumentId) {
  return trackLoopBars.get(instrumentId) ?? 1;
}

function ensureSongProject() {
  if (!songProject) songProject = createSongProject(TRACK_IDS, tracks, trackLoopBars);
  return songProject;
}

function currentProjectArchive() {
  const song = ensureSongProject();
  syncPerformanceLoopsToSong(song, song.currentSectionId, tracks, trackLoopBars);
  return createProjectArchive({
    tempo,
    trackLoopBars,
    scaleKey: currentScaleKey,
    currentInstrumentId,
    workspaceMode: isSongMode ? "song" : "loop",
    mutedTrackIds,
    soloTrackIds,
    tracks,
    song,
  });
}

function historyIsBusy() {
  return pointerPositions.size > 0 || eraserIsHeld();
}

function updateHistoryControls() {
  const busy = historyIsBusy();
  undoButton.disabled = !historyReady || busy || !projectHistory.canUndo();
  redoButton.disabled = !historyReady || busy || !projectHistory.canRedo();
}

function persistAutosaveNow() {
  clearTimeout(autosaveTimer);
  autosaveTimer = 0;
  if (!historyReady) return;

  const workingState = currentProjectArchive();
  const session = { version: 1, history: projectHistory.export(), workingState };
  try {
    localStorage.setItem(activeProjectStorageKey(AUTOSAVE_STORAGE_KEY), JSON.stringify(workingState));
  } catch (error) {
    console.error(error);
  }

  autosaveStatus.textContent = "正在自动保存";
  persistenceChain = persistenceChain
    .then(() => saveHistorySession(session, activeHistorySessionKey()))
    .then(() => {
      autosaveStatus.textContent = `已自动保存 ${formatArchiveTime(workingState.savedAt)}`;
    })
    .catch((error) => {
      console.error(error);
      autosaveStatus.textContent = "历史保存失败，当前状态已尝试保存在浏览器中";
    });
}

function scheduleAutosave(delay = 250) {
  if (!historyReady) return;
  clearTimeout(autosaveTimer);
  autosaveStatus.textContent = "等待自动保存";
  autosaveTimer = window.setTimeout(persistAutosaveNow, delay);
}

function recordHistoryState(label) {
  if (!historyReady) return false;
  const recorded = projectHistory.record(currentProjectArchive(), label);
  updateHistoryControls();
  scheduleAutosave(0);
  return recorded;
}

function markTrackContentChanged() {
  scheduleAutosave();
  if (eraserIsEngaged()) {
    eraserHistoryDirty = true;
    return;
  }

  if (recordingPhraseDirty && recordingPhraseInstrumentId !== currentInstrumentId) {
    finishRecordingPhrase();
  }
  recordingPhraseDirty = true;
  recordingPhraseInstrumentId = currentInstrumentId;
  clearTimeout(recordingPhraseTimer);
  recordingPhraseTimer = 0;
}

function finishRecordingPhrase() {
  clearTimeout(recordingPhraseTimer);
  recordingPhraseTimer = 0;
  songRecordingExpansionState = null;
  if (!recordingPhraseDirty) return;
  recordingPhraseDirty = false;
  recordingPhraseInstrumentId = null;
  recordHistoryState("录制乐句");
}

function scheduleRecordingPhraseBoundary() {
  clearTimeout(recordingPhraseTimer);
  recordingPhraseTimer = 0;
  if (!recordingPhraseDirty || pointerPositions.size > 0) return;
  if (!recordArmed || !isPlaying) {
    finishRecordingPhrase();
    return;
  }

  const phraseTrackId = recordingPhraseInstrumentId;
  const halfLoopMs = recordingPhraseGapMs(loopBarsFor(phraseTrackId), tempo);
  recordingPhraseTimer = window.setTimeout(finishRecordingPhrase, halfLoopMs);
}

function finishEraserHistory() {
  if (!eraserHistoryDirty) return;
  eraserHistoryDirty = false;
  recordHistoryState("擦除/替换");
}

function commitFineLoopShift() {
  if (!fineLoopShiftDirty) return;
  fineLoopShiftDirty = false;
  recordHistoryState("无极 Loop 移位");
}

function undoProjectHistory() {
  finishRecordingPhrase();
  finishEraserHistory();
  commitFineLoopShift();
  const entry = projectHistory.undo();
  if (!entry) return;
  applyProjectArchive(entry.state, { preserveCurrentInstrument: true });
  archiveStatus.textContent = `已撤销：${entry.label}`;
  updateHistoryControls();
  scheduleAutosave(0);
}

function redoProjectHistory() {
  const entry = projectHistory.redo();
  if (!entry) return;
  applyProjectArchive(entry.state, { preserveCurrentInstrument: true });
  archiveStatus.textContent = `已重做：${entry.label}`;
  updateHistoryControls();
  scheduleAutosave(0);
}

async function startActiveLiveVoice(pointerId) {
  const point = pointerPositions.get(pointerId);
  if (!point || pointerId !== lastLivePointerId) return;

  stopActiveLiveVoice();
  if (!trackIsAudible(currentInstrumentId)) return;
  if (currentInstrumentId === "drums") {
    void synth.unlock().catch(console.error);
    return;
  }

  const token = liveVoiceToken;
  const voiceId = `live:control:${token}`;
  activeLiveVoiceId = voiceId;
  try {
    await synth.start(voiceId, noteAtPoint(point).midi, instrumentPreset(currentInstrumentId));
    const currentPoint = pointerPositions.get(pointerId);
    if (token !== liveVoiceToken || pointerId !== lastLivePointerId || !currentPoint || currentInstrumentId === "drums") {
      synth.stop(voiceId);
      return;
    }
    synth.change(voiceId, noteAtPoint(currentPoint).midi);
  } catch (error) {
    console.error(error);
    noteStatus.textContent = "无法启动音频，请检查浏览器的声音权限";
  }
}

function beginIdleDrumPattern(now) {
  idleDrumPatternStartedAt = recordingTransportStart(now, idleBeatStartedAt, tempo);
  lastIdleDrumAbsoluteStep = Math.floor((now - idleDrumPatternStartedAt) / stepDurationMs(tempo)) - 1;
}

async function beginNote(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  inputLayer.setPointerCapture(event.pointerId);

  const hadPointers = pointerPositions.size > 0;
  clearTimeout(recordingPhraseTimer);
  recordingPhraseTimer = 0;
  const point = pointAtPosition(event.clientX, event.clientY);
  const tutorialChordId = currentInstrumentId === "chord"
    ? popChordAtPoint(point, livePopChordVoicingState).functionId
    : null;
  lastLivePointerId = registerPointerPress(pointerPressOrder, event.pointerId);
  storePointerPoint(event.pointerId, point);

  if (recordArmed && !isPlaying) {
    const now = performance.now();
    startTransport(recordingTransportStart(now, idleBeatStartedAt, tempo), { now });
  } else if (currentInstrumentId === "drums" && !isPlaying && !hadPointers) {
    beginIdleDrumPattern(performance.now());
  }

  updateActiveRegions();
  if (tutorialChordId) observeTutorialChord(tutorialChordId);
  updateHistoryControls();
  noteStatus.textContent = "正在演奏";
  await startActiveLiveVoice(event.pointerId);
}

function moveNote(event) {
  if (!pointerNotes.has(event.pointerId)) return;
  event.preventDefault();

  const point = pointAtPosition(event.clientX, event.clientY);
  const previousIndex = pointerNotes.get(event.pointerId);
  storePointerPoint(event.pointerId, point);
  if (event.pointerId === lastLivePointerId && previousIndex !== pointerNotes.get(event.pointerId)) {
    if (currentInstrumentId !== "drums" && activeLiveVoiceId) {
      synth.change(activeLiveVoiceId, noteAtPoint(point).midi);
    }
    updateActiveRegions();
  }
  if (event.pointerId === lastLivePointerId) noteStatus.textContent = "正在演奏";
}

function endNote(event) {
  stopLivePointer(event.pointerId);
  if (pointerPositions.size === 0) scheduleRecordingPhraseBoundary();
  updateHistoryControls();
}

function stopLivePointer(pointerId) {
  if (!pointerPositions.has(pointerId)) return;
  const wasActive = lastLivePointerId === pointerId;
  pointerNotes.delete(pointerId);
  pointerPositions.delete(pointerId);
  if (wasActive) {
    lastLivePointerId = unregisterPointer(pointerPressOrder, pointerId);
    if (lastLivePointerId === null) {
      stopActiveLiveVoice();
      hideGlow("live:control");
      lastIdleDrumAbsoluteStep = null;
    } else {
      const fallbackPoint = pointerPositions.get(lastLivePointerId);
      storePointerPoint(lastLivePointerId, fallbackPoint);
      void startActiveLiveVoice(lastLivePointerId);
    }
  } else {
    unregisterPointer(pointerPressOrder, pointerId);
  }
  updateActiveRegions();
  noteStatus.textContent = lastLivePointerId === null ? "轻触或横向拖动来演奏" : "正在演奏";
}

function releaseStuckTouches() {
  const pointerIds = new Set([...pointerNotes.keys(), ...pointerPositions.keys()]);
  pointerNotes.clear();
  pointerPositions.clear();
  pointerPressOrder.length = 0;
  lastLivePointerId = null;
  for (const pointerId of pointerIds) {
    if (inputLayer.hasPointerCapture(pointerId)) inputLayer.releasePointerCapture(pointerId);
  }
  for (const pointerId of eraserPointerIds) {
    for (const button of eraserButtons) {
      if (button.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId);
    }
  }
  eraserPointerIds.clear();
  eraserKeyboardHeld = false;
  updateEraserButtonState();
  finishRecordingPhrase();
  finishEraserHistory();
  updateHistoryControls();

  stopActiveLiveVoice();
  hideGlow("live:control");
  lastIdleDrumAbsoluteStep = null;
  updateActiveRegions();
  noteStatus.textContent = "现场触摸已释放";
}

function currentRecordingPoint() {
  return activePointerPoint(pointerPressOrder, pointerPositions);
}

function recordLivePointNow(point) {
  if (!isPlaying || !recordArmed) return;
  if (isSongMode) return;
  const absoluteStep = Math.floor((performance.now() - transportStartedAt) / stepDurationMs(tempo));
  const step = loopPosition(absoluteStep, loopBarsFor()).step;
  recordPoint(tracks.get(currentInstrumentId), step, point);
  updateRecordedStepCount();
  updateTrackLoopChart(currentInstrumentId);
  markTrackContentChanged();
}

function songPlaybackStepAt(transportStep) {
  const section = currentSongSection(songProject);
  return songSectionStepAtTransportStep(section, transportStep, songPlaybackRangeState);
}

function commitQueuedSongSectionTransition(transition) {
  const targetSection = songProject.sections[transition?.targetSectionId];
  if (!targetSection || songProject.currentSectionId !== transition.fromSectionId) {
    songSectionTransitionState = null;
    renderSongSectionSwitcher();
    return false;
  }
  finishRecordingPhrase();
  finishEraserHistory();
  cancelArrangedSongLoopLength({ render: false });
  closeSongClipMenu();
  closeSongLoopPicker();
  closeSongClipSplitEditor();
  songRecordingExpansionState = null;
  lastSongBlankTap = null;
  songProject.currentSectionId = transition.targetSectionId;
  songPlaybackRangeState = songSectionLoopStartPlaybackState(
    targetSection,
    transition.switchAtTransportStep
  );
  songSectionTransitionState = null;
  replacePerformanceLoopsFromSong();
  renderSongMode({ resetScroll: true });
  scheduleAutosave();
  return true;
}

function processSongTransportRange(firstStep, lastStep, livePoint) {
  if (firstStep > lastStep) return;
  recordSongArrangementRange(firstStep, lastStep, livePoint);
  for (let step = firstStep; step <= lastStep; step += 1) processTransportDrumStep(step);
}

function playbackPositionAt(transportStep) {
  return isSongMode
    ? loopPosition(songPlaybackStepAt(transportStep), sectionBars(currentSongSection(songProject)))
    : loopPosition(transportStep, loopBarsFor());
}

function triggerDrumPatternStep(absoluteStep, point) {
  if (!point || !isDrumTriggerLoopStep(absoluteStep)) return;
  const patternIndex = drumPatternIndexAtX(point.x);
  const drumStep = drumStepAtLoopStep(absoluteStep);
  for (const { note, velocity } of drumEventsAt(patternIndex, drumStep)) {
    void synth.playDrum(note, velocity).catch(console.error);
  }
}

function processIdleDrumPattern(now) {
  if (currentInstrumentId !== "drums" || lastLivePointerId === null) {
    lastIdleDrumAbsoluteStep = null;
    return;
  }
  if (!idleDrumPatternStartedAt) beginIdleDrumPattern(now);

  const absoluteStep = Math.floor((now - idleDrumPatternStartedAt) / stepDurationMs(tempo));
  if (lastIdleDrumAbsoluteStep === null) lastIdleDrumAbsoluteStep = absoluteStep - 1;
  if (absoluteStep === lastIdleDrumAbsoluteStep) return;
  if (!trackIsAudible("drums")) {
    lastIdleDrumAbsoluteStep = absoluteStep;
    return;
  }

  const firstStep = absoluteStep - lastIdleDrumAbsoluteStep > 128 ? absoluteStep : lastIdleDrumAbsoluteStep + 1;
  const point = currentRecordingPoint();
  for (let step = firstStep; step <= absoluteStep; step += 1) triggerDrumPatternStep(step, point);
  lastIdleDrumAbsoluteStep = absoluteStep;
}

function processTransportDrumStep(absoluteStep) {
  if (!trackIsAudible("drums")) return;
  const playbackStep = isSongMode ? songPlaybackStepAt(absoluteStep) : absoluteStep;
  const loopStep = loopPosition(playbackStep, loopBarsFor("drums")).step;
  const livePoint = currentInstrumentId === "drums" ? currentRecordingPoint() : null;
  const arrangedPoint = isSongMode
    ? songPointAtAbsoluteStep(songProject, songProject.currentSectionId, "drums", playbackStep)
    : tracks.get("drums").get(loopStep);
  const point = livePoint ?? arrangedPoint;
  triggerDrumPatternStep(playbackStep, point);
}

function updateRecordedStepCount() {
  const count = [...tracks.values()].reduce((total, track) => total + track.size, 0);
  surface.dataset.recordedSteps = String(count);
}

function playbackState(instrumentId) {
  let state = playbackStates.get(instrumentId);
  if (!state) {
    state = { active: false, midi: null, token: 0 };
    playbackStates.set(instrumentId, state);
  }
  return state;
}

function startPlaybackVoice(instrumentId, midi) {
  if (!trackIsAudible(instrumentId)) {
    silencePlaybackVoice(instrumentId);
    return;
  }
  const state = playbackState(instrumentId);
  state.midi = midi;
  if (state.active) {
    synth.change(`loop:${instrumentId}`, midi);
    return;
  }

  state.active = true;
  const token = ++state.token;
  synth.start(`loop:${instrumentId}`, midi, instrumentPreset(instrumentId)).then(() => {
    if (state.active && state.token === token) synth.change(`loop:${instrumentId}`, state.midi);
  }).catch(console.error);
}

function stopPlaybackVoice(instrumentId) {
  silencePlaybackVoice(instrumentId);
  playbackPoints.delete(instrumentId);
  hideGlow(`loop:${instrumentId}`);
}

function silencePlaybackVoice(instrumentId) {
  const state = playbackState(instrumentId);
  if (!state.active) return;
  state.active = false;
  state.token += 1;
  state.midi = null;
  synth.stop(`loop:${instrumentId}`);
}

function processPlaybackStep(absoluteStep) {
  const playbackStep = isSongMode ? songPlaybackStepAt(absoluteStep) : absoluteStep;
  const livePoint = recordArmed ? currentRecordingPoint() : null;
  const pointsAtStep = isSongMode
    ? new Map(TRACK_IDS.flatMap((trackId) => {
      const point = songPointAtAbsoluteStep(songProject, songProject.currentSectionId, trackId, playbackStep);
      return point ? [[trackId, point]] : [];
    }))
    : trackPointsAtAbsoluteStep(tracks, trackLoopBars, playbackStep);

  for (const { id } of INSTRUMENTS) {
    const point = pointsAtStep.get(id);
    if (!point) {
      stopPlaybackVoice(id);
      continue;
    }

    playbackPoints.set(id, point);
    showGlow(`loop:${id}`, point, true, id);
    if (!trackIsAudible(id)) {
      silencePlaybackVoice(id);
      continue;
    }
    if (id === "drums") {
      silencePlaybackVoice(id);
      continue;
    }
    if (id === currentInstrumentId && livePoint) {
      silencePlaybackVoice(id);
      continue;
    }
    startPlaybackVoice(id, noteAtPoint(point, id, "playback").midi);
  }
  updateActiveRegions();
}

function updatePlayButton(position) {
  for (const button of [playButton, songPlayButton]) {
    button.textContent = `${position.bar}.${position.beat}`;
    button.setAttribute("aria-label", `播放中：第 ${position.bar} 小节，第 ${position.beat} 拍`);
  }
}

function updateSongPlayhead(now) {
  songArranger.dataset.playing = String(isSongMode && isPlaying);
  if (!isSongMode || !isPlaying) {
    songTimelineContent.style.removeProperty("--song-playhead");
    return;
  }
  const section = currentSongSection(songProject);
  const totalSteps = loopStepCount(sectionBars(section));
  const absoluteStep = (now - transportStartedAt) / stepDurationMs(tempo);
  const progress = songPlaybackStepAt(absoluteStep) / totalSteps;
  songTimelineContent.style.setProperty("--song-playhead", `${progress * 100}%`);
}

function updateTopBeatButtons(now, beatStartedAt, showBeatPosition = true) {
  for (const button of topBeatButtons) {
    const targetBeat = Number(button.dataset.beat) - 1;
    const intensity = !tempoPanel.hidden
      ? 0
      : showBeatPosition
        ? rhythmicEnvelopeAt(now, beatStartedAt, tempo, targetBeat, 4)
        : targetBeat === 0 ? rhythmicEnvelopeAt(now, beatStartedAt, tempo) : 0;
    const background = Math.round(48 + (244 - 48) * intensity);
    const foreground = Math.round(244 - (244 - 24) * intensity);
    button.classList.toggle("is-beat-active", intensity > 0.001);
    button.style.backgroundColor = `rgb(${background} ${background} ${background})`;
    button.style.borderColor = `rgb(${Math.round(114 + 141 * intensity)} ${Math.round(114 + 141 * intensity)} ${Math.round(114 + 141 * intensity)})`;
    button.style.boxShadow = intensity > 0.001
      ? `0 0 ${Math.max(1, 16 * intensity).toFixed(2)}px ${(3.2 * intensity).toFixed(2)}px rgb(255 255 255 / ${(0.72 * intensity).toFixed(3)})`
      : "none";
    button.style.color = `rgb(${foreground} ${foreground} ${foreground})`;
  }
}

function metronomeEnabled() {
  return metronomeMode === "record" && recordArmed;
}

function beatIndexAt(now, beatStartedAt) {
  return Math.floor((now - beatStartedAt) / (60_000 / tempo));
}

function primeMetronome(now, beatStartedAt) {
  lastMetronomeAnchor = beatStartedAt;
  lastMetronomeBeat = beatIndexAt(now, beatStartedAt);
}

function updateMetronome(now, beatStartedAt) {
  const beatIndex = beatIndexAt(now, beatStartedAt);
  if (lastMetronomeAnchor !== beatStartedAt) {
    primeMetronome(now, beatStartedAt);
    return;
  }
  if (beatIndex === lastMetronomeBeat) return;

  lastMetronomeBeat = beatIndex;
  if (!metronomeEnabled()) return;
  const accent = isPlaying && ((beatIndex % 4) + 4) % 4 === 0;
  void synth.playMetronome(accent).catch(console.error);
}

function triggerManualDownbeat(now) {
  primeMetronome(now, now);
  if (metronomeEnabled()) void synth.playMetronome(true).catch(console.error);
}

function toggleMetronome() {
  const nextMode = metronomeMode === "off" ? "record" : "off";
  const labels = { record: "仅录制", off: "关" };
  metronomeMode = nextMode;
  metronomeButton.dataset.mode = nextMode;
  metronomeButton.textContent = `节拍器 ${labels[nextMode]}`;
  metronomeButton.setAttribute("aria-label", `节拍器：${labels[nextMode]}`);
  const now = performance.now();
  primeMetronome(now, isPlaying ? transportStartedAt : idleBeatStartedAt);
  if (nextMode === "record") void synth.unlock().catch(console.error);
}

function eraserIsHeld() {
  return eraserPointerIds.size > 0 || eraserKeyboardHeld;
}

function eraserIsEngaged() {
  return eraserIsHeld() && recordArmed && isPlaying;
}

function updateEraserButtonState() {
  const engaged = eraserIsEngaged();
  for (const button of eraserButtons) {
    button.dataset.held = String(eraserIsHeld());
    button.dataset.erasing = String(engaged);
    button.setAttribute("aria-pressed", String(engaged));
    button.setAttribute("aria-label", engaged
      ? `正在擦除或替换「${instrumentById(currentInstrumentId).label}」轨道`
      : "擦除或替换：录制并播放时按住操作当前轨道");
  }
}

function beginErasing(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  if (!eraserIsHeld()) finishRecordingPhrase();
  eraserPointerIds.add(event.pointerId);
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // Synthetic activations may not own native pointer capture.
  }
  updateEraserButtonState();
  updateHistoryControls();
}

function endErasing(event) {
  eraserPointerIds.delete(event.pointerId);
  updateEraserButtonState();
  if (!eraserIsHeld()) finishEraserHistory();
  updateHistoryControls();
}

function recordSongArrangementRange(firstStep, lastStep, livePoint) {
  const trackId = currentInstrumentId;
  const performanceTrack = tracks.get(trackId);
  const touchedLoopIds = new Set();
  let structureChanged = false;
  let changed = false;
  const sectionId = songProject.currentSectionId;

  for (let step = firstStep; step <= lastStep; step += 1) {
    const sectionStep = songPlaybackStepAt(step);
    const expansionMatches = songRecordingExpansionState
      && songRecordingExpansionState.trackId === trackId
      && songRecordingExpansionState.sectionId === sectionId;
    if (!expansionMatches) songRecordingExpansionState = null;

    if (songRecordingExpansionState && livePoint) {
      structureChanged = expandSongClipForRecording(
        songProject,
        sectionId,
        trackId,
        songRecordingExpansionState.clipId,
        sectionStep
      ) || structureChanged;
    }

    let target = songRecordingTargetAtAbsoluteStep(
      songProject,
      sectionId,
      trackId,
      sectionStep,
      {
        createIfMissing: Boolean(livePoint) && !songRecordingExpansionState,
        loopBars: loopBarsFor(trackId),
      }
    );
    if (!target) continue;

    const targetWasCreated = target.created;
    const targetWasEmpty = Object.keys(target.loop.points).length === 0;
    if (songRecordingExpansionState && target.clip.id !== songRecordingExpansionState.clipId) {
      songRecordingExpansionState = null;
    }
    if (livePoint && !songRecordingExpansionState && (targetWasCreated || targetWasEmpty)) {
      songRecordingExpansionState = {
        sectionId,
        trackId,
        clipId: target.clip.id,
        loopId: target.loop.id,
      };
      structureChanged = expandSongClipForRecording(
        songProject,
        sectionId,
        trackId,
        target.clip.id,
        sectionStep
      ) || structureChanged;
      target = songRecordingTargetAtAbsoluteStep(songProject, sectionId, trackId, sectionStep) ?? target;
    }

    if (targetWasCreated) {
      structureChanged = true;
      performanceTrack.clear();
      trackLoopBars.set(trackId, target.loop.bars);
    }
    if (selectedSongLoop(songProject, sectionId, trackId)?.id === target.loop.id
      && trackLoopBars.get(trackId) !== target.loop.bars) {
      trackLoopBars.set(trackId, target.loop.bars);
      structureChanged = true;
    }

    let erased = false;
    if (eraserIsEngaged() && Object.hasOwn(target.loop.points, target.sourceStep)) {
      delete target.loop.points[target.sourceStep];
      erased = true;
      changed = true;
    }
    if (livePoint) {
      target.loop.points[target.sourceStep] = { x: livePoint.x, y: livePoint.y };
      changed = true;
    }

    if (selectedSongLoop(songProject, sectionId, trackId)?.id === target.loop.id) {
      if (erased) performanceTrack.delete(target.sourceStep);
      if (livePoint) performanceTrack.set(target.sourceStep, livePoint);
    }
    if (erased || livePoint) touchedLoopIds.add(target.loop.id);
  }

  if (!changed) return false;
  updateRecordedStepCount();
  updateTrackLoopChart(trackId);
  if (structureChanged) {
    updateLoopLengthControls(trackId);
    updateInstrumentButtons();
    renderSongTimeline();
  } else {
    for (const loopId of touchedLoopIds) updateSongLoopClipCharts(trackId, loopId);
  }
  markTrackContentChanged();
  return true;
}

function tickTransport(now) {
  if (!isPlaying) return;

  updateGlowPulse(now, transportStartedAt);
  updatePopChordGuidePulse(now, transportStartedAt);
  updateTopBeatButtons(now, transportStartedAt);
  updateQueuedSongSectionPulse(now);
  updateMetronome(now, transportStartedAt);
  updateTrackLoopPlayheads(now);
  updateSongPlayhead(now);

  const absoluteStep = Math.floor((now - transportStartedAt) / stepDurationMs(tempo));
  if (absoluteStep !== lastAbsoluteStep) {
    const totalSteps = isSongMode
      ? loopStepCount(sectionLoopRange(currentSongSection(songProject)).lengthBars)
      : loopStepCount(Math.max(...trackLoopBars.values()));
    const firstStep = absoluteStep - lastAbsoluteStep > totalSteps ? absoluteStep : lastAbsoluteStep + 1;
    const livePoint = recordArmed ? currentRecordingPoint() : null;

    if (isSongMode) {
      const transition = songSectionTransitionState
        && songSectionTransitionState.switchAtTransportStep <= absoluteStep
        ? songSectionTransitionState
        : null;
      if (transition) {
        processSongTransportRange(firstStep, transition.switchAtTransportStep - 1, livePoint);
        commitQueuedSongSectionTransition(transition);
        processSongTransportRange(
          Math.max(firstStep, transition.switchAtTransportStep),
          absoluteStep,
          livePoint
        );
      } else {
        processSongTransportRange(firstStep, absoluteStep, livePoint);
      }
    } else {
      const track = tracks.get(currentInstrumentId);
      let trackChanged = false;
      if (eraserIsEngaged()) {
        const erased = eraseTrackRange(track, firstStep, absoluteStep, loopBarsFor());
        trackChanged = erased > 0;
      }
      if (livePoint) {
        for (let step = firstStep; step <= absoluteStep; step += 1) {
          recordPoint(track, loopPosition(step, loopBarsFor()).step, livePoint);
        }
        trackChanged = true;
      }
      if (trackChanged) {
        updateRecordedStepCount();
        updateTrackLoopChart(currentInstrumentId);
        markTrackContentChanged();
      }
      for (let step = firstStep; step <= absoluteStep; step += 1) processTransportDrumStep(step);
    }

    const position = playbackPositionAt(absoluteStep);
    processPlaybackStep(absoluteStep);
    updatePlayButton(position);
    lastAbsoluteStep = absoluteStep;
  }
  transportFrame = requestAnimationFrame(tickTransport);
}

function startTransport(startedAt = performance.now(), { now = performance.now(), manual = false } = {}) {
  if (isPlaying) return;
  songPlaybackRangeState = null;
  songSectionTransitionState = null;
  playbackPopChordVoicingState = null;
  isPlaying = true;
  updateEraserButtonState();
  cancelAnimationFrame(idlePulseFrame);
  idlePulseFrame = 0;
  transportStartedAt = startedAt;
  lastIdleDrumAbsoluteStep = null;
  if (manual) idleBeatStartedAt = startedAt;
  const absoluteStep = Math.floor((now - transportStartedAt) / stepDurationMs(tempo));
  lastAbsoluteStep = absoluteStep - 1;
  for (const button of [playButton, songPlayButton]) button.setAttribute("aria-pressed", "true");
  if (isSongMode) renderSongSectionSwitcher();
  updatePlayButton(playbackPositionAt(absoluteStep));
  updateTrackLoopPlayheads(now);
  updateSongPlayhead(now);
  updateTopBeatButtons(now, transportStartedAt);
  if (glows.size > 0) updateGlowPulse(now, transportStartedAt);
  if (manual) triggerManualDownbeat(now);
  else primeMetronome(now, transportStartedAt);
  void synth.unlock().catch(console.error);
  transportFrame = requestAnimationFrame(tickTransport);
}

function stopTransport() {
  if (!isPlaying) return;
  finishRecordingPhrase();
  finishEraserHistory();
  isPlaying = false;
  songPlaybackRangeState = null;
  songSectionTransitionState = null;
  updateEraserButtonState();
  cancelAnimationFrame(transportFrame);
  for (const { id } of INSTRUMENTS) stopPlaybackVoice(id);
  for (const button of [playButton, songPlayButton]) {
    button.textContent = "播放";
    button.setAttribute("aria-label", "播放");
    button.setAttribute("aria-pressed", "false");
  }
  updateTrackLoopPlayheads(performance.now());
  updateSongPlayhead(performance.now());
  if (isSongMode) renderSongSectionSwitcher();
  idleBeatStartedAt = transportStartedAt;
  if (currentInstrumentId === "drums" && lastLivePointerId !== null) {
    idleDrumPatternStartedAt = transportStartedAt;
    lastIdleDrumAbsoluteStep = Math.floor((performance.now() - idleDrumPatternStartedAt) / stepDurationMs(tempo)) - 1;
  }
  primeMetronome(performance.now(), idleBeatStartedAt);
  ensureIdlePulse();
  if (glows.size === 0) glowLayer.style.setProperty("--beat-pulse", "1");
  updateActiveRegions();
}

function toggleTransport() {
  if (isPlaying) stopTransport();
  else {
    const now = performance.now();
    startTransport(now, { now, manual: true });
  }
}

function toggleRecord() {
  if (recordArmed) finishRecordingPhrase();
  recordArmed = !recordArmed;
  for (const button of [recordButton, songRecordButton]) {
    button.textContent = recordArmed ? "录制中" : "录制";
    button.setAttribute("aria-pressed", String(recordArmed));
  }
  updateEraserButtonState();
  const now = performance.now();
  primeMetronome(now, isPlaying ? transportStartedAt : idleBeatStartedAt);
  if (metronomeMode === "record" && recordArmed) void synth.unlock().catch(console.error);
  observeTutorialRecordState(recordArmed);
}

function resetTapTempo() {
  tempoTaps = [];
  tapTempoButton.setAttribute("aria-label", "Tap Tempo");
}

function adjustTempo(delta) {
  resetTapTempo();
  finishRecordingPhrase();
  const previousTempo = tempo;
  setTempo(tempo + Number(delta));
  if (tempo !== previousTempo) recordHistoryState("调整 Tempo");
}

function registerTapTempo() {
  const now = performance.now();
  if (tempoTaps.length > 0 && !isTapIntervalInRange(now - tempoTaps.at(-1), tempo)) tempoTaps = [];
  tempoTaps.push(now);
  tempoTaps = tempoTaps.slice(-4);

  const tappedTempo = tapTempoFromTimestamps(tempoTaps);
  if (tappedTempo === null) {
    tapTempoButton.setAttribute("aria-label", `Tap Tempo：第 ${tempoTaps.length}/4 次`);
    return;
  }

  finishRecordingPhrase();
  const previousTempo = tempo;
  setTempo(tappedTempo);
  if (tempo !== previousTempo) recordHistoryState("Tap Tempo");
  tapTempoButton.setAttribute("aria-label", `Tap Tempo：${tappedTempo} BPM`);
}

function setTempo(nextTempo) {
  const parsedTempo = clampTempo(nextTempo);
  const now = performance.now();
  const idleDrumElapsedSteps = !isPlaying && lastIdleDrumAbsoluteStep !== null
    ? (now - idleDrumPatternStartedAt) / stepDurationMs(tempo)
    : null;
  if (isPlaying) {
    const elapsedSteps = (now - transportStartedAt) / stepDurationMs(tempo);
    transportStartedAt = now - elapsedSteps * stepDurationMs(parsedTempo);
  } else {
    const elapsedBeats = (now - idleBeatStartedAt) / (60_000 / tempo);
    idleBeatStartedAt = now - elapsedBeats * (60_000 / parsedTempo);
  }
  tempo = parsedTempo;
  if (idleDrumElapsedSteps !== null) {
    idleDrumPatternStartedAt = now - idleDrumElapsedSteps * stepDurationMs(tempo);
    lastIdleDrumAbsoluteStep = Math.floor(idleDrumElapsedSteps);
  }
  tempoValue.textContent = `${tempo} BPM`;
  tempoButton.textContent = `${tempo} BPM`;
  songTempoButton.textContent = `${tempo} BPM`;
  tempoButton.setAttribute("aria-label", `Tempo：${tempo} BPM`);
  primeMetronome(now, isPlaying ? transportStartedAt : idleBeatStartedAt);
}

function updateLoopLengthControls(instrumentId = currentInstrumentId) {
  const bars = loopBarsFor(instrumentId);
  const instrument = instrumentById(instrumentId);
  loopLengthButton.textContent = `${bars} 小节`;
  loopLengthButton.setAttribute("aria-label", `Loop 长度：${instrument.label}，${bars} 小节`);
  for (const button of loopLengthOptions.querySelectorAll("button[data-bars]")) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.bars) === bars));
  }
}

function setLoopBars(nextBars, instrumentId = currentInstrumentId) {
  const bars = Math.min(MAX_LOOP_BARS, Math.max(1, Number(nextBars)));
  if (bars === loopBarsFor(instrumentId)) return;
  finishRecordingPhrase();
  trackLoopBars.set(instrumentId, bars);
  updateLoopLengthControls(instrumentId);
  updateInstrumentButtons();
  if (isPlaying && instrumentId === currentInstrumentId) {
    const absoluteStep = Math.floor((performance.now() - transportStartedAt) / stepDurationMs(tempo));
    updatePlayButton(loopPosition(absoluteStep, bars));
  }
  recordHistoryState("更改 Loop 长度");
}

function renderTrackLoopDividers(button, bars) {
  if (Number(button.dataset.loopBars) === bars) return;
  button.dataset.loopBars = String(bars);
  const dividerContainer = button.querySelector(".track-loop-dividers");
  const dividers = Array.from({ length: bars - 1 }, (_, index) => {
    const divider = document.createElement("span");
    divider.className = "track-loop-divider";
    divider.style.left = `${((index + 1) / bars) * 100}%`;
    return divider;
  });
  dividerContainer.replaceChildren(...dividers);
}

function renderTrackLoopChart(button, instrumentId, bars) {
  button.querySelector(".track-loop-path").setAttribute("d", trackPathData(tracks.get(instrumentId), bars));
}

function updateTrackLoopChart(instrumentId) {
  const button = [...instrumentSwitcher.querySelectorAll("button[data-instrument]")]
    .find((candidate) => candidate.dataset.instrument === instrumentId);
  if (button) renderTrackLoopChart(button, instrumentId, loopBarsFor(instrumentId));
}

function updateTrackLoopPlayheads(now) {
  const absoluteStep = (now - transportStartedAt) / stepDurationMs(tempo);
  for (const button of instrumentSwitcher.querySelectorAll("button[data-instrument]")) {
    button.dataset.playing = String(isPlaying);
    if (!isPlaying) {
      button.style.removeProperty("--track-loop-progress");
      continue;
    }
    const progress = loopProgressAt(absoluteStep, loopBarsFor(button.dataset.instrument));
    button.style.setProperty("--track-loop-progress", `${(progress * 100).toFixed(3)}%`);
  }
}

function updateInstrumentButtons() {
  for (const button of instrumentSwitcher.querySelectorAll("button[data-instrument]")) {
    const instrumentId = button.dataset.instrument;
    const instrument = instrumentById(instrumentId);
    const bars = loopBarsFor(instrumentId);
    const isMuted = mutedTrackIds.has(instrumentId);
    const isSolo = soloTrackIds.has(instrumentId);
    const loop = songProject ? selectedSongLoop(songProject, songProject.currentSectionId, instrumentId) : null;
    let loopNumber = button.querySelector(".track-loop-number");
    if (!loopNumber) {
      loopNumber = document.createElement("span");
      loopNumber.className = "track-loop-number";
      button.append(loopNumber);
    }
    loopNumber.textContent = loop ? String(loop.number) : "";
    loopNumber.hidden = !loop;
    renderTrackLoopDividers(button, bars);
    renderTrackLoopChart(button, instrumentId, bars);
    button.dataset.muted = String(isMuted);
    button.dataset.solo = String(isSolo);
    button.setAttribute("aria-pressed", String(instrumentId === currentInstrumentId));
    button.setAttribute("aria-label", `${instrument.label}${loop ? `，Loop ${loop.number}` : ""}，${bars} 小节${isSolo ? "，已独奏" : ""}${isMuted ? "，已静音" : ""}`);
  }
}

function applyTrackAudibilityStates() {
  for (const instrumentId of TRACK_IDS) {
    if (!trackIsAudible(instrumentId)) silencePlaybackVoice(instrumentId);
  }

  if (lastLivePointerId !== null) {
    if (!trackIsAudible(currentInstrumentId)) stopActiveLiveVoice();
    else void startActiveLiveVoice(lastLivePointerId);
  }
  updateInstrumentButtons();
}

function toggleMuteForTrack(instrumentId) {
  finishRecordingPhrase();
  toggleTrackMute(mutedTrackIds, instrumentId);
  applyTrackAudibilityStates();
  recordHistoryState("切换 Mute");
}

function toggleSoloForTrack(instrumentId) {
  finishRecordingPhrase();
  toggleTrackSolo(soloTrackIds, instrumentId);
  applyTrackAudibilityStates();
  recordHistoryState("切换 Solo");
}

function clearTrackGesturePreview(button) {
  delete button.dataset.gesturePreview;
  delete button.dataset.gestureConfirmed;
  delete button.dataset.gestureLabel;
  button.style.removeProperty("--track-gesture-opacity");
  button.style.removeProperty("--track-label-offset");
  button.style.removeProperty("--track-gesture-shift");
}

function showTrackGesturePreview(button, preview, dy) {
  if (!preview) {
    clearTrackGesturePreview(button);
    return;
  }

  const progress = preview.progress;
  const stateKey = preview.action === "mute" ? "muted" : "solo";
  const isActive = button.dataset[stateKey] === "true";
  button.dataset.gesturePreview = preview.action;
  button.dataset.gestureConfirmed = String(preview.confirmed);
  button.dataset.gestureLabel = trackGestureLabel(preview.action, isActive);
  button.style.setProperty("--track-gesture-opacity", (0.3 + progress * 0.7).toFixed(3));
  button.style.setProperty("--track-label-offset", `${((1 - progress) * 10).toFixed(2)}px`);
  button.style.setProperty("--track-gesture-shift", `${Math.max(-5, Math.min(5, dy * 0.12)).toFixed(2)}px`);
}

function activateInstrumentButton(button) {
  const gesturePointers = new Map();
  let lastTouchAction = -Infinity;

  button.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    gesturePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      didDrag: false,
    });
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic accessibility/test activations may not own a native pointer capture.
    }
  });

  button.addEventListener("pointermove", (event) => {
    const gesture = gesturePointers.get(event.pointerId);
    if (!gesture) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.hypot(dx, dy) >= 10) gesture.didDrag = true;
    showTrackGesturePreview(button, trackGesturePreview(dx, dy), dy);
  });

  button.addEventListener("pointerup", (event) => {
    const start = gesturePointers.get(event.pointerId);
    gesturePointers.delete(event.pointerId);
    if (!start) return;

    lastTouchAction = performance.now();
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const action = trackGestureAction(dx, dy);
    clearTrackGesturePreview(button);
    if (action === "solo") toggleSoloForTrack(button.dataset.instrument);
    else if (action === "mute") toggleMuteForTrack(button.dataset.instrument);
    else if (action === "select" && !start.didDrag) selectInstrument(button.dataset.instrument);
  });

  button.addEventListener("pointercancel", (event) => {
    gesturePointers.delete(event.pointerId);
    clearTrackGesturePreview(button);
  });
  button.addEventListener("click", () => {
    if (performance.now() - lastTouchAction < 700) return;
    selectInstrument(button.dataset.instrument);
  });
}

function selectInstrument(instrumentId) {
  if (historyReady && instrumentId !== currentInstrumentId) finishRecordingPhrase();
  currentInstrumentId = instrumentId;
  stopActiveLiveVoice();
  const activePoint = currentRecordingPoint();
  if (activePoint) {
    showGlow("live:control", activePoint, false, instrumentId);
    if (instrumentId === "drums" && !isPlaying) beginIdleDrumPattern(performance.now());
    void startActiveLiveVoice(lastLivePointerId);
  } else {
    lastIdleDrumAbsoluteStep = null;
  }

  const instrument = INSTRUMENTS.find(({ id }) => id === instrumentId);
  currentInstrumentButton.textContent = instrument.label;
  currentInstrumentButton.setAttribute("aria-label", `当前乐器：${instrument.label}`);
  updateLoopLengthControls(instrumentId);
  updateInstrumentButtons();
  updateEraserButtonState();
  renderScale();
  updateSongActiveTrackVisuals();
  scheduleAutosave();
  observeTutorialInstrument(instrumentId);
}

function setMenuOpen(open) {
  appMenu.hidden = !open;
  appMenuButton.setAttribute("aria-expanded", String(open));
  if (!open) resetClearConfirmation();
}

function toggleMenu() {
  setMenuOpen(appMenu.hidden);
}

function resetClearConfirmation() {
  clearTimeout(clearConfirmTimer);
  clearConfirmTimer = 0;
  clearTrackButton.dataset.confirm = "false";
  clearTrackButton.textContent = "清除当前轨道";
}

function requestClearTrack() {
  const instrument = INSTRUMENTS.find(({ id }) => id === currentInstrumentId);
  if (clearTrackButton.dataset.confirm !== "true") {
    clearTrackButton.dataset.confirm = "true";
    clearTrackButton.textContent = `再次点击清除「${instrument.label}」`;
    archiveStatus.textContent = "等待确认";
    clearConfirmTimer = window.setTimeout(resetClearConfirmation, 3000);
    return;
  }

  finishRecordingPhrase();
  tracks.get(currentInstrumentId).clear();
  if (isSongMode) {
    const loop = selectedSongLoop(songProject, songProject.currentSectionId, currentInstrumentId);
    if (loop) {
      loop.points = {};
      updateSongLoopClipCharts(currentInstrumentId, loop.id);
    }
  }
  stopPlaybackVoice(currentInstrumentId);
  updateRecordedStepCount();
  updateTrackLoopChart(currentInstrumentId);
  updateActiveRegions();
  archiveStatus.textContent = `已清除「${instrument.label}」`;
  recordHistoryState("清除轨道");
  setMenuOpen(false);
}

function formatArchiveTime(savedAt) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(savedAt));
}

function archiveProject() {
  finishRecordingPhrase();
  finishEraserHistory();
  commitFineLoopShift();
  try {
    const archive = currentProjectArchive();
    localStorage.setItem(activeProjectStorageKey(ARCHIVE_STORAGE_KEY), JSON.stringify(archive));
    archiveStatus.textContent = `已保存检查点 ${formatArchiveTime(archive.savedAt)}`;
  } catch (error) {
    console.error(error);
    archiveStatus.textContent = "存档失败";
  }
  setMenuOpen(false);
}

function applyProjectArchive(rawArchive, { preserveCurrentInstrument = false } = {}) {
  const archive = parseProjectArchive(rawArchive, INSTRUMENTS.map(({ id }) => id));
  const nextIsSongMode = archive.workspaceMode === "song";
  if (nextIsSongMode !== isSongMode) stopTransport();
  if (isSongMode) {
    cancelArrangedSongLoopLength({ render: false });
    closeSongClipMenu();
    closeSongLoopPicker();
    closeSongClipSplitEditor();
  }
  setTempo(archive.tempo);
  if (SCALES[archive.scaleKey]) currentScaleKey = archive.scaleKey;
  if (!preserveCurrentInstrument && tracks.has(archive.currentInstrumentId)) {
    currentInstrumentId = archive.currentInstrumentId;
  }
  trackLoopBars.clear();
  for (const [instrumentId, bars] of archive.trackLoopBars) trackLoopBars.set(instrumentId, bars);
  mutedTrackIds.clear();
  for (const instrumentId of archive.mutedTrackIds) mutedTrackIds.add(instrumentId);
  soloTrackIds.clear();
  for (const instrumentId of archive.soloTrackIds) soloTrackIds.add(instrumentId);

  for (const instrumentId of TRACK_IDS) stopPlaybackVoice(instrumentId);
  for (const [instrumentId, restoredTrack] of archive.tracks) {
    const track = tracks.get(instrumentId);
    track.clear();
    for (const [step, point] of restoredTrack) track.set(step, point);
  }

  songProject = restoreSongProject(archive.song, TRACK_IDS, tracks, trackLoopBars);
  songProject.arrangerSplitRatio = storedSongSplitRatio() ?? songProject.arrangerSplitRatio;

  selectInstrument(currentInstrumentId);
  updateRecordedStepCount();
  applyWorkspaceModeLayout(nextIsSongMode, { resetScroll: true });
  return archive;
}

function restoreStoredArchive() {
  const storedArchive = localStorage.getItem(activeProjectStorageKey(ARCHIVE_STORAGE_KEY));
  if (!storedArchive) return false;
  const archive = applyProjectArchive(storedArchive);
  archiveStatus.textContent = `已恢复检查点 ${formatArchiveTime(archive.savedAt)}`;
  return true;
}

async function initializeProject() {
  let restored = false;
  let fallbackState = null;
  try {
    const autosavedState = localStorage.getItem(activeProjectStorageKey(AUTOSAVE_STORAGE_KEY));
    if (autosavedState) fallbackState = JSON.parse(autosavedState);
  } catch (error) {
    console.error(error);
  }

  try {
    let session = await loadHistorySession(activeHistorySessionKey());
    if (!session && shouldMigrateLegacyHistory) {
      session = await loadHistorySession();
      if (session) await saveHistorySession(session, activeHistorySessionKey());
    }
    if (session?.history) {
      projectHistory = ProjectHistory.restore(session.history, 256);
      const indexedState = session.workingState ?? projectHistory.current()?.state;
      const fallbackIsNewer = fallbackState?.savedAt && indexedState?.savedAt
        && Date.parse(fallbackState.savedAt) > Date.parse(indexedState.savedAt);
      const workingState = fallbackIsNewer ? fallbackState : indexedState;
      if (workingState) {
        applyProjectArchive(workingState);
        projectHistory.record(workingState, "恢复未完成操作");
        restored = true;
        archiveStatus.textContent = fallbackIsNewer ? "已恢复最近的自动保存" : "已恢复历史记录";
      }
    }
  } catch (error) {
    console.error(error);
  }

  if (!restored) {
    try {
      if (fallbackState) {
        applyProjectArchive(fallbackState);
        restored = true;
        archiveStatus.textContent = "已恢复自动保存";
      } else {
        restored = restoreStoredArchive();
      }
    } catch (error) {
      console.error(error);
      archiveStatus.textContent = "自动保存无法读取";
    }
  }

  if (!restored) {
    updateInstrumentButtons();
    updateLoopLengthControls();
    renderScale();
  }

  historyReady = true;
  projectHistory.record(currentProjectArchive(), restored ? "恢复项目" : "初始状态");
  updateInstrumentButtons();
  updateHistoryControls();
  autosaveStatus.textContent = "自动保存已开启";
  persistAutosaveNow();
}

inputLayer.addEventListener("pointerdown", beginNote);
inputLayer.addEventListener("pointermove", moveNote);
inputLayer.addEventListener("pointerup", endNote);
inputLayer.addEventListener("pointercancel", endNote);
inputLayer.addEventListener("lostpointercapture", endNote);
for (const button of eraserButtons) {
  button.addEventListener("pointerdown", beginErasing);
  button.addEventListener("pointerup", endErasing);
  button.addEventListener("pointercancel", endErasing);
  button.addEventListener("lostpointercapture", endErasing);
  button.addEventListener("keydown", (event) => {
    if ((event.key !== " " && event.key !== "Enter") || event.repeat) return;
    event.preventDefault();
    if (!eraserIsHeld()) finishRecordingPhrase();
    eraserKeyboardHeld = true;
    updateEraserButtonState();
    updateHistoryControls();
  });
  button.addEventListener("keyup", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    eraserKeyboardHeld = false;
    updateEraserButtonState();
    if (!eraserIsHeld()) finishEraserHistory();
    updateHistoryControls();
  });
}

songRuler.addEventListener("pointerdown", (event) => {
  const edge = songSectionLoopEdgeAtClientX(event.clientX);
  if (!edge) return;
  beginSongSectionLoopDrag(
    event,
    edge,
    edge === "start" ? songSectionLoopStart : songSectionLoopEnd
  );
});
for (const handle of [songSectionLoopStart, songSectionLoopEnd]) {
  handle.addEventListener("pointermove", moveSongSectionLoopDrag);
  handle.addEventListener("pointerup", finishSongSectionLoopDrag);
  handle.addEventListener("pointercancel", finishSongSectionLoopDrag);
  handle.addEventListener("lostpointercapture", finishSongSectionLoopDrag);
  handle.addEventListener("keydown", (event) => {
    if (!isSongMode || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    nudgeSongSectionLoop(
      handle === songSectionLoopStart ? "start" : "end",
      event.key === "ArrowRight" ? 1 : -1
    );
  });
}

songTimelineViewport.addEventListener("pointerdown", beginSongTimelineInteraction);
songTimelineViewport.addEventListener("pointermove", moveSongTimelineInteraction);
songTimelineViewport.addEventListener("pointerup", endSongTimelineInteraction);
songTimelineViewport.addEventListener("pointercancel", cancelSongTimelineInteraction);
songTimelineViewport.addEventListener("lostpointercapture", cancelSongTimelineInteraction);
songTimelineViewport.addEventListener("scroll", () => {
  updateSongOverflowHint();
  closeSongClipMenu();
  renderSongClipSplitEditor();
  renderSongLoopLengthEditor();
}, { passive: true });
songClipSplitMarker.addEventListener("pointerdown", (event) => {
  if (!songClipSplitState || (event.pointerType === "mouse" && event.button !== 0)) return;
  event.preventDefault();
  event.stopPropagation();
  songClipSplitState.pointerId = event.pointerId;
  songClipSplitMarker.setPointerCapture?.(event.pointerId);
});
songClipSplitMarker.addEventListener("pointermove", updateSongClipSplitFromPointer);
songClipSplitMarker.addEventListener("pointerup", finishSongClipSplitPointer);
songClipSplitMarker.addEventListener("pointercancel", finishSongClipSplitPointer);
songClipSplitMarker.addEventListener("lostpointercapture", finishSongClipSplitPointer);
songClipSplitMarker.addEventListener("keydown", (event) => {
  if (!songClipSplitState || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const clip = currentSongSection(songProject).tracks[songClipSplitState.trackId].clips
    .find((candidate) => candidate.id === songClipSplitState.clipId);
  if (!clip) return;
  songClipSplitState.splitBar = Math.min(
    clip.startBar + clip.lengthBars - 1,
    Math.max(clip.startBar + 1, songClipSplitState.splitBar + (event.key === "ArrowRight" ? 1 : -1))
  );
  renderSongClipSplitEditor();
});
songLoopLengthMarker.addEventListener("pointerdown", (event) => {
  if (!songLoopLengthState || (event.pointerType === "mouse" && event.button !== 0)) return;
  event.preventDefault();
  event.stopPropagation();
  songLoopLengthState.pointerId = event.pointerId;
  try {
    songLoopLengthMarker.setPointerCapture(event.pointerId);
  } catch {
    // Synthetic pointer events may not own pointer capture.
  }
});
songLoopLengthMarker.addEventListener("pointermove", updateSongLoopLengthFromPointer);
songLoopLengthMarker.addEventListener("pointerup", finishSongLoopLengthPointer);
songLoopLengthMarker.addEventListener("pointercancel", finishSongLoopLengthPointer);
songLoopLengthMarker.addEventListener("lostpointercapture", finishSongLoopLengthPointer);
songLoopLengthMarker.addEventListener("keydown", (event) => {
  if (!songLoopLengthState || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const minimumBars = minimumEditableSongLoopBars(songLoopLengthState.edit);
  const direction = event.key === "ArrowRight" ? 1 : -1;
  updateArrangedSongLoopLength(Math.min(
    MAX_LOOP_BARS,
    Math.max(minimumBars, songLoopLengthState.preview.loopBars + direction)
  ));
});
songLoopPickerList.addEventListener("scroll", () => {
  if (!songLoopPickerState) return;
  clearTimeout(songLoopPickerState.scrollTimer);
  songLoopPickerState.scrollTimer = window.setTimeout(updateLoopPickerSelectionFromScroll, 70);
}, { passive: true });
songLoopPickerList.addEventListener("click", (event) => {
  const option = event.target.closest(".song-loop-picker-option");
  if (!option || !songLoopPickerState) return;
  if (songLoopPickerState.loopId === option.dataset.loopId) {
    placePickedSongLoop();
    return;
  }
  updateLoopPickerSelection(option.dataset.loopId);
  centerLoopPickerOption(option);
});

for (const eventName of ["contextmenu", "selectstart", "dragstart"]) {
  document.addEventListener(eventName, (event) => event.preventDefault());
}

document.addEventListener("pointerdown", (event) => {
  if (!appMenu.hidden && !event.target.closest(".top-bar")) setMenuOpen(false);
  if (!songClipMenu.hidden && !event.target.closest("#song-clip-menu") && !event.target.closest(".song-clip")) {
    closeSongClipMenu();
  }
  if (!songLoopPicker.hidden && !event.target.closest("#song-loop-picker")) closeSongLoopPicker();
});

activateOnPress(scaleMenuButton, () => {
  if (currentInstrumentId !== "chord") openScalePanel();
});
activateOnPress(songScaleButton, openScalePanel);
activateOnPress(confirmScaleButton, () => closePanel(scalePanel, isSongMode ? songScaleButton : scaleMenuButton));
activateOnPress(tempoButton, () => {
  resetTapTempo();
  openSettingPanel(tempoPanel);
  updateTopBeatButtons(performance.now(), isPlaying ? transportStartedAt : idleBeatStartedAt, isPlaying);
});
activateOnPress(songTempoButton, () => {
  resetTapTempo();
  openSettingPanel(tempoPanel);
  updateTopBeatButtons(performance.now(), isPlaying ? transportStartedAt : idleBeatStartedAt, isPlaying);
});
activateOnPress(confirmTempoButton, () => closePanel(tempoPanel, isSongMode ? songTempoButton : tempoButton));
activateOnPress(loopLengthButton, () => openSettingPanel(loopLengthPanel));
activateOnPress(confirmLoopLengthButton, () => closePanel(loopLengthPanel, loopLengthButton));
activateOnPress(sectionLengthButton, () => openSettingPanel(sectionLengthPanel));
activateOnPress(confirmSectionLengthButton, () => closePanel(sectionLengthPanel, sectionLengthButton));
activateOnPress(loopShiftButton, openLoopShiftPanel);
activateOnPress(confirmLoopShiftButton, closeLoopShiftPanel);
activateOnPress(recordButton, toggleRecord);
activateOnPress(playButton, toggleTransport);
activateOnPress(songModeButton, enterSongMode);
activateOnPress(exitSongModeButton, exitSongMode);
activateOnPress(songRecordButton, toggleRecord);
activateOnPress(songPlayButton, toggleTransport);
activateOnPress(appMenuButton, toggleMenu);
activateOnPress(metronomeButton, toggleMetronome);
activateOnPress(undoButton, undoProjectHistory);
activateOnPress(redoButton, redoProjectHistory);
activateOnPress(clearTrackButton, requestClearTrack);
activateOnPress(archiveButton, archiveProject);
activateOnPress(releaseTouchesButton, releaseStuckTouches);
activateOnPress(tapTempoButton, registerTapTempo);
activateOnPress(showRegisterButton, () => showAuthMode("register"));
activateOnPress(showLoginButton, () => showAuthMode("login"));
activateOnPress(restartTutorialButton, beginTutorial);
activateOnPress(switchProfileButton, () => void switchProfile());
activateOnPress(exitAppButton, () => void exitApplication());
activateOnPress(skipTutorialButton, () => closeTutorial("skipped"));
activateOnPress(tutorialPrimaryButton, () => {
  const progress = normalizeTutorialProgress(activeProfile?.tutorial);
  if (progress.step === 0) setTutorialStep(1);
  else if (progress.step === TUTORIAL_STEPS.length - 1) closeTutorial("completed");
});
activateOnPress(lengthSongClipButton, openSongLoopLengthEditor);
activateOnPress(mergeSongClipButton, mergeArrangedSongClip);
activateOnPress(splitSongClipButton, openSongClipSplitEditor);
activateOnPress(deleteSongClipButton, deleteArrangedSongClip);
activateOnPress(cancelSongSplitButton, closeSongClipSplitEditor);
activateOnPress(confirmSongSplitButton, confirmArrangedSongClipSplit);
activateOnPress(cancelSongLoopLengthButton, cancelArrangedSongLoopLength);
activateOnPress(confirmSongLoopLengthButton, confirmArrangedSongLoopLength);
for (const button of tempoDeltaButtons) {
  activateOnPress(button, () => adjustTempo(button.dataset.tempoDelta));
}
for (const button of loopLengthOptions.querySelectorAll("button[data-bars]")) {
  activateOnPress(button, () => setLoopBars(button.dataset.bars));
}
for (const button of loopShiftCoarseButtons) {
  activateOnPress(button, () => applyCoarseLoopShift(button));
}
for (const button of songSectionSwitcher.querySelectorAll("button[data-section]")) {
  activateOnPress(button, () => selectSongSection(button.dataset.section));
}
for (const button of sectionBaseOptions.querySelectorAll("button[data-section-base]")) {
  activateOnPress(button, () => applySectionBaseLength(button.dataset.sectionBase));
}
for (const button of sectionExtraOptions.querySelectorAll("button[data-section-extra]")) {
  activateOnPress(button, () => toggleSectionExtraLength(button.dataset.sectionExtra));
}
loopShiftSlider.addEventListener("input", applyFineLoopShift);
loopShiftSlider.addEventListener("change", commitFineLoopShift);
for (const button of instrumentSwitcher.querySelectorAll("button[data-instrument]")) {
  activateInstrumentButton(button);
}
profileSelect.addEventListener("change", updateLoginPinField);

songSplitHandle.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  const availableHeight = songSplitAvailableHeight();
  songSplitInteraction = {
    pointerId: event.pointerId,
    startY: event.clientY,
    startHeight: performanceView.getBoundingClientRect().height,
    availableHeight,
  };
  songSplitHandle.dataset.dragging = "true";
  songSplitHandle.setPointerCapture?.(event.pointerId);
});
window.addEventListener("pointermove", updateSongSplitFromPointer);
window.addEventListener("pointerup", finishSongSplitInteraction);
window.addEventListener("pointercancel", finishSongSplitInteraction);
songSplitHandle.addEventListener("lostpointercapture", finishSongSplitInteraction);
songSplitHandle.addEventListener("keydown", (event) => {
  if (!isSongMode || !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const song = ensureSongProject();
  if (event.key === "Home") song.arrangerSplitRatio = 0.2;
  else if (event.key === "End") song.arrangerSplitRatio = 0.8;
  else song.arrangerSplitRatio = Math.min(
    0.8,
    Math.max(0.2, song.arrangerSplitRatio + (event.key === "ArrowDown" ? 0.025 : -0.025))
  );
  applySongSplitRatio();
  persistSongSplitRatio();
  scheduleAutosave();
});

window.addEventListener("resize", () => {
  applySongSplitRatio();
  updateSongTimelineMetrics();
});

window.addEventListener("blur", () => {
  finishSongSplitInteraction();
  stopTransport();
  synth.stopAll();
  liveVoiceToken += 1;
  activeLiveVoiceId = null;
  pointerNotes.clear();
  pointerPositions.clear();
  pointerPressOrder.length = 0;
  lastLivePointerId = null;
  lastIdleDrumAbsoluteStep = null;
  eraserPointerIds.clear();
  eraserKeyboardHeld = false;
  updateEraserButtonState();
  for (const id of [...glows.keys()]) hideGlow(id);
  updateActiveRegions();
  finishRecordingPhrase();
  finishEraserHistory();
  commitFineLoopShift();
  persistAutosaveNow();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden") return;
  finishRecordingPhrase();
  finishEraserHistory();
  commitFineLoopShift();
  persistAutosaveNow();
});

window.addEventListener("pagehide", () => {
  finishRecordingPhrase();
  finishEraserHistory();
  commitFineLoopShift();
  persistAutosaveNow();
});

surface.dataset.recordedSteps = "0";
updateEraserButtonState();
await authenticateUser();
await initializeProject();
showPendingTutorial();
ensureIdlePulse();
