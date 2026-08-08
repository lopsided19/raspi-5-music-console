import { midiToFrequency } from "./music.js";

export class BasicSynth {
  #context;
  #master;
  #noiseBuffer;
  #voices = new Map();

  async unlock() {
    const context = this.#getContext();
    if (context.state === "suspended") await context.resume();
  }

  async start(pointerId, midi, preset = "default") {
    await this.unlock();
    const context = this.#context;

    this.stop(pointerId);

    const midis = Array.isArray(midi) ? midi : [midi];
    const oscillatorSettings = preset === "bass"
      ? [{ type: "sawtooth", ratio: 1, midiIndex: 0 }, { type: "sine", ratio: 0.5, midiIndex: 0 }]
      : preset === "chord"
        ? midis.map((_, midiIndex) => ({ type: "triangle", ratio: 1, midiIndex }))
        : [{ type: "triangle", ratio: 1, midiIndex: 0 }];
    const oscillators = oscillatorSettings.map(({ type, ratio, midiIndex }) => ({
      node: new OscillatorNode(context, { type, frequency: midiToFrequency(midis[midiIndex]) * ratio }),
      ratio,
      midiIndex,
    }));
    const gain = new GainNode(context, { gain: 0 });
    const now = context.currentTime;
    let input = gain;

    if (preset === "bass" || preset === "chord") {
      const filter = new BiquadFilterNode(context, {
        type: "lowpass",
        frequency: preset === "bass" ? 850 : 2600,
        Q: preset === "bass" ? 1.2 : 0.7,
      });
      filter.connect(gain);
      input = filter;
    }

    const targetGain = preset === "bass" ? 0.13 : preset === "chord" ? 0.065 : 0.18;
    gain.gain.linearRampToValueAtTime(targetGain, now + (preset === "chord" ? 0.025 : 0.015));
    gain.connect(this.#master);
    for (const { node } of oscillators) {
      node.connect(input);
      node.start(now);
    }

    this.#voices.set(pointerId, { oscillators, gain, midis });
  }

  async playMetronome(accent = false) {
    await this.unlock();
    const context = this.#context;
    const now = context.currentTime;
    const oscillator = new OscillatorNode(context, {
      type: "sine",
      frequency: accent ? 1440 : 920,
    });
    const gain = new GainNode(context, { gain: 0.0001 });
    const peakGain = accent ? 0.16 : 0.055;

    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (accent ? 0.075 : 0.055));
    oscillator.connect(gain);
    gain.connect(this.#master);
    oscillator.start(now);
    oscillator.stop(now + (accent ? 0.08 : 0.06));
  }

  async playDrum(note, velocity = 1) {
    await this.unlock();
    if (note === 36) this.#playKick(velocity);
    else if (note === 38) this.#playSnare(velocity);
    else if (note === 46) this.#playHat(velocity, true);
    else this.#playHat(velocity, false);
  }

  change(pointerId, midi) {
    const voice = this.#voices.get(pointerId);
    const midis = Array.isArray(midi) ? midi : [midi];
    if (!voice || voice.midis.length !== midis.length) return false;
    if (voice.midis.every((currentMidi, index) => currentMidi === midis[index])) return false;

    const now = this.#context.currentTime;
    for (const { node, ratio, midiIndex } of voice.oscillators) {
      node.frequency.cancelScheduledValues(now);
      node.frequency.setTargetAtTime(midiToFrequency(midis[midiIndex]) * ratio, now, 0.008);
    }
    voice.midis = midis;
    return true;
  }

  stop(pointerId) {
    const voice = this.#voices.get(pointerId);
    if (!voice) return;

    const now = this.#context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0, now, 0.015);
    for (const { node } of voice.oscillators) node.stop(now + 0.08);
    this.#voices.delete(pointerId);
  }

  stopAll() {
    for (const pointerId of this.#voices.keys()) this.stop(pointerId);
  }

  stopByPrefix(prefix) {
    for (const pointerId of this.#voices.keys()) {
      if (String(pointerId).startsWith(prefix)) this.stop(pointerId);
    }
  }

  #getContext() {
    if (!this.#context) {
      this.#context = new AudioContext({ latencyHint: "interactive" });
      this.#master = new GainNode(this.#context, { gain: 0.7 });
      this.#master.connect(this.#context.destination);
    }
    return this.#context;
  }

  #playKick(velocity) {
    const context = this.#context;
    const now = context.currentTime;
    const oscillator = new OscillatorNode(context, { type: "sine", frequency: 145 });
    const gain = new GainNode(context, { gain: Math.max(0.0001, 0.5 * velocity) });
    oscillator.frequency.exponentialRampToValueAtTime(48, now + 0.11);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    oscillator.connect(gain);
    gain.connect(this.#master);
    oscillator.start(now);
    oscillator.stop(now + 0.23);
  }

  #playSnare(velocity) {
    const context = this.#context;
    const now = context.currentTime;
    const noise = new AudioBufferSourceNode(context, { buffer: this.#getNoiseBuffer() });
    const filter = new BiquadFilterNode(context, { type: "bandpass", frequency: 1850, Q: 0.65 });
    const gain = new GainNode(context, { gain: Math.max(0.0001, 0.28 * velocity) });
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.#master);
    noise.start(now);
    noise.stop(now + 0.14);
  }

  #playHat(velocity, open) {
    const context = this.#context;
    const now = context.currentTime;
    const duration = open ? 0.24 : 0.055;
    const noise = new AudioBufferSourceNode(context, { buffer: this.#getNoiseBuffer() });
    const filter = new BiquadFilterNode(context, { type: "highpass", frequency: 6200, Q: 0.8 });
    const gain = new GainNode(context, { gain: Math.max(0.0001, 0.13 * velocity) });
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.#master);
    noise.start(now);
    noise.stop(now + duration + 0.01);
  }

  #getNoiseBuffer() {
    if (this.#noiseBuffer) return this.#noiseBuffer;
    const buffer = new AudioBuffer({ length: this.#context.sampleRate, sampleRate: this.#context.sampleRate });
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    this.#noiseBuffer = buffer;
    return buffer;
  }
}
