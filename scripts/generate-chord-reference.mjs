import { SCALES } from "../src/music.js";
import { chordDescription } from "../src/chords.js";

const lines = [];
const push = (line = "") => lines.push(line);

push("# 和弦轨道：设计理解与完整位置映射");
push();
push("本文档由当前 `SCALES` 与 `chords.js` 的实际算法生成，是实现规范而不是独立的理论草稿。");
push();
push("## 我的理解与设计决定");
push();
push("1. 和弦轨道是一个确定性的 scale harmonizer：横向位置先选中当前音阶的某一级，再以该级为根音构造和弦。");
push("2. 每个位置只使用当前音阶内音。构成规则固定为沿音阶叠置第 1、3、5、7 个音，因此七声音阶得到常规级数七和弦，五声、六声、八声与十二声音阶则得到相应的音阶内四音集合。");
push("3. 闭合叠置 `[根、三、五、七]` 不直接发声。实际使用 rooted open voicing：`[根、五、七、三↑8]`，即保留根音在最低声部，把三音提升一个八度，让中频更疏朗。");
push("4. 第一个横向八度的和弦根音从 C3 开始；第二个横向八度整体升高 12 半音；末端第三个 Do 再升高 12 半音。所有四个声部一起移调。");
push("5. y 坐标目前仍被录制，但暂不改变 inversion、张力音或音色；这样未来可以把 y 分配给 inversion/filter，而不会破坏已有 Loop 数据。");
push("6. Loop 保存的是归一化触摸坐标，不保存和弦音高。因此更换音阶后，已经录制的和弦轨迹会按新音阶和同一套规则重新和声化。");
push("7. 当前和弦音色为四个 triangle oscillator，统一通过 2600 Hz、Q 0.7 的 low-pass filter；总增益 0.065，起音 25 ms。一个触点对应一个四声部和弦 voice。");
push();
push("## 命名与拼写约定");
push();
push("- 音名统一采用升号拼写（例如 C♯ 而不是 D♭），因此某些调式的理论拼写是等音近似。");
push("- 能精确匹配常见结构时使用常规符号，例如 `maj7`、`m7`、`7`、`m7♭5`、`dim7`。");
push("- 无法被常见符号无歧义描述时，写作 `根音 [半音集合]`；例如 `C [0,2,4,6]` 表示相对根音的 pitch-class 距离，具体音高仍以“闭合叠置”和“实际 voicing”为准。");
push("- 表格中的横向范围左闭右开；最后一格包含最右边界。每个表格明确列出两个八度加末端 Do 的全部位置。");
push();

let previousGroup = null;
for (const [scaleKey, scale] of Object.entries(SCALES)) {
  if (scale.group !== previousGroup) {
    push(`# ${scale.group}`);
    push();
    previousGroup = scale.group;
  }

  const noteCount = scale.intervals.length * 2 + 1;
  push(`## ${scale.label} \`${scaleKey}\``);
  push();
  push(`音阶半音集合：\`[${scale.intervals.join(", ")}]\`；触控音区数量：${noteCount}。`);
  push();
  push("| 音区 | 横向范围 | 根音 | 和弦 | 闭合叠置 1–3–5–7 | 实际 voicing 根–5–7–3↑ | MIDI voicing |");
  push("|---:|:---|:---|:---|:---|:---|:---|");

  for (let positionIndex = 0; positionIndex < noteCount; positionIndex += 1) {
    const description = chordDescription(scale.intervals, positionIndex);
    const start = (positionIndex / noteCount * 100).toFixed(2);
    const end = ((positionIndex + 1) / noteCount * 100).toFixed(2);
    push(`| ${positionIndex + 1} | ${start}%–${end}% | ${description.closedLabels[0]} | ${description.symbol} | ${description.closedLabels.join("–")} · [${description.rawIntervals.join(",")}] | ${description.voicingLabels.join("–")} | ${description.voicing.join("–")} |`);
  }
  push();
}

process.stdout.write(`${lines.join("\n")}\n`);
